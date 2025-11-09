import { Logger as PinoLoggerService, PinoLogger } from 'nestjs-pino';
import { SerializedError } from 'pino-std-serializers';

import { pinoHttp, stdSerializers } from 'pino-http';

import { storage, Store } from 'nestjs-pino/storage';
import { Params } from 'nestjs-pino/params';
import { IncomingMessage, ServerResponse } from 'http';
import { ClsServiceManager } from 'nestjs-cls';
import { FastifyReply, FastifyRequest } from 'fastify';

// Interface for requests with logger properties (extended by pino middleware)
interface LoggerRequest {
  log?: import('pino').Logger;
  allLogs?: import('pino').Logger[];
}

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
    let { log } = req;

    if (!useExisting && req.allLogs && req.allLogs.length > 0) {
      log = req.allLogs[req.allLogs.length - 1];
    }

    storage.run(new Store(log), next);
  };
}

function createLoggerMiddlewares(params: Record<string, unknown>, useExisting = false) {
  if (useExisting) {
    return [bindLoggerMiddlewareFactory(useExisting)];
  }

  const middleware = pinoHttp(...(Array.isArray(params) ? params : [params]));

  // Type assertion required: NestJS library workaround to set readonly root logger
  // PinoLogger.root is readonly by design, but must be set during initialization
  // This is the official pattern recommended by nestjs-pino documentation
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
    // Type assertion required: Generic function return type with runtime type checking
    // TypeScript cannot infer T from the string redaction, but we've verified it's a string
    return redactSensitiveStrings(obj) as unknown as T;
  }

  if (!obj || typeof obj !== 'object') {
    // Type assertion required: Generic function return type for primitive types
    // Runtime check confirms non-object types can be safely returned as T
    return obj as T;
  }

  const copy: Record<string, unknown> | unknown[] = Array.isArray(obj) ? [] : {};

  if (Array.isArray(copy)) {
    // Type assertion required: Array element access with proper type checking
    // obj is verified as array, so indexing is safe
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

          const userId = cls.get('userId');

          const appId = cls.get('appId');
          const requestId = cls.getId();

          const logData = { context, error, userId, appId, requestId };

          // Use type assertion to bypass strict typing for custom logger method

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
