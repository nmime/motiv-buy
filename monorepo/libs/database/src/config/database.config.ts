import { z } from 'zod';

export const DatabaseConfigSchema = z.object({
  type: z.literal('sqlite'),
  host: z.string().optional(),
  port: z.number().optional(),
  dbName: z.string(),
  user: z.string().optional(),
  password: z.string().optional(),
  debug: z.boolean().default(false),
  migrations: z.object({
    path: z.string().default('./src/migrations'),
    tableName: z.string().default('mikro_orm_migrations'),
    transactional: z.boolean().default(true),
    allOrNothing: z.boolean().default(true),
    safe: z.boolean().default(false),
    emit: z.enum(['ts', 'js']).default('ts')
  }).default({})
});

export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;

/**
 * Database configuration factory
 * Follows CLAUDE.md security-first principles - never hardcode credentials
 */
export const getDatabaseConfig = (): DatabaseConfig => {
  if (!process.env['DB_NAME']) {
    throw new Error('DB_NAME environment variable is required');
  }

  const config: DatabaseConfig = {
    type: 'sqlite',
    host: process.env['DB_HOST'],
    port: process.env['DB_PORT'] ? parseInt(process.env['DB_PORT']) : undefined,
    dbName: process.env['DB_NAME'],
    user: process.env['DB_USER'],
    password: process.env['DB_PASSWORD'],
    debug: process.env['DB_DEBUG'] === 'true',
    migrations: {
      path: process.env['DB_MIGRATIONS_PATH'] || './src/migrations',
      tableName: process.env['DB_MIGRATIONS_TABLE'] || 'mikro_orm_migrations',
      transactional: process.env['DB_MIGRATIONS_TRANSACTIONAL'] !== 'false',
      allOrNothing: process.env['DB_MIGRATIONS_ALL_OR_NOTHING'] !== 'false',
      safe: process.env['DB_MIGRATIONS_SAFE'] === 'true',
      emit: (process.env['DB_MIGRATIONS_EMIT'] as 'ts' | 'js') || 'ts'
    }
  };

  return DatabaseConfigSchema.parse(config);
};