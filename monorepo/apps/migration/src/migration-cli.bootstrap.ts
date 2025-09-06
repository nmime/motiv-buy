import { Command } from 'commander';
import { MikroORM } from '@mikro-orm/core';
import { getDatabaseConfig, createMikroOrmConfig } from '../../../libs/database/src';
import { MigrationCLI } from './cli/migration.cli';
import { logger } from './util/logger.util';

/**
 * Bootstrap the migration CLI application
 * Follows CLAUDE.md security-first and error handling principles
 */
export async function bootstrap(): Promise<void> {
  const program = new Command();

  program
    .name('migration-cli')
    .description('Database migration management tool for Motiv-Buy project')
    .version('1.0.0');

  try {
    const dbConfig = getDatabaseConfig();
    const ormConfig = createMikroOrmConfig(dbConfig);

    logger.info('Initializing database connection...');
    const orm = await MikroORM.init(ormConfig);

    const migrationCLI = new MigrationCLI(orm, logger);

    migrationCLI.registerCommands(program);

    await program.parseAsync(process.argv);
  } catch (error) {
    logger.error('Failed to initialize migration CLI:', error);
    throw error;
  }
}
