/**
 * Result utility functions for creating Ok and Err results
 * Provides functional approach for error handling using Result pattern
 */

/**
 * Creates a successful result with data
 * @param data The success data
 * @returns Success result object
 */
export function Ok<T>(data: T): { success: true; data: T } {
  return { success: true, data };
}

/**
 * Creates an error result with error
 * @param error The error object
 * @returns Error result object
 */
export function Err<E>(error: E): { success: false; error: E } {
  return { success: false, error };
}

/**
 * Type guard to check if result is successful
 * @param result The result to check
 * @returns True if result is successful
 */
export function isOk<T, E>(result: { success: true; data: T } | { success: false; error: E }): result is { success: true; data: T } {
  return result.success === true;
}

/**
 * Type guard to check if result is error
 * @param result The result to check
 * @returns True if result is error
 */
export function isErr<T, E>(result: { success: true; data: T } | { success: false; error: E }): result is { success: false; error: E } {
  return result.success === false;
}