import { Injectable } from '@nestjs/common';
import { MikroORM, EntityManager, RequestContext } from '@mikro-orm/core';
import { FastifyRequest } from 'fastify';
import { createMikroOrmConfig } from '../config/mikro-orm.config';
import { DatabaseConfig } from '../config/database.config';

@Injectable()
export class DatabaseService {
  private orm!: MikroORM;
  private isConnected = false;
  private config!: DatabaseConfig;

  constructor(config?: DatabaseConfig) {
    if (config) {
      this.config = config;
    }
  }

  async initialize(): Promise<void> {
    try {
      const mikroOrmConfig = createMikroOrmConfig(this.config);
      this.orm = await MikroORM.init(mikroOrmConfig);
      this.isConnected = true;
      console.log('✅ Database connection established');
      
      const migrator = this.orm.getMigrator();
      await migrator.up();
      console.log('✅ Database migrations applied');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  getORM(): MikroORM {
    if (!this.orm || !this.isConnected) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.orm;
  }

  getEntityManager(): EntityManager {
    return this.getORM().em;
  }

  async close(): Promise<void> {
    if (this.orm) {
      await this.orm.close();
      this.isConnected = false;
      console.log('✅ Database connection closed');
    }
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    connected: boolean;
    uptime: number;
    type: string;
  }> {
    try {
      const em = this.getEntityManager();
      await em.getConnection().execute('SELECT 1');
      
      return {
        status: 'healthy',
        connected: true,
        uptime: process.uptime(),
        type: this.config.type
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: false,
        uptime: process.uptime(),
        type: this.config.type
      };
    }
  }

  createRequestContext() {
    return async (request: FastifyRequest, reply: any, done: any) => {
      RequestContext.create(this.getEntityManager(), done);
    };
  }

  async transaction<T>(callback: (em: EntityManager) => Promise<T>): Promise<T> {
    const em = this.getEntityManager();
    return em.transactional(callback);
  }

  async runMigrations(): Promise<void> {
    const migrator = this.orm.getMigrator();
    await migrator.up();
  }

  async createMigration(name?: string): Promise<void> {
    const migrator = this.orm.getMigrator();
    const migration = await migrator.createMigration(name);
    console.log(`✅ Migration created: ${migration.fileName}`);
  }

  async getMigrationStatus(): Promise<{
    executed: Array<{ name: string; executedAt?: Date }>;
    pending: Array<{ name: string }>;
  }> {
    const migrator = this.orm.getMigrator();
    const [executed, pending] = await Promise.all([
      migrator.getExecutedMigrations(),
      migrator.getPendingMigrations()
    ]);
    return { executed, pending };
  }

  async rollbackMigration(): Promise<void> {
    const migrator = this.orm.getMigrator();
    await migrator.down();
    console.log('✅ Last migration rolled back');
  }

  async createSchema(): Promise<void> {
    const generator = this.orm.getSchemaGenerator();
    await generator.createSchema();
    console.log('✅ Database schema created');
  }

  async updateSchema(): Promise<void> {
    const generator = this.orm.getSchemaGenerator();
    await generator.updateSchema();
    console.log('✅ Database schema updated');
  }

  async dropSchema(): Promise<void> {
    const generator = this.orm.getSchemaGenerator();
    await generator.dropSchema();
    console.log('✅ Database schema dropped');
  }
}