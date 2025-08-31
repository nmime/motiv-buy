import { ExceptionKind } from '../const';
import { BaseException } from '../abstract';
import { OptionalClassConstructor } from '@app/common-shared';

export type ExceptionClass<DataType extends OptionalClassConstructor> = (new (
  ...args: any[]
) => BaseException<DataType>) & {
  kind: ExceptionKind;
  dataType: DataType;
  problemType: string;
  title?: string;
};
