import { Exception, ExceptionKind, JsonRpcCode, SocketExceptionCode } from '@app/common/exception';

@JsonRpcCode(SocketExceptionCode.Unauthorized)
export class UnauthorizedException extends Exception(ExceptionKind.Unauthorized) {
  constructor() {
    super({
      message: 'Unauthorized',
    });
  }
}
