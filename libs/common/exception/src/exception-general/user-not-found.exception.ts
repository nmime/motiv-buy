import { Exception } from '../factory';
import { ExceptionKind } from '../const';

export class UserNotFoundException extends Exception({
  kind: ExceptionKind.NotFound,
  problemType: 'user_not_found',
  title: 'User Not Found',
}) {
  constructor(message = 'User not found') {
    super({
      detail: message,
    });
  }
}
