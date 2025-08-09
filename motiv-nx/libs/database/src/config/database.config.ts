import { z } from 'zod';

export const DatabaseConfigSchema = z.object({
  type: z.literal('postgresql'),
  host: z.string(),
  port: z.number(),
  dbName: z.string(),
  user: z.string(),
  password: z.string(),
  debug: z.boolean().default(false)
});

export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;

// Configuration from environment variables only
export const getDatabaseConfig = (): DatabaseConfig => {
  const config: DatabaseConfig = {
    type: 'postgresql',
    host: z.string().parse(process.env.DB_HOST),
    port: z.number().parse(parseInt(process.env.DB_PORT || '5432')),
    dbName: z.string().parse(process.env.DB_NAME),
    user: z.string().parse(process.env.DB_USER),
    password: z.string().parse(process.env.DB_PASSWORD || ''),
    debug: z.boolean().parse(process.env.DB_DEBUG === 'true')
  };

  return DatabaseConfigSchema.parse(config);
};