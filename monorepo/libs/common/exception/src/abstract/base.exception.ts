import { OptionalClassConstructor } from '@app/common-shared';
import { ExceptionKind } from '../const';
import { ExceptionProps } from '../type';

export abstract class BaseException<DataType extends OptionalClassConstructor> extends Error {
  kind: ExceptionKind;

  override message: string;

  override cause?: Error;

  data: InstanceType<DataType>;

  meta?: Record<string, unknown>;

  type: string;
  title?: string;
  detail?: string;
  instance?: string;

  protected constructor(kind: ExceptionKind, props: ExceptionProps<DataType>) {
    super(props.message ?? props.detail ?? props.title ?? 'An error occurred');

    Error.captureStackTrace(this, this.constructor);

    this.kind = kind;

    this.message = props.message ?? props.detail ?? props.title ?? 'An error occurred';
    this.cause = props.cause;

    if ('data' in props) {
      this.data = props.data as InstanceType<DataType>;
    }

    this.meta = props.meta;

    const exceptionClass = this.constructor as typeof BaseException & { problemType?: string };
    this.type = props.type ?? exceptionClass.problemType ?? 'internal_error';

    if ('title' in props) {
      this.title = props.title;
    }

    if ('detail' in props) {
      this.detail = props.detail;
    }

    if ('instance' in props) {
      this.instance = props.instance;
    }
  }

  /**
   * By default, in Node.js Error objects are not
   * serialized properly when sending plain objects
   * to external processes. This method is a workaround.
   */
  toJSON() {
    return {
      message: this.message,
      kind: this.kind,
      stack: this.stack,
      cause: JSON.stringify(this.cause),
      expose: this.data,
      meta: this.meta,
      type: this.type,
      title: this.title,
      detail: this.detail,
      instance: this.instance,
    };
  }
}
