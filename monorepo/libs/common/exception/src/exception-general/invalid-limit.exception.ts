import { Exception } from '../factory';
import { ExceptionKind } from '../const';

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