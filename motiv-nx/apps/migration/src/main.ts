#!/usr/bin/env node
import { DatabaseService, getDatabaseConfig } from '@motiv-nx/database';

interface MigrationAppConfig {
  autoRunOnStartup: boolean;
  createInitialSchema: boolean;
  environment: string;
}

export class MigrationApp {
  private dbService: DatabaseService | null = null;
  private config: MigrationAppConfig;

  constructor(config: Partial<MigrationAppConfig> = {}) {
    this.config = {
      autoRunOnStartup: config.autoRunOnStartup ?? true,
      createInitialSchema: config.createInitialSchema ?? false,
      environment: config.environment ?? process.env.NODE_ENV ?? 'development'
    };
  }

  async start(): Promise<void> {
    console.log('🚀 Starting Migration App...');
    console.log(`📊 Environment: ${this.config.environment}`);
    
    try {
      // Get database configuration from environment variables
      const dbConfig = getDatabaseConfig();

      // Initialize database service
      this.dbService = DatabaseService.getInstance(dbConfig);
      await this.dbService.initialize();
      
      console.log('✅ Database connection established');

      // Create initial schema if needed
      if (this.config.createInitialSchema) {
        console.log('🏗️ Creating initial schema...');
        await this.dbService.createSchema();
        console.log('✅ Initial schema created');
      }

      // Run migrations if auto-run is enabled
      if (this.config.autoRunOnStartup) {
        await this.runMigrations();
      }

      // Check database health
      const health = await this.dbService.healthCheck();
      console.log('🏥 Database Health Check:', health);

      console.log('✅ Migration App started successfully');
    } catch (error) {
      console.error('❌ Failed to start Migration App:', error);
      throw error;
    }
  }

  async runMigrations(): Promise<void> {
    if (!this.dbService) {
      throw new Error('Database service not initialized');
    }

    console.log('🔄 Running database migrations...');
    
    try {
      const migrator = this.dbService.getORM().getMigrator();
      
      // Check pending migrations
      const pending = await migrator.getPendingMigrations();
      if (pending.length === 0) {
        console.log('✅ No pending migrations');
        return;
      }

      console.log(`📋 Found ${pending.length} pending migrations:`);
      pending.forEach(migration => {
        console.log(`  - ${migration.name}`);
      });

      // Execute migrations
      await this.dbService.runMigrations();
      console.log('✅ All migrations executed successfully');

      // Show final status
      const executed = await migrator.getExecutedMigrations();
      console.log(`📊 Total executed migrations: ${executed.length}`);
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  async createMigration(name?: string): Promise<void> {
    if (!this.dbService) {
      throw new Error('Database service not initialized');
    }

    console.log(`🏗️ Creating migration${name ? `: ${name}` : ''}...`);
    
    try {
      await this.dbService.createMigration(name);
    } catch (error) {
      console.error('❌ Failed to create migration:', error);
      throw error;
    }
  }

  async checkStatus(): Promise<void> {
    if (!this.dbService) {
      throw new Error('Database service not initialized');
    }

    try {
      const migrator = this.dbService.getORM().getMigrator();
      const executed = await migrator.getExecutedMigrations();
      const pending = await migrator.getPendingMigrations();

      console.log('\n📊 Migration Status:');
      console.log(`✅ Executed: ${executed.length}`);
      console.log(`⏳ Pending: ${pending.length}`);

      if (executed.length > 0) {
        console.log('\n✅ Executed migrations:');
        executed.forEach(migration => {
          console.log(`  - ${migration.name} (executed: ${migration.executedAt})`);
        });
      }

      if (pending.length > 0) {
        console.log('\n⏳ Pending migrations:');
        pending.forEach(migration => {
          console.log(`  - ${migration.name}`);
        });
      }
    } catch (error) {
      console.error('❌ Failed to check status:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.dbService) {
      await this.dbService.close();
      console.log('✅ Migration App stopped');
    }
  }

  // Static startup method for easy integration
  static async startup(config?: Partial<MigrationAppConfig>): Promise<MigrationApp> {
    const app = new MigrationApp(config);
    await app.start();
    return app;
  }
}

// CLI interface when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const migrationName = process.argv[3];
  
  const app = new MigrationApp({
    autoRunOnStartup: false,
    createInitialSchema: command === 'init'
  });

  try {
    await app.start();

    switch (command) {
      case 'init':
        console.log('🏗️ Initializing database with schema...');
        break;
      
      case 'migrate':
        await app.runMigrations();
        break;
      
      case 'create':
        await app.createMigration(migrationName);
        break;
      
      case 'status':
        await app.checkStatus();
        break;
      
      default:
        console.log('Usage: node main.js [init|migrate|create|status] [migration-name]');
        console.log('Commands:');
        console.log('  init              - Initialize database with schema');
        console.log('  migrate           - Run pending migrations');
        console.log('  create [name]     - Create new migration');
        console.log('  status            - Show migration status');
    }

    await app.stop();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration App error:', error);
    await app.stop();
    process.exit(1);
  }
}

export default MigrationApp;