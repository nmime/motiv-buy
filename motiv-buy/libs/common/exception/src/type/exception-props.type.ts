import { ClassConstructor, OptionalClassConstructor } from '@app/common/shared';

type BaseExceptionProps = {
  cause?: Error;
  meta?: Record<string, unknown>;
  // RFC 9457 Problem Details fields
  type: string;
  title?: string;
  detail?: string;
  instance?: string;
};

export type ExceptionProps<DataType extends OptionalClassConstructor> = BaseExceptionProps &
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  (DataType extends undefined ? {} : DataType extends ClassConstructor ? { data: InstanceType<DataType> } : never);
