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
import { BaseException, ExceptionDto, ExceptionHttpStatusMapper, ExceptionKind } from '@app/common/exception';
import { HttpArgumentsHost } from '@nestjs/common/interfaces';

/**
 * @deprecated Use ProblemResponseTransformer instead for RFC 9457 compliance
 */
@Catch()
@Injectable()
export class ResponseTransformer implements NestInterceptor, ExceptionFilter {
  private readonly logger: Logger = new Logger(this.constructor.name);

  static setup(app: INestApplication) {
    const transformer = new ResponseTransformer();

    app.useGlobalInterceptors(transformer);
    app.useGlobalFilters(transformer);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((result: unknown): unknown => {
        if (Result.isResult(result)) {
          if (!result.ok) {
            return this.handleError(context.switchToHttp(), result.val);
          }

          return result.val;
        }

        if (result instanceof Error) {
          return this.handleError(context.switchToHttp(), result);
        }

        return result;
      }),
      catchError((e) => of(this.handleError(context.switchToHttp(), e))),
    );
  }

  catch(error: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const result = this.handleError(ctx, error);

    ctx.getResponse<Response>().json(result);
  }

  private handleError(context: HttpArgumentsHost, e: unknown): ExceptionDto<unknown> {
    this.logger.error(e);

    const response = context.getResponse<Response>();

    if (e instanceof BaseException) {
      response.status(ExceptionHttpStatusMapper.getHttpStatus(e.kind));

      return new ExceptionDto({
        name: e.constructor.name,
        kind: e.kind,
        message: e.message,
        data: e.data as unknown,
      });
    }

    if (e instanceof HttpException) {
      const messageOrData = e.getResponse();

      response.status(e.getStatus());

      const message = typeof messageOrData === 'string' ? messageOrData : e.message;

      let data: string | object | undefined | null = undefined;
      if (typeof messageOrData === 'object' && !('message' in messageOrData)) {
        data = messageOrData;
      } else if (
        typeof messageOrData === 'object' &&
        'message' in messageOrData &&
        typeof messageOrData.message === 'object'
      ) {
        data = messageOrData.message;
      }

      return new ExceptionDto({
        name: e.constructor.name,
        kind: ExceptionHttpStatusMapper.getKind(e.getStatus()),
        message,
        data,
      });
    }

    response.status(500);

    return new ExceptionDto({
      name: 'UnexpectedException',
      kind: ExceptionKind.Internal,
      message: 'Internal Server Error',
      data: undefined,
    });
  }
}
