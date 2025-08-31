import { CallHandler, ExecutionContext, HttpException, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { catchError, map, Observable, of } from 'rxjs';
import { Result } from 'ts-results';
import {
  BaseException,
  ExceptionHttpStatusMapper,
  ExceptionKind,
  getJsonRpcCode,
  SocketExceptionCode,
  SocketExceptionDto,
  SocketExceptionErrorDto,
} from '@app/common-exception';
import { WsException } from '@nestjs/websockets';
import { WsArgumentsHost } from '@nestjs/common/interfaces/features/arguments-host.interface';
import { SocketResponseDto, SocketResultResponseDto } from '@app/common-shared';

@Injectable()
export class WebSocketResponseTransformer implements NestInterceptor {
  private readonly logger: Logger = new Logger(this.constructor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((result: unknown): unknown => {
        if (Result.isResult(result)) {
          if (!result.ok) {
            return this.handleError(context.switchToWs(), result.val);
          }

          return this.handleSuccess(context.switchToWs(), result.val);
        }

        if (result instanceof Error) {
          return this.handleError(context.switchToWs(), result);
        }

        return this.handleSuccess(context.switchToWs(), result);
      }),
      catchError((e) => of(this.handleError(context.switchToWs(), e))),
    );
  }

  private handleSuccess(context: WsArgumentsHost, result: unknown): SocketResponseDto<SocketResultResponseDto> {
    const preparedResult = result && typeof result === 'object' ? result : {};

    return new SocketResponseDto({
      id: this.getRequestId(context),
      result: {
        ...preparedResult,
        success: true,
      },
    });
  }

  private handleError(context: WsArgumentsHost, e: unknown): SocketExceptionDto<unknown> {
    this.logger.error(e);

    if (e instanceof BaseException) {
      return new SocketExceptionDto({
        id: this.getRequestId(context),
        error: new SocketExceptionErrorDto<unknown>({
          code: getJsonRpcCode(e) ?? this.kindToSocketExceptionCode(e.kind),
          message: e.message,
          data: e.data as unknown,
        }),
      });
    }

    if (e instanceof HttpException) {
      return this.httpExceptionToExceptionDto(context, e);
    }

    if (e instanceof WsException) {
      return this.wsExceptionToExceptionDto(context, e);
    }

    return new SocketExceptionDto({
      id: this.getRequestId(context),
      error: new SocketExceptionErrorDto<unknown>({
        code: SocketExceptionCode.InternalError,
        message: 'Internal Server Error',
        data: undefined,
      }),
    });
  }

  private httpExceptionToExceptionDto(context: WsArgumentsHost, e: HttpException): SocketExceptionDto<unknown> {
    const messageOrData = e.getResponse();

    const message = typeof messageOrData === 'string' ? messageOrData : e.message;
    const data = this.getExceptionData(messageOrData);

    return new SocketExceptionDto({
      id: this.getRequestId(context),
      error: new SocketExceptionErrorDto<unknown>({
        code: this.kindToSocketExceptionCode(ExceptionHttpStatusMapper.getKind(e.getStatus())),
        message,
        data,
      }),
    });
  }

  private wsExceptionToExceptionDto(context: WsArgumentsHost, e: WsException): SocketExceptionDto<unknown> {
    const messageOrData = e.getError();

    const message = typeof messageOrData === 'string' ? messageOrData : e.message;
    const data = this.getExceptionData(messageOrData);

    return new SocketExceptionDto({
      id: this.getRequestId(context),
      error: new SocketExceptionErrorDto<unknown>({
        code: SocketExceptionCode.InternalError,
        message,
        data,
      }),
    });
  }

  private getExceptionData(messageOrData: string | object) {
    if (typeof messageOrData === 'object' && !('message' in messageOrData)) {
      return messageOrData;
    } else if (
      typeof messageOrData === 'object' &&
      'message' in messageOrData &&
      typeof messageOrData.message === 'object'
    ) {
      return messageOrData.message;
    }

    return undefined;
  }

  private getRequestId(context: WsArgumentsHost): string | null {
    const requestData = context.getData<unknown>();
    if (!requestData || typeof requestData !== 'object') {
      return null;
    }

    if (!('id' in requestData)) {
      return null;
    }

    if (typeof requestData.id !== 'string') {
      return null;
    }

    return requestData.id;
  }

  private kindToSocketExceptionCode(kind: ExceptionKind): SocketExceptionCode {
    const mapping: Record<ExceptionKind, SocketExceptionCode> = {
      [ExceptionKind.ClientDataValidation]: SocketExceptionCode.InvalidParams,
      [ExceptionKind.Validation]: SocketExceptionCode.InvalidParams,
      [ExceptionKind.Unauthorized]: SocketExceptionCode.MethodNotFound,
      [ExceptionKind.Forbidden]: SocketExceptionCode.MethodNotFound,
      [ExceptionKind.NotFound]: SocketExceptionCode.InvalidParams,
      [ExceptionKind.Conflict]: SocketExceptionCode.InternalError,
      [ExceptionKind.RateLimitExceed]: SocketExceptionCode.InternalError,
      [ExceptionKind.Internal]: SocketExceptionCode.InternalError,
    };

    return mapping[kind];
  }
}
