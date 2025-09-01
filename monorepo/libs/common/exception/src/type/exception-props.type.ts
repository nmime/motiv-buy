import { ClassConstructor, OptionalClassConstructor } from '@app/common-shared';

type BaseExceptionProps = {
  message?: string;
  cause?: Error;
  meta?: Record<string, unknown>;
  type?: string;
  title?: string;
  detail?: string;
  instance?: string;
};

export type ExceptionProps<DataType extends OptionalClassConstructor> = BaseExceptionProps &
  (DataType extends undefined ? {} : DataType extends ClassConstructor ? { data: InstanceType<DataType> } : never);
