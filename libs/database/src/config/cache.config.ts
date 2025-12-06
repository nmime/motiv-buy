import { z } from 'zod';

export const CacheConfigSchema = z.object({
  enabled: z.boolean().default(true),
  adapter: z.literal('redis').default('redis'),
  options: z
    .object({
      host: z.string().default('localhost'),
      port: z.number().default(6381),
      password: z.string().optional(),
      db: z.number().default(2),
      keyPrefix: z.string().default('mikro-orm-cache:'),
      ttl: z.number().default(30), // Default TTL in seconds
      debugMode: z.boolean().default(false),
    })
    .optional(),
});

export type CacheConfig = z.infer<typeof CacheConfigSchema>;

export const getCacheConfig = (): CacheConfig => {
  // Parse Redis hosts for multiple host support
  const redisHosts = process.env['REDIS_HOSTS'] || 'localhost:6381';
  const [host, portStr] = redisHosts.split(':');
  const port = parseInt(portStr || '6381');

  const config: CacheConfig = {
    enabled: process.env['CACHE_ENABLED'] !== 'false',
    adapter: 'redis',
    options: {
      host: process.env['REDIS_HOST'] || host || 'localhost',
      port: process.env['REDIS_PORT'] ? parseInt(process.env['REDIS_PORT']) : port,
      password: process.env['REDIS_PASSWORD'],
      db: process.env['REDIS_DB'] ? parseInt(process.env['REDIS_DB']) : 2,
      keyPrefix: process.env['REDIS_CACHE_PREFIX'] || 'mikro-orm-cache:',
      ttl: process.env['CACHE_TTL'] ? parseInt(process.env['CACHE_TTL']) : 30,
      debugMode: process.env['CACHE_DEBUG'] === 'true',
    },
  };

  return CacheConfigSchema.parse(config);
};
