import { SocketExceptionCode } from '../const';

const JSON_RPC_CODE_METADATA_KEY = 'JsonRpcCode';

export function jsonRpcCode(code: SocketExceptionCode): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(JSON_RPC_CODE_METADATA_KEY, code, target);
  };
}

export function getJsonRpcCode(exception: unknown): number | undefined {
  if (exception && exception.constructor) {
    return Reflect.getMetadata(JSON_RPC_CODE_METADATA_KEY, exception.constructor) as number | undefined;
  }

  return undefined;
}
