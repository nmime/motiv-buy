import { Logger as PinoLoggerService, PinoLogger } from 'nestjs-pino';
import { SerializedError } from 'pino-std-serializers';

import { pinoHttp, stdSerializers } from 'pino-http';
import * as express from 'express';

import { Store, storage } from 'nestjs-pino/storage';
import { Params } from 'nestjs-pino/params';
import { IncomingMessage, ServerResponse } from 'http';
import { ClsServiceManager } from 'nestjs-cls';

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
  return function bindLoggerMiddleware(req: express.Request, _res: express.Response, next: express.NextFunction) {
    let { log } = req;

    if (!useExisting && req.allLogs) {
      log = req.allLogs[req.allLogs.length - 1]!;
    }

    storage.run(new Store(log), next);
  };
}

function createLoggerMiddlewares(params: object, useExisting = false) {
  if (useExisting) {
    return [bindLoggerMiddlewareFactory(useExisting)];
  }

  const middleware = pinoHttp(...(Array.isArray(params) ? params : [params]));

  // Set the root logger using type assertion to bypass readonly restriction
  (PinoLogger as any).root = middleware.logger;


  return [middleware, bindLoggerMiddlewareFactory(useExisting)];
}

function redactSensitiveStrings(str: string): string {
  return protectedVariables.reduce((acc, key) => {
    const regex = new RegExp(`(${key})["']?[:=]\\s*["']?[^"'\n ]+`, 'gi');

    return acc.replace(regex, `$1="[redacted]"`);
  }, str);
}

function replaceProtectedVariables<T>(obj: any): T {
  if (typeof obj === 'string') {
    return redactSensitiveStrings(obj) as unknown as T;
  }

  if (!obj || typeof obj !== 'object') {
    return obj as T;
  }

  const copy: any = Array.isArray(obj) ? [] : {};

  for (const key of Object.keys(obj)) {
    const value = obj[key];

    if (protectedVariables.includes(key.toLowerCase())) {
      copy[key] = '[redacted]';
    } else if (typeof value === 'string') {
      copy[key] = redactSensitiveStrings(value);
    } else if (typeof value === 'object') {
      copy[key] = replaceProtectedVariables(value);
    } else {
      copy[key] = value;
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
    obj = stdSerializers.err(obj) as any;
  }

  const copy: any = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      copy[key] = copyWithDepthLimit(obj[key], depthLimit, currentDepth + 1);
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

  } catch (error: any) {
    return error?.message ?? 'Error while redacting protected variables';
  }
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
        logMethod(inputArgs, method, level) {
          const [mergingObject, ...values] = inputArgs as unknown as [{ err?: Error; context?: unknown }, ...unknown[]];

          let message = '';

          let error: SerializedError | undefined = undefined;
          const interpolationValues = [];

          for (const value of [mergingObject['err'], ...values]) {
            if (value === undefined) {
              continue;
            }

            if (!error && value instanceof Error) {
              error = redactProtectedVariables(value) as unknown as SerializedError;

              if (typeof error === 'string') {
                if (!message) {
                  message = error;
                }

                continue;
              }

              if (!message) {
                message = error.message;
              }

              continue;
            }

            if (!message && typeof value === 'string') {
              message = value;
              continue;
            }

            interpolationValues.push(redactProtectedVariables(value));
          }

          let context = {};
          let params: unknown[] | undefined = [...interpolationValues];

          if (typeof mergingObject['context'] === 'string') {
            context = {
              name: mergingObject['context'],
            };
          }

          if (params.length < 1) {
            params = undefined;
          }

          const cls = ClsServiceManager.getClsService();

          const userId = cls.get('userId');
          const appId = cls.get('appId');
          const requestId = cls.getId();

          const logData = { context, error, userId, appId, requestId };
          
          // Use type assertion to bypass strict typing for custom logger method
          (method as any).apply(this, [logData, message, ...(params ?? [])]);
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
