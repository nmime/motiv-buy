import { Command } from 'commander';
import { MikroORM } from '@mikro-orm/core';
import { Logger } from '@nestjs/common';
import { MigrationController } from './migration.controller';
export class MigrationCLI {
  private controller: MigrationController;

  constructor(
    private orm: MikroORM,
    private logger: Logger,
  ) {
    this.controller = new MigrationController(orm, logger);
  }

  registerCommands(program: Command): void {
    this.registerCreateCommand(program);
    this.registerUpCommand(program);
    this.registerDownCommand(program);
    this.registerStatusCommand(program);
    this.registerFreshCommand(program);
    this.registerSeedCommand(program);
  }

  private registerCreateCommand(program: Command): void {
    program
      .command('create <name>')
      .description('Create a new migration file')
      .option('-t, --type <type>', 'Migration type (schema, data, index)', 'schema')
      .action(async (name: string, options: { type: string }) => {
        try {
          await this.controller.createMigration(name, options.type);
        } catch (error) {
          this.logger.error('Create migration failed:', error);
          process.exit(1);
        }
      });
  }

  private registerUpCommand(program: Command): void {
    program
      .command('up')
      .description('Run pending migrations')
      .option('-t, --to <version>', 'Migrate to specific version')
      .action(async (options: { to?: string }) => {
        try {
          await this.controller.runMigrationsUp(options.to);
        } catch (error) {
          this.logger.error('Migration up failed:', error);
          process.exit(1);
        }
      });
  }

  private registerDownCommand(program: Command): void {
    program
      .command('down')
      .description('Rollback migrations')
      .option('-t, --to <version>', 'Rollback to specific version')
      .option('--steps <steps>', 'Number of migrations to rollback', '1')
      .action(async (options: { to?: string; steps: string }) => {
        try {
          const steps = options.to ? undefined : parseInt(options.steps);
          await this.controller.runMigrationsDown(options.to, steps);
        } catch (error) {
          this.logger.error('Migration down failed:', error);
          process.exit(1);
        }
      });
  }

  private registerStatusCommand(program: Command): void {
    program
      .command('status')
      .description('Show migration status')
      .action(async () => {
        try {
          await this.controller.getMigrationStatus();
        } catch (error) {
          this.logger.error('Status check failed:', error);
          process.exit(1);
        }
      });
  }

  private registerFreshCommand(program: Command): void {
    program
      .command('fresh')
      .description('Drop all tables and run all migrations')
      .option('--force', 'Force fresh migration without confirmation')
      .action(async (options: { force?: boolean }) => {
        try {
          await this.controller.freshMigration(options.force);
        } catch (error) {
          this.logger.error('Fresh migration failed:', error);
          process.exit(1);
        }
      });
  }

  private registerSeedCommand(program: Command): void {
    program
      .command('seed')
      .description('Run database seeders')
      .option('-c, --class <class>', 'Run specific seeder class')
      .action(async (options: { class?: string }) => {
        try {
          await this.controller.runSeeders(options.class);
        } catch (error) {
          this.logger.error('Seeding failed:', error);
          process.exit(1);
        }
      });
  }
}
