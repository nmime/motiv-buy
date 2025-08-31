export type ClassConstructor<T = {}> = new (...args: any[]) => T;

export type OptionalClassConstructor<T = {}> = ClassConstructor<T> | undefined;

export type AsyncResult<T, E = Error> = Promise<{ success: true; data: T } | { success: false; error: E }>;