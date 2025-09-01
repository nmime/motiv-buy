/* eslint-disable @typescript-eslint/naming-convention */
import { BaseException } from '../abstract';
import { ExceptionKind } from '../const';
import { ExceptionClass, ExceptionProps } from '../type';
import { OptionalClassConstructor } from '@app/common-shared';

type Params<DataType extends OptionalClassConstructor = undefined> = {
  kind?: ExceptionKind;
  dataType?: DataType;
  problemType?: string;
  title?: string;
};

export function Exception<DataType extends OptionalClassConstructor = undefined>(
  options: Params<DataType>,
): ExceptionClass<DataType>;
export function Exception<DataType extends OptionalClassConstructor = undefined>(
  kindOrOptions?: ExceptionKind | Params<DataType>,
  dataTypeParam?: DataType,
  problemTypeParam?: string,
  titleParam?: string,
): ExceptionClass<DataType> {
  let kind: ExceptionKind;
  let dataType: DataType | undefined;
  let problemType: string;
  let title: string | undefined;

  if (kindOrOptions && typeof kindOrOptions === 'object') {
    const {
      kind: optionsKind,
      dataType: optionsDataType,
      problemType: optionsProblemType,
      title: optionsTitle,
    } = kindOrOptions;

    kind = optionsKind ?? ExceptionKind.Internal;
    dataType = optionsDataType;
    problemType = optionsProblemType ?? 'internal_error';
    title = optionsTitle;
  } else {
    kind = (kindOrOptions as ExceptionKind) ?? ExceptionKind.Internal;
    dataType = dataTypeParam;
    problemType = problemTypeParam ?? 'internal_error';
    title = titleParam;
  }

  const ExceptionClass = class extends BaseException<DataType> {
    static readonly kind: ExceptionKind = kind;
    static readonly dataType = dataType;
    static readonly problemType = problemType;
    static readonly title = title;

    constructor(props: Omit<ExceptionProps<DataType>, 'type'>) {
      const finalTitle = props.title || title;
      super(kind, { ...props, type: problemType, title: finalTitle } as ExceptionProps<DataType>);
    }
  };

  return ExceptionClass as ExceptionClass<DataType>;
}
