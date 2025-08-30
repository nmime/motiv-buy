/**
 * Logger interface for CLI operations
 * Following CLAUDE.md principles for clean interfaces
 */
export interface Logger {
  info(message: string, context?: unknown): void;
  warn(message: string, context?: unknown): void;
  error(message: string, context?: unknown): void;
  debug(message: string, context?: unknown): void;
}