import { Command } from 'commander';
import { MikroORM } from '@mikro-orm/core';
import { getDatabaseConfig, createMikroOrmConfig } from '@app/database';
import { MigrationCLI } from './cli';
import { logger } from './util';

export async function bootstrap(): Promise<void> {
  const program = new Command();

  program
    .name('migration-cli')
    .description('Database migration management tool for Motiv-Buy project')
    .version('1.0.0');

  try {
    const dbConfig = getDatabaseConfig();
    const ormConfig = createMikroOrmConfig(dbConfig);

    logger.log('Initializing database connection...');
    const orm = await MikroORM.init(ormConfig);

    const migrationCLI = new MigrationCLI(orm, logger);

    migrationCLI.registerCommands(program);

    await program.parseAsync(process.argv);
  } catch (error: unknown) {
    logger.error('Failed to initialize migration CLI:', error);
    throw error;
  }
}
