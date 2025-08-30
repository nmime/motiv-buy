import { OptionalClassConstructor } from '@app/common/shared';
import { ExceptionKind } from '../const';
import { ExceptionProps } from '../type';

export abstract class BaseException<DataType extends OptionalClassConstructor> extends Error {
  kind: ExceptionKind;

  override message: string;

  // Underlying error that caused this exception.
  override cause?: Error;

  // Exposed to user data if it doesn't catch by application.
  // @ts-expect-error TS(2564) FIXME: Property 'data' has no initializer and is not defi... Remove this comment to see the full error message
  data: InstanceType<DataType>;

  meta?: Record<string, unknown>;

  // RFC 9457 Problem Details fields
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
      // @ts-expect-error TS(2339) FIXME: Property 'data' does not exist on type 'never'.
      this.data = props.data as InstanceType<DataType>;
    }

    this.meta = props.meta;

    // RFC 9457 Problem Details fields
    // Use the provided type or fall back to the class's static problemType
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
      // RFC 9457 fields
      type: this.type,
      title: this.title,
      detail: this.detail,
      instance: this.instance,
    };
  }
}
