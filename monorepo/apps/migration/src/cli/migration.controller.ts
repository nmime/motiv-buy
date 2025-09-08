import { MikroORM } from '@mikro-orm/core';
import { Logger } from '@nestjs/common';
import { MigrationService, ConfirmationService } from '../service';
export class MigrationController {
  private migrationService: MigrationService;
  private confirmationService: ConfirmationService;

  constructor(
    private orm: MikroORM,
    private logger: Logger,
  ) {
    this.migrationService = new MigrationService(orm, logger);
    this.confirmationService = new ConfirmationService(logger);
  }

  async createMigration(name: string, type: string): Promise<void> {
    if (!name || name.trim().length === 0) {
      throw new Error('Migration name is required');
    }

    const validTypes = ['schema', 'data', 'index'];
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid migration type: ${type}. Valid types: ${validTypes.join(', ')}`);
    }

    this.logger.log(`Creating ${type} migration: ${name}`);

    const migrationPath = await this.migrationService.createMigration(name, type);

    this.logger.log('✅ Migration created successfully:', {
      name,
      type,
      path: migrationPath,
    });
  }

  async runMigrationsUp(toVersion?: string): Promise<void> {
    this.logger.log('Checking for pending migrations...');

    const pendingMigrations = await this.migrationService.getPendingMigrations();

    if (pendingMigrations.length === 0) {
      this.logger.log('✅ No pending migrations to run');
      return;
    }

    this.logger.log(`Found ${pendingMigrations.length} pending migration(s):`, {
      migrations: pendingMigrations.map((m) => m.name),
    });

    if (toVersion) {
      this.logger.log(`Migrating to version: ${toVersion}`);
    }

    const result = await this.migrationService.runMigrationsUp(toVersion);

    this.logger.log('✅ Migrations completed successfully:', {
      executed: result.executedMigrations,
      time: result.executionTime,
    });
  }

  async runMigrationsDown(toVersion?: string, steps?: number): Promise<void> {
    this.logger.log('Checking migration status for rollback...');

    const executedMigrations = await this.migrationService.getExecutedMigrations();

    if (executedMigrations.length === 0) {
      this.logger.log('✅ No migrations to rollback');
      return;
    }

    let migrationsToRollback: string[];
    if (toVersion) {
      migrationsToRollback = await this.migrationService.getMigrationsToRollback(toVersion);
      this.logger.warn(`⚠️  Rolling back to version: ${toVersion}`);
    } else {
      const rollbackCount = steps || 1;
      migrationsToRollback = executedMigrations.slice(-rollbackCount).map((m) => m.name);
      this.logger.warn(`⚠️  Rolling back ${rollbackCount} migration(s)`);
    }

    this.logger.warn('Migrations to rollback:', { migrations: migrationsToRollback });

    const confirmed = await this.confirmationService.confirm(
      'This operation may result in data loss. Do you want to continue?',
    );

    if (!confirmed) {
      this.logger.log('Operation cancelled by user');
      return;
    }

    const result = await this.migrationService.runMigrationsDown(toVersion, steps);

    this.logger.log('✅ Rollback completed successfully:', {
      rolledBack: result.rolledBackMigrations,
      time: result.executionTime,
    });
  }

  async getMigrationStatus(): Promise<void> {
    this.logger.log('Checking migration status...');

    const status = await this.migrationService.getMigrationStatus();

    this.logger.log('📊 Migration Status:', {
      executed: status.executedMigrations.length,
      pending: status.pendingMigrations.length,
    });

    if (status.executedMigrations.length > 0) {
      this.logger.log('✅ Executed migrations:', {
        migrations: status.executedMigrations.map((m) => ({
          name: m.name,
          executedAt: m.executedAt,
        })),
      });
    }

    if (status.pendingMigrations.length > 0) {
      this.logger.log('⏳ Pending migrations:', {
        migrations: status.pendingMigrations.map((m) => m.name),
      });
    } else {
      this.logger.log('✅ Database is up to date');
    }
  }

  async freshMigration(force?: boolean): Promise<void> {
    this.logger.warn('⚠️  Fresh migration will DROP ALL TABLES and rebuild the database!');

    if (!force) {
      const confirmed = await this.confirmationService.confirm(
        'This will PERMANENTLY DELETE all data. Are you sure you want to continue?',
      );

      if (!confirmed) {
        this.logger.log('Operation cancelled by user');
        return;
      }
    }

    this.logger.log('Starting fresh migration...');

    const result = await this.migrationService.runFreshMigration();

    this.logger.log('✅ Fresh migration completed successfully:', {
      droppedTables: result.droppedTables,
      executedMigrations: result.executedMigrations,
      time: result.executionTime,
    });
  }

  async runSeeders(seederClass?: string): Promise<void> {
    if (seederClass) {
      this.logger.log(`Running seeder: ${seederClass}`);
    } else {
      this.logger.log('Running all seeders...');
    }

    const result = await this.migrationService.runSeeders(seederClass);

    this.logger.log('✅ Seeding completed successfully:', {
      executed: result.executedSeeders,
      time: result.executionTime,
    });
  }
}
