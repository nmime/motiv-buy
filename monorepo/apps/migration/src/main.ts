#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { bootstrap } from './migration-cli.bootstrap';
import { logger } from './util';

async function main(): Promise<void> {
  try {
    await bootstrap();
  } catch (error) {
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
  main();
}
