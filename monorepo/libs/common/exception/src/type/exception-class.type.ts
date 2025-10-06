import { ExceptionKind } from '../const';
import { BaseException } from '../abstract';
import { OptionalClassConstructor } from '@app/common-shared';

// Flexible exception constructor type that accepts any arguments
// Note: Using `any[]` here is intentional for type variance - it allows
// exception constructors with specific parameter types to be accepted.
// This is a type-level construct, not runtime code.

export type ExceptionClass<DataType extends OptionalClassConstructor = undefined> = (abstract new (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any[]
) => BaseException<DataType>) & {
  readonly kind: ExceptionKind;
  readonly dataType?: DataType;
  readonly problemType?: string;
  readonly title?: string;
};
