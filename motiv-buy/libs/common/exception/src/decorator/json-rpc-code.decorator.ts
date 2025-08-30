import { SocketExceptionCode } from '../const';

const jsonRpcCode = Symbol('JsonRpcCode');

// eslint-disable-next-line @typescript-eslint/naming-convention
export function JsonRpcCode(code: SocketExceptionCode): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(jsonRpcCode, code, target);
  };
}

export function getJsonRpcCode(exception: unknown): number | undefined {
  if (exception && exception.constructor) {
    return Reflect.getMetadata(jsonRpcCode, exception.constructor) as number | undefined;
  }

  return undefined;
}
