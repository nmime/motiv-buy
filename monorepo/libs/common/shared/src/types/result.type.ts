/**
 * Result Type System - Re-exports from ts-results
 */

import { toError } from '../utils/error.utils';
import type { Result as TsResult } from 'ts-results';
import { Ok as TsOk, Err as TsErr } from 'ts-results';

export { Ok, Err, Some, None } from 'ts-results';
export type { Result } from 'ts-results';
export type { AsyncResult } from './class-constructor.types';

export function isOk<T, E>(result: TsResult<T, E>): result is TsResult<T, never> {
  return result.ok;
}

export function isErr<T, E>(result: TsResult<T, E>): result is TsResult<never, E> {
  return result.err;
}

export function unwrapOr<T, E>(result: TsResult<T, E>, defaultValue: T): T {
  return result.unwrapOr(defaultValue);
}

export function unwrapOrElse<T, E>(result: TsResult<T, E>, fn: (error: E) => T): T {
  return result.ok ? result.val : fn(result.val);
}

export function map<T, U, E>(result: TsResult<T, E>, fn: (value: T) => U): TsResult<U, E> {
  return result.map(fn);
}

export function mapErr<T, E, F>(result: TsResult<T, E>, fn: (error: E) => F): TsResult<T, F> {
  return result.mapErr(fn);
}

export function andThen<T, U, E>(result: TsResult<T, E>, fn: (value: T) => TsResult<U, E>): TsResult<T | U, E> {
  return result.andThen(fn);
}

export function all<T, E>(results: TsResult<T, E>[]): TsResult<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (result.err) {
      return TsErr(result.val);
    }

    values.push(result.val);
  }

  return TsOk(values);
}

export function any<T, E>(results: TsResult<T, E>[]): TsResult<T, E> {
  let lastErr: TsResult<T, E> | null = null;
  for (const result of results) {
    if (result.ok) {
      return result;
    }

    lastErr = result;
  }

  return lastErr ?? TsErr(new Error('Empty results array') as unknown as E);
}

export function tryCatch<T>(fn: () => T): TsResult<T, Error> {
  try {
    return TsOk(fn());
  } catch (error: unknown) {
    return TsErr(toError(error));
  }
}

export function tryCatchAsync<T>(fn: () => Promise<T>): Promise<TsResult<T, Error>> {
  return (async () => {
    try {
      return TsOk(await fn());
    } catch (error: unknown) {
      return TsErr(toError(error));
    }
  })();
}

export function fromNullable<T, E>(value: T | null | undefined, error: E): TsResult<T, E> {
  return value !== null && value !== undefined ? TsOk(value) : TsErr(error);
}

export function toNullable<T, E>(result: TsResult<T, E>): T | null {
  return result.ok ? result.val : null;
}

export function isResult<T, E>(value: unknown): value is TsResult<T, E> {
  return value !== null && value !== undefined && typeof value === 'object' && 'ok' in value && 'err' in value;
}

export function match<T, E>(
  result: TsResult<T, E>,
  handlers: { ok: (value: T) => void; err: (error: E) => void },
): void {
  if (result.ok) {
    handlers.ok(result.val);
  } else {
    handlers.err(result.val);
  }
}

export function matchMap<T, E, U>(result: TsResult<T, E>, handlers: { ok: (value: T) => U; err: (error: E) => U }): U {
  return result.ok ? handlers.ok(result.val) : handlers.err(result.val);
}

export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DomainError';
    Object.setPrototypeOf(this, DomainError.prototype);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'NOT_FOUND', context);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'UNAUTHORIZED', context);
    this.name = 'UnauthorizedError';
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'FORBIDDEN', context);
    this.name = 'ForbiddenError';
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFLICT', context);
    this.name = 'ConflictError';
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class InternalError extends DomainError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'INTERNAL_ERROR', context);
    this.name = 'InternalError';
    Object.setPrototypeOf(this, InternalError.prototype);
  }
}

export type DomainResult<T> = TsResult<T, DomainError>;
export type AsyncDomainResult<T> = Promise<TsResult<T, DomainError>>;
