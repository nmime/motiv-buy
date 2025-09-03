import { ExceptionKind } from '../const';
import { Exception } from '../factory';
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
    cause?: unknown;
  }) {
    super({
      title: options?.title,
      detail: options?.detail ?? 'An internal error occurred',
      instance: options?.instance,
      cause: unknownToError(options?.cause),
    });
  }
}