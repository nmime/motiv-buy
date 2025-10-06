import { Logger as PinoLoggerService, PinoLogger } from 'nestjs-pino';
import { SerializedError } from 'pino-std-serializers';

import { pinoHttp, stdSerializers } from 'pino-http';

import { Store, storage } from 'nestjs-pino/storage';

// Interface for requests with logger properties (extended by pino middleware)
interface LoggerRequest {
  log?: import('pino').Logger;
  allLogs?: import('pino').Logger[];
}
import { Params } from 'nestjs-pino/params';
import { IncomingMessage, ServerResponse } from 'http';
import { ClsServiceManager } from 'nestjs-cls';
import { FastifyRequest, FastifyReply } from 'fastify';

const protectedVariables = [
  'authorization',
  'rocket-exchange-key',
  'rocket-pay-key',
  'x-api-key',
  'apikey',
  'api_key',
  'tron-pro-api-key',
  'ok-access-key',
  'ok-access-sign',
  'ok-access-passphrase',
  'access_key',
  'password',
  '_header',
  'chunk',
  'api-key',
  'api-sign',
  'cookie',
  'token',
];

function bindLoggerMiddlewareFactory(useExisting: boolean) {
  return function bindLoggerMiddleware(req: FastifyRequest & LoggerRequest, _res: FastifyReply, next: () => void) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    let { log } = req;

    if (!useExisting && req.allLogs && req.allLogs.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      log = req.allLogs[req.allLogs.length - 1];
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    storage.run(new Store(log), next);
  };
}

function createLoggerMiddlewares(params: Record<string, unknown>, useExisting = false) {
  if (useExisting) {
    return [bindLoggerMiddlewareFactory(useExisting)];
  }

  const middleware = pinoHttp(...(Array.isArray(params) ? params : [params]));

  // Set the root logger using type assertion to bypass readonly restriction
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  (PinoLogger as { root?: unknown }).root = middleware.logger;

  return [middleware, bindLoggerMiddlewareFactory(useExisting)];
}

function redactSensitiveStrings(str: string): string {
  return protectedVariables.reduce((acc, key) => {
    const regex = new RegExp(`(${key})["']?[:=]\\s*["']?[^"'\n ]+`, 'gi');

    return acc.replace(regex, `$1="[redacted]"`);
  }, str);
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function replaceProtectedVariables<T>(obj: unknown): T {
  if (typeof obj === 'string') {
    return redactSensitiveStrings(obj) as unknown as T;
  }

  if (!obj || typeof obj !== 'object') {
    return obj as T;
  }

  const copy: Record<string, unknown> | unknown[] = Array.isArray(obj) ? [] : {};

  if (Array.isArray(copy)) {
    for (let i = 0; i < (obj as unknown[]).length; i++) {
      const value = (obj as unknown[])[i];
      if (typeof value === 'string') {
        copy[i] = redactSensitiveStrings(value);
      } else if (typeof value === 'object') {
        copy[i] = replaceProtectedVariables<unknown>(value);
      } else {
        copy[i] = value;
      }
    }
  } else {
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      const value = (obj as Record<string, unknown>)[key];

      if (protectedVariables.includes(key.toLowerCase())) {
        copy[key] = '[redacted]';
      } else if (typeof value === 'string') {
        copy[key] = redactSensitiveStrings(value);
      } else if (typeof value === 'object') {
        copy[key] = replaceProtectedVariables<unknown>(value);
      } else {
        copy[key] = value;
      }
    }
  }

  return copy as T;
}

function copyWithDepthLimit<T>(obj: T, depthLimit = 500, currentDepth = 0): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (currentDepth >= depthLimit) {
    return undefined as unknown as T;
  }

  if (obj instanceof Error) {
    // eslint-disable-next-line no-param-reassign
    obj = stdSerializers.err(obj) as T;
  }

  const copy: Record<string, unknown> | unknown[] = Array.isArray(obj) ? [] : {};

  if (Array.isArray(copy)) {
    for (let i = 0; i < (obj as unknown[]).length; i++) {
      copy[i] = copyWithDepthLimit((obj as unknown[])[i], depthLimit, currentDepth + 1);
    }
  } else {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        copy[key] = copyWithDepthLimit((obj as Record<string, unknown>)[key], depthLimit, currentDepth + 1);
      }
    }
  }

  return copy as T;
}

function redactProtectedVariables<T>(obj: T): T {
  try {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const copy = copyWithDepthLimit(obj, 5);

    return replaceProtectedVariables(copy);
  } catch {
    return 'Error while redacting protected variables' as unknown as T;
  }
}

function processErrorValue(value: unknown, currentMessage: string): { message: string; error?: SerializedError } {
  const error = redactProtectedVariables(value) as SerializedError;

  if (typeof error === 'string') {
    return {
      message: currentMessage || error,
      error: undefined,
    };
  }

  const { message: errorMessage } = error;

  return {
    message: currentMessage || errorMessage,
    error,
  };
}

function processLogValues(mergingObject: Record<string, unknown>, values: unknown[]) {
  let message = '';
  let error: SerializedError | undefined;
  const interpolationValues: unknown[] = [];

  for (const value of [mergingObject['err'], ...values]) {
    if (value === undefined) {
      continue;
    }

    if (!error && value instanceof Error) {
      const { message: newMessage, error: newError } = processErrorValue(value, message);
      message = newMessage;
      error = newError;
      continue;
    }

    if (!message && typeof value === 'string') {
      message = value;
      continue;
    }

    interpolationValues.push(redactProtectedVariables(value));
  }

  return { message, error, interpolationValues };
}

function buildLogContext(mergingObject: Record<string, unknown>) {
  let context = {};

  if (typeof mergingObject['context'] === 'string') {
    context = {
      name: mergingObject['context'],
    };
  }

  return context;
}

export function createLogger(config: { name: string }) {
  const params: Params = {
    pinoHttp: {
      name: config.name,
      level: process.env['LOG_LEVEL'] ?? 'debug',
      transport:
        process.env['NODE_ENV'] !== 'production'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                singleLine: true,
              },
            }
          : undefined,
      hooks: {
        logMethod(inputArgs, method) {
          const [mergingObject, ...values] = inputArgs as unknown as [{ err?: Error; context?: unknown }, ...unknown[]];

          const { message, error, interpolationValues } = processLogValues(
            mergingObject as Record<string, unknown>,
            values,
          );

          const context = buildLogContext(mergingObject as Record<string, unknown>);

          let params: unknown[] | undefined = [...interpolationValues];
          if (params.length < 1) {
            params = undefined;
          }

          const cls = ClsServiceManager.getClsService();

          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const userId = cls.get('userId');
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const appId = cls.get('appId');
          const requestId = cls.getId();

          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const logData = { context, error, userId, appId, requestId };

          // Use type assertion to bypass strict typing for custom logger method
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          (method as (...args: unknown[]) => void).apply(this, [logData, message, ...(params ?? [])]);
        },
      },
    },
  };

  const pinoLogger = new PinoLogger(params);
  const loggerService = new PinoLoggerService(pinoLogger, {});
  const middlewares = createLoggerMiddlewares({
    logger: pinoLogger.logger,
    serializers: {
      err: (err: Error) => stdSerializers.err(redactProtectedVariables(err)),
      req: (req: IncomingMessage) => stdSerializers.req(redactProtectedVariables(req)),
      res: (res: ServerResponse) => stdSerializers.res(redactProtectedVariables(res)),
    },
  });

  return { logger: loggerService, middlewares };
}
