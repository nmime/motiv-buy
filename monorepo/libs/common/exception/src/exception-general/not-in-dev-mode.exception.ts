import { Exception } from '../factory';
import { ExceptionKind } from '../const';

export class NotInDevModeException extends Exception({
  kind: ExceptionKind.Forbidden,
  problemType: 'not_in_dev_mode',
  title: 'Not In Development Mode',
}) {
  constructor(message: string = 'Not in development mode') {
    super({
      detail: message,
    });
  }
}