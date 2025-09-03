import { ExceptionKind } from '../const';
import { Exception } from '../factory';

export class NotImplementedException extends Exception({
  kind: ExceptionKind.Internal,
  problemType: 'not_implemented',
  title: 'Not Implemented',
}) {
  constructor(options?: {
    title?: string;
    detail?: string;
    instance?: string;
  }) {
    super({
      title: options?.title,
      detail: options?.detail ?? 'Feature not implemented',
      instance: options?.instance,
    });
  }
}