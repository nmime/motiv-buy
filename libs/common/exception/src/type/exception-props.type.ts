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
  (DataType extends undefined
    ? Record<string, never>
    : DataType extends ClassConstructor
      ? { data: InstanceType<DataType> }
      : never);
