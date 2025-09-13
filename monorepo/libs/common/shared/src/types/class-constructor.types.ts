export type ClassConstructor<T = {}> = new (...args: any[]) => T;

export type OptionalClassConstructor<T = {}> = ClassConstructor<T> | undefined;

import { Result } from 'ts-results';

export type AsyncResult<T, E> = Promise<Result<T, E>>;
