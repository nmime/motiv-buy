import { Exception } from '../factory';
import { ExceptionKind } from '../const';

export class BadTokenException extends Exception({
  kind: ExceptionKind.Unauthorized,
  problemType: 'bad_token',
  title: 'Bad Token',
}) {
  constructor(message = 'Invalid token') {
    super({
      detail: message,
    });
  }
}
