import { Exception } from '../factory';
import { ExceptionKind } from '../const';

export class UnauthorizedException extends Exception({
  kind: ExceptionKind.Unauthorized,
  problemType: 'unauthorized',
  title: 'Unauthorized',
}) {
  constructor(message = 'Unauthorized') {
    super({
      detail: message,
    });
  }
}
