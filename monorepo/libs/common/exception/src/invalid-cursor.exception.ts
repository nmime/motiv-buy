import { ExceptionKind } from './const';
import { Exception } from './factory';

export class InvalidCursorException extends Exception({
  kind: ExceptionKind.Validation,
  problemType: 'validation_error',
  title: 'Invalid cursor',
}) {
  constructor() {
    super({
      detail: 'Invalid cursor provided',
    });
  }
}
