import { MikroORM } from '@mikro-orm/core';
import type { Logger } from '../type/logger.type';
import { MigrationService } from '../service/migration.service';
import { ConfirmationService } from '../service/confirmation.service';

/**
 * Migration Controller
 *
 * Follows CLAUDE.md Controller → Service → Repository → Mapper pattern
 * Handles CLI input validation and response formatting
 */
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

  /**
   * Create a new migration file
   */
  async createMigration(name: string, type: string): Promise<void> {
    if (!name || name.trim().length === 0) {
      throw new Error('Migration name is required');
    }

    const validTypes = ['schema', 'data', 'index'];
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid migration type: ${type}. Valid types: ${validTypes.join(', ')}`);
    }

    this.logger.info(`Creating ${type} migration: ${name}`);

    const migrationPath = await this.migrationService.createMigration(name, type);

    this.logger.info('✅ Migration created successfully:', {
      name,
      type,
      path: migrationPath,
    });
  }

  /**
   * Run pending migrations
   */
  async runMigrationsUp(toVersion?: string): Promise<void> {
    this.logger.info('Checking for pending migrations...');

    const pendingMigrations = await this.migrationService.getPendingMigrations();

    if (pendingMigrations.length === 0) {
      this.logger.info('✅ No pending migrations to run');
      return;
    }

    this.logger.info(`Found ${pendingMigrations.length} pending migration(s):`, {
      migrations: pendingMigrations.map((m) => m.name),
    });

    if (toVersion) {
      this.logger.info(`Migrating to version: ${toVersion}`);
    }

    const result = await this.migrationService.runMigrationsUp(toVersion);

    this.logger.info('✅ Migrations completed successfully:', {
      executed: result.executedMigrations,
      time: result.executionTime,
    });
  }

  /**
   * Rollback migrations
   */
  async runMigrationsDown(toVersion?: string, steps?: number): Promise<void> {
    this.logger.info('Checking migration status for rollback...');

    const executedMigrations = await this.migrationService.getExecutedMigrations();

    if (executedMigrations.length === 0) {
      this.logger.info('✅ No migrations to rollback');
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
      this.logger.info('Operation cancelled by user');
      return;
    }

    const result = await this.migrationService.runMigrationsDown(toVersion, steps);

    this.logger.info('✅ Rollback completed successfully:', {
      rolledBack: result.rolledBackMigrations,
      time: result.executionTime,
    });
  }

  /**
   * Show migration status
   */
  async getMigrationStatus(): Promise<void> {
    this.logger.info('Checking migration status...');

    const status = await this.migrationService.getMigrationStatus();

    this.logger.info('📊 Migration Status:', {
      executed: status.executedMigrations.length,
      pending: status.pendingMigrations.length,
    });

    if (status.executedMigrations.length > 0) {
      this.logger.info('✅ Executed migrations:', {
        migrations: status.executedMigrations.map((m) => ({
          name: m.name,
          executedAt: m.executedAt,
        })),
      });
    }

    if (status.pendingMigrations.length > 0) {
      this.logger.info('⏳ Pending migrations:', {
        migrations: status.pendingMigrations.map((m) => m.name),
      });
    } else {
      this.logger.info('✅ Database is up to date');
    }
  }

  /**
   * Drop all tables and run fresh migrations
   */
  async freshMigration(force?: boolean): Promise<void> {
    this.logger.warn('⚠️  Fresh migration will DROP ALL TABLES and rebuild the database!');

    if (!force) {
      const confirmed = await this.confirmationService.confirm(
        'This will PERMANENTLY DELETE all data. Are you sure you want to continue?',
      );

      if (!confirmed) {
        this.logger.info('Operation cancelled by user');
        return;
      }
    }

    this.logger.info('Starting fresh migration...');

    const result = await this.migrationService.runFreshMigration();

    this.logger.info('✅ Fresh migration completed successfully:', {
      droppedTables: result.droppedTables,
      executedMigrations: result.executedMigrations,
      time: result.executionTime,
    });
  }

  /**
   * Run database seeders
   */
  async runSeeders(seederClass?: string): Promise<void> {
    if (seederClass) {
      this.logger.info(`Running seeder: ${seederClass}`);
    } else {
      this.logger.info('Running all seeders...');
    }

    const result = await this.migrationService.runSeeders(seederClass);

    this.logger.info('✅ Seeding completed successfully:', {
      executed: result.executedSeeders,
      time: result.executionTime,
    });
  }
}
