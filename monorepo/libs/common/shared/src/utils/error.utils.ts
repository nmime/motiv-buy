/**
 * Type guard to check if value is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Converts unknown error types to a string message
 * @param error - Any error value
 * @returns Error message as string
 */
export function unknownToError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }

  return String(error);
}

/**
 * Converts unknown error types to a full error object
 * @param error - Any error value
 * @returns Error details object
 */
export function unknownToErrorObject(error: unknown): {
  message: string;
  stack?: string;
  name?: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }

  return {
    message: unknownToError(error),
  };
}

/**
 * Safely extracts error message from unknown error type
 * @deprecated Use unknownToError instead for clarity
 */
export function getErrorMessage(error: unknown): string {
  return unknownToError(error);
}

/**
 * Safely extracts error stack from unknown error type
 */
export function getErrorStack(error: unknown): string | undefined {
  if (isError(error)) {
    return error.stack;
  }

  return undefined;
}

/**
 * Converts unknown error to Error instance
 */
export function toError(error: unknown): Error {
  if (isError(error)) {
    return error;
  }

  return new Error(unknownToError(error));
}

/**
 * Type-safe error handler for catch blocks
 * Returns a structured error object
 */
export function handleError(error: unknown): {
  readonly message: string;
  readonly stack: string | undefined;
  readonly error: Error;
} {
  const errorInstance = toError(error);

  return {
    message: errorInstance.message,
    stack: errorInstance.stack,
    error: errorInstance,
  };
}
