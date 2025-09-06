#!/usr/bin/env node

/**
 * Migration CLI Application
 *
 * Domain-driven migration tool following CLAUDE.md patterns:
 * - Security-first approach with environment validation
 * - Clean architecture with dependency injection
 * - Comprehensive error handling and logging
 * - SPARC methodology compliance
 */

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
