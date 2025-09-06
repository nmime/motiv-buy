import { Exception } from '../factory';
import { ExceptionKind } from '../const';

export class RateLimitExceedException extends Exception({
  kind: ExceptionKind.RateLimitExceed,
  problemType: 'rate_limit_exceeded',
  title: 'Rate limit exceeded',
}) {
  constructor(options?: { title?: string; detail?: string; instance?: string }) {
    super({
      title: options?.title,
      detail: options?.detail ?? 'Rate limit exceeded. Please try again later.',
      instance: options?.instance,
    });
  }
}
