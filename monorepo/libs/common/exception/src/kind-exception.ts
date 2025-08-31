import { ExceptionKind } from './const';
import { Exception } from './factory';
import { unknownToError } from '@app/common-shared';


export class InternalException extends Exception({
  kind: ExceptionKind.Internal,
  problemType: 'internal_error',
  title: 'Internal Error',
}) {
  constructor(options?: {
    title?: string;
    detail?: string;
    instance?: string;
    /** @deprecated Use detail instead */ message?: string;
    cause?: unknown;
  }) {
    super({
      title: options?.title,
      detail: options?.detail ?? options?.message ?? 'An internal error occurred',
      instance: options?.instance,
      cause: unknownToError(options?.cause),
    });
  }
}

export class NotImplementedException extends Exception({
  kind: ExceptionKind.Internal,
  problemType: 'not_implemented',
  title: 'Not Implemented',
}) {
  constructor(options?: {
    title?: string;
    detail?: string;
    instance?: string;
    /** @deprecated Use detail instead */ message?: string;
  }) {
    super({
      title: options?.title,
      detail: options?.detail ?? options?.message ?? 'Feature not implemented',
      instance: options?.instance,
    });
  }
}
