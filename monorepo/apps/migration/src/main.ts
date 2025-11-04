#!/usr/bin/env node

import dotenv from 'dotenv';
import { bootstrap } from './migration-cli.bootstrap';
import { logger } from './util';

dotenv.config({ path: '.env' });

async function main(): Promise<void> {
  try {
    await bootstrap();
  } catch (error: unknown) {
    logger.error('Migration CLI failed to start:', error);
    process.exit(1);
  }
}

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled Rejection:', reason);
  process.exit(1);
});

if (require.main === module) {
  void main();
}
