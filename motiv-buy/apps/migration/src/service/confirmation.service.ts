import * as readline from 'readline';
import type { Logger } from '../type/logger.type';

/**
 * User Confirmation Service
 * 
 * Handles interactive confirmation prompts for destructive operations
 * Following CLAUDE.md security-first principles
 */
export class ConfirmationService {
  constructor(private logger: Logger) {}

  /**
   * Prompt user for confirmation
   */
  async confirm(message: string): Promise<boolean> {
    // In non-interactive environments (CI/CD), default to false for safety
    if (!process.stdin.isTTY) {
      this.logger.warn('Non-interactive environment detected. Use --force flag for automated operations.');
      return false;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    try {
      const answer = await new Promise<string>((resolve) => {
        rl.question(`${message} (yes/no): `, resolve);
      });

      const normalizedAnswer = answer.toLowerCase().trim();
      return ['yes', 'y'].includes(normalizedAnswer);
    } finally {
      rl.close();
    }
  }
}
