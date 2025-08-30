// Class constructor types for exception handling
export type ClassConstructor<T = {}> = new (...args: any[]) => T;

export type OptionalClassConstructor<T = {}> = ClassConstructor<T> | undefined;

// Async result type for operations that may fail
export type AsyncResult<T, E = Error> = Promise<{ success: true; data: T } | { success: false; error: E }>;