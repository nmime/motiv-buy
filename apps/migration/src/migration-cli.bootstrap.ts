import { Command } from 'commander';
import { MikroORM } from '@mikro-orm/core';
import { createMikroOrmConfig, getDatabaseConfig } from '@app/database';
import { MigrationCLI } from './cli';
import { logger } from './util';

// Import migrations to ensure they are compiled into dist
import './migrations-loader';

export async function bootstrap(): Promise<void> {
  const program = new Command();

  program
    .name('migration-cli')
    .description('Database migration management tool for Motiv-Buy project')
    .version('1.0.0');

  let orm: MikroORM | undefined;

  try {
    const dbConfig = getDatabaseConfig();
    const ormConfig = createMikroOrmConfig(dbConfig);

    logger.log('Initializing database connection...');
    orm = await MikroORM.init(ormConfig);

    const migrationCLI = new MigrationCLI(orm, logger);

    migrationCLI.registerCommands(program);

    await program.parseAsync(process.argv);
  } catch (error: unknown) {
    logger.error('Failed to initialize migration CLI:', error);
    throw error;
  } finally {
    if (orm) {
      await orm.close(true);
    }

    process.exit(0);
  }
}
