import * as readline from 'readline';
import { Logger } from '@nestjs/common';

export class ConfirmationService {
  constructor(private logger: Logger) {}

  async confirm(message: string): Promise<boolean> {
    if (!process.stdin.isTTY) {
      this.logger.warn('Non-interactive environment detected. Use --force flag for automated operations.');

      return false;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
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
