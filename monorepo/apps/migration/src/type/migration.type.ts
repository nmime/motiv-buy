/**
 * Migration operation result types
 * Following CLAUDE.md TypeScript type safety principles
 */

export interface MigrationResult {
  executedMigrations?: string[];
  rolledBackMigrations?: string[];
  executionTime: string;
}

export interface MigrationStatus {
  executedMigrations: Array<{
    name: string;
    executedAt: Date;
  }>;
  pendingMigrations: Array<{
    name: string;
  }>;
}

export interface FreshMigrationResult {
  droppedTables: boolean;
  executedMigrations: string[];
  executionTime: string;
}

export interface SeederResult {
  executedSeeders: string[];
  executionTime: string;
}