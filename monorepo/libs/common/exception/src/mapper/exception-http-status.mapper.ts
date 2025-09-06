import { HttpStatus } from '@nestjs/common';
import { ExceptionKind } from '../const';

const exceptionKindToHttpStatusRecord: Record<ExceptionKind, HttpStatus> = {
  [ExceptionKind.ClientDataValidation]: 400,

  [ExceptionKind.Validation]: 400,
  [ExceptionKind.Unauthorized]: 401,
  [ExceptionKind.Forbidden]: 403,
  [ExceptionKind.NotFound]: 404,
  [ExceptionKind.Conflict]: 409,

  [ExceptionKind.RateLimitExceed]: 429,

  [ExceptionKind.Internal]: 500,
};

const httpStatusToExceptionKindRecord = Object.entries(exceptionKindToHttpStatusRecord).reduce(
  (acm, [kind, status]) => {
    acm[status] = kind as ExceptionKind;

    return acm;
  },
  {} as { [status in HttpStatus]?: ExceptionKind },
);

export class ExceptionHttpStatusMapper {
  static getHttpStatus(kind: ExceptionKind): HttpStatus {
    return exceptionKindToHttpStatusRecord[kind];
  }

  static getKind(status: HttpStatus): ExceptionKind {
    return httpStatusToExceptionKindRecord[status] ?? ExceptionKind.Internal;
  }
}
