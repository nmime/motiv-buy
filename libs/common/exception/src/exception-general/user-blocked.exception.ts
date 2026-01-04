import { Exception } from '../factory';
import { ExceptionKind } from '../const';

export class UserBlockedException extends Exception({
  kind: ExceptionKind.Forbidden,
  problemType: 'user_blocked',
  title: 'User Blocked',
}) {
  constructor(message = 'You are blocked') {
    super({
      detail: message,
    });
  }
}
