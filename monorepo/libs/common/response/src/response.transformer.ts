import {
  ArgumentsHost,
  CallHandler,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  HttpException,
  INestApplication,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { catchError, map, Observable, of } from 'rxjs';
import { Result } from 'ts-results';
import { Response } from 'express';

@Catch()
@Injectable()
export class ResponseTransformer implements NestInterceptor, ExceptionFilter {
  private readonly logger: Logger = new Logger(this.constructor.name);

  static setup(app: INestApplication): void {
    const transformer = app.get(ResponseTransformer);
    app.useGlobalInterceptors(transformer);
    app.useGlobalFilters(transformer);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((result: unknown): unknown => {
        if (Result.isResult(result)) {
          if (!result.ok) {
            throw result.val;
          }
          return result.val;
        }

        if (result instanceof Error) {
          throw result;
        }

        return result;
      }),
      catchError((e) => {
        throw e;
      }),
    );
  }

  catch(error: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    this.logger.error(error);

    if (error instanceof HttpException) {
      const status = error.getStatus();
      const errorResponse = error.getResponse();

      response.status(status).json({
        statusCode: status,
        message: typeof errorResponse === 'string' ? errorResponse : error.message,
        error: error.name,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Handle unknown errors
    response.status(500).json({
      statusCode: 500,
      message: 'Internal server error',
      error: 'InternalServerError',
      timestamp: new Date().toISOString(),
    });
  }
}
