import type { Logger } from '../type/logger.type';

/**
 * Simple structured logger for CLI operations
 * Follows CLAUDE.md observable systems principles with structured logging
 */
class CLILogger implements Logger {
  private formatMessage(level: string, message: string, context?: unknown): string {
    const timestamp = new Date().toISOString();
    const baseLog = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    if (context) {
      return `${baseLog}\n${JSON.stringify(context, null, 2)}`;
    }

    return baseLog;
  }

  info(message: string, context?: unknown): void {
    console.info(this.formatMessage('info', message, context));
  }

  warn(message: string, context?: unknown): void {
    console.warn(this.formatMessage('warn', message, context));
  }

  error(message: string, context?: unknown): void {
    console.error(this.formatMessage('error', message, context));
  }

  debug(message: string, context?: unknown): void {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
      console.debug(this.formatMessage('debug', message, context));
    }
  }
}

export const logger = new CLILogger();
