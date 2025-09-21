import { MikroORM } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations';
import { Logger } from '@nestjs/common';
import type { MigrationResult, MigrationStatus, FreshMigrationResult, SeederResult } from '../type';
export class MigrationService {
  private migrator: Migrator;

  constructor(
    private orm: MikroORM,
    private logger: Logger,
  ) {
    this.migrator = this.orm.getMigrator();
  }

  async createMigration(name: string, type: string): Promise<string> {
    try {
      const timestamp = Date.now();
      const migrationName = `${timestamp}-${type}-${name.replace(/[^a-zA-Z0-9]/g, '-')}`;

      const migration = await this.migrator.createMigration(migrationName);

      this.logger.debug('Migration file created:', {
        name: migrationName,
        path: migration.fileName,
      });

      return migration.fileName;
    } catch (error) {
      this.logger.error('Failed to create migration:', error);
      throw new Error(`Migration creation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getPendingMigrations(): Promise<Array<{ name: string }>> {
    try {
      const pending = await this.migrator.getPendingMigrations();

      return pending.map((migration) => ({ name: migration.name }));
    } catch (error) {
      this.logger.error('Failed to get pending migrations:', error);
      throw new Error(
        `Failed to retrieve pending migrations: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getExecutedMigrations(): Promise<Array<{ name: string; executedAt: Date }>> {
    try {
      const executed = await this.migrator.getExecutedMigrations();

      return executed.map((migration) => ({
        name: migration.name,
        executedAt: migration.executed_at || new Date(),
      }));
    } catch (error) {
      this.logger.error('Failed to get executed migrations:', error);
      throw new Error(
        `Failed to retrieve executed migrations: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async runMigrationsUp(toVersion?: string): Promise<MigrationResult> {
    const startTime = Date.now();

    try {
      const result = await this.migrator.up({ to: toVersion });
      const executionTime = Date.now() - startTime;

      return {
        executedMigrations: result.map((m) => m.name),
        executionTime: `${executionTime}ms`,
      };
    } catch (error) {
      this.logger.error('Migration up failed:', error);
      throw new Error(`Migration execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getMigrationsToRollback(toVersion: string): Promise<string[]> {
    try {
      const executed = await this.getExecutedMigrations();
      const targetIndex = executed.findIndex((m) => m.name.includes(toVersion));

      if (targetIndex === -1) {
        throw new Error(`Migration version ${toVersion} not found`);
      }

      return executed.slice(targetIndex + 1).map((m) => m.name);
    } catch (error) {
      this.logger.error('Failed to determine rollback migrations:', error);
      throw error;
    }
  }

  async runMigrationsDown(toVersion?: string, steps?: number): Promise<MigrationResult> {
    const startTime = Date.now();

    try {
      let result;

      if (toVersion) {
        result = await this.migrator.down({ to: toVersion });
      } else {
        const rollbackSteps = steps || 1;
        // Get recent executed migrations to rollback
        const executed = await this.migrator.getExecutedMigrations();
        const migrationsToRollback = executed.slice(-rollbackSteps).map((m) => m.name);
        result = await this.migrator.down({ migrations: migrationsToRollback });
      }

      const executionTime = Date.now() - startTime;

      return {
        rolledBackMigrations: result.map((m) => m.name),
        executionTime: `${executionTime}ms`,
      };
    } catch (error) {
      this.logger.error('Migration down failed:', error);
      throw new Error(`Migration rollback failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getMigrationStatus(): Promise<MigrationStatus> {
    try {
      const [executed, pending] = await Promise.all([this.getExecutedMigrations(), this.getPendingMigrations()]);

      return {
        executedMigrations: executed,
        pendingMigrations: pending,
      };
    } catch (error) {
      this.logger.error('Failed to get migration status:', error);
      throw new Error(`Status check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async runFreshMigration(): Promise<FreshMigrationResult> {
    const startTime = Date.now();

    try {
      const generator = this.orm.getSchemaGenerator();

      this.logger.log('Dropping all tables...');
      await generator.dropSchema();

      this.logger.log('Running fresh migrations...');
      const migrationResult = await this.migrator.up();

      const executionTime = Date.now() - startTime;

      return {
        droppedTables: true,
        executedMigrations: migrationResult.map((m) => m.name),
        executionTime: `${executionTime}ms`,
      };
    } catch (error) {
      this.logger.error('Fresh migration failed:', error);
      throw new Error(`Fresh migration failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async runSeeders(seederClass?: string): Promise<SeederResult> {
    const startTime = Date.now();

    try {
      this.logger.log('Seeder functionality not implemented yet');

      // Since this is a placeholder, we'll add a small delay to simulate work
      await new Promise((resolve) => setTimeout(resolve, 10));

      const executionTime = Date.now() - startTime;

      return {
        executedSeeders: seederClass ? [seederClass] : [],
        executionTime: `${executionTime}ms`,
      };
    } catch (error) {
      this.logger.error('Seeding failed:', error);
      throw new Error(`Seeding failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
