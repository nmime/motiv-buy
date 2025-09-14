// eslint-disable-next-line @typescript-eslint/no-restricted-types
export type ClassConstructor<T = object> = new (...args: unknown[]) => T;

// eslint-disable-next-line @typescript-eslint/no-restricted-types
export type OptionalClassConstructor<T = object> = ClassConstructor<T> | undefined;

import { Result } from 'ts-results';

export type AsyncResult<T, E> = Promise<Result<T, E>>;
