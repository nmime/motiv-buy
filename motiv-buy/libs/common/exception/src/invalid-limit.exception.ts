import { ExceptionKind } from './const';
import { Exception } from './factory';

export class InvalidLimitException extends Exception({
  kind: ExceptionKind.Validation,
  problemType: 'validation_error',
  title: 'Invalid limit',
}) {
  constructor() {
    super({
      detail: 'Invalid limit provided',
    });
  }
}
