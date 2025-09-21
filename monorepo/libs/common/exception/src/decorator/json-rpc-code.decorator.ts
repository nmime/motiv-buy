import { SocketExceptionCode } from '../const';

const jsonRpcCodeMetadataKey = 'JsonRpcCode';

export function jsonRpcCode(code: SocketExceptionCode): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(jsonRpcCodeMetadataKey, code, target);
  };
}

export function getJsonRpcCode(exception: unknown): number | undefined {
  if (exception && exception.constructor) {
    return Reflect.getMetadata(jsonRpcCodeMetadataKey, exception.constructor) as number | undefined;
  }

  return undefined;
}
