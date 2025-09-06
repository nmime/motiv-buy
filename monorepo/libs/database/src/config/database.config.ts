import { z } from 'zod';

export const DatabaseConfigSchema = z.object({
  type: z.literal('postgresql'),
  host: z.string(),
  port: z.number(),
  dbName: z.string(),
  user: z.string(),
  password: z.string(),
  debug: z.boolean().default(false),
  migrations: z
    .object({
      path: z.string().default('./src/migrations'),
      tableName: z.string().default('mikro_orm_migrations'),
      transactional: z.boolean().default(true),
      allOrNothing: z.boolean().default(true),
      safe: z.boolean().default(false),
      emit: z.enum(['ts', 'js']).default('ts'),
    })
    .default({}),
});

export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;

/**
 * Database configuration factory
 * Follows CLAUDE.md security-first principles - never hardcode credentials
 */
export const getDatabaseConfig = (): DatabaseConfig => {
  const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missing = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const config: DatabaseConfig = {
    type: 'postgresql',
    host: process.env['DB_HOST']!,
    port: parseInt(process.env['DB_PORT']!),
    dbName: process.env['DB_NAME']!,
    user: process.env['DB_USER']!,
    password: process.env['DB_PASSWORD']!,
    debug: process.env['DB_DEBUG'] === 'true',
    migrations: {
      path: process.env['DB_MIGRATIONS_PATH'] || './src/migrations',
      tableName: process.env['DB_MIGRATIONS_TABLE'] || 'mikro_orm_migrations',
      transactional: process.env['DB_MIGRATIONS_TRANSACTIONAL'] !== 'false',
      allOrNothing: process.env['DB_MIGRATIONS_ALL_OR_NOTHING'] !== 'false',
      safe: process.env['DB_MIGRATIONS_SAFE'] === 'true',
      emit: (process.env['DB_MIGRATIONS_EMIT'] as 'ts' | 'js') || 'ts',
    },
  };

  return DatabaseConfigSchema.parse(config);
};
