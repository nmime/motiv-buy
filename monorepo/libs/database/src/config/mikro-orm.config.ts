import { type Options } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { ReflectMetadataProvider } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations';
import RedisCacheAdapter from 'mikro-orm-cache-adapter-redis';
import 'reflect-metadata';
import { DatabaseConfig } from './database.config';
import { getCacheConfig, type CacheConfig } from './cache.config';

interface ExtendedOptions extends Options {
  cache?: {
    enabled: boolean;
    adapter: typeof RedisCacheAdapter;
    options: NonNullable<CacheConfig['options']>;
  };
}
import {
  UserEntity,
  UserBalanceEntity,
  UserBalanceHistoryEntity,
  UserSettingsEntity,
  UserLastAuthEntity,
  UserRefLinkEntity,
  UserSourceVisitEntity,
  TrafficSourceEntity,
  TrafficTargetEntity,
  TrafficUserEntity,
  TrafficOrderEntity,
  TrafficActionsEntity,
  TrafficSourceCategoryEntity,
} from '../entity';
import {
  TrafficActionsUsersEntity,
  UserTrafficTargetEntity,
  UserTrafficSourceEntity,
  UserTrafficOrderEntity,
  TrafficTargetSourceEntity,
  TrafficTargetUsersEntity,
  TrafficSourceCategoriesEntity,
} from '../entity/junction';

export function createMikroOrmConfig(config: DatabaseConfig): ExtendedOptions {
  const cacheConfig = getCacheConfig();

  const baseConfig: ExtendedOptions = {
    entities: [
      UserEntity,
      UserBalanceEntity,
      UserBalanceHistoryEntity,
      UserSettingsEntity,
      UserLastAuthEntity,
      UserRefLinkEntity,
      UserSourceVisitEntity,
      TrafficSourceEntity,
      TrafficTargetEntity,
      TrafficUserEntity,
      TrafficOrderEntity,
      TrafficActionsEntity,
      TrafficSourceCategoryEntity,
      TrafficActionsUsersEntity,
      UserTrafficTargetEntity,
      UserTrafficSourceEntity,
      UserTrafficOrderEntity,
      TrafficTargetSourceEntity,
      TrafficTargetUsersEntity,
      TrafficSourceCategoriesEntity,
    ],
    driver: PostgreSqlDriver,
    host: config.host,
    port: config.port,
    dbName: config.dbName,
    user: config.user,
    password: config.password,
    metadataProvider: ReflectMetadataProvider,
    debug: config.debug,
    extensions: [Migrator],
    migrations: {
      path: config.migrations.path,
      tableName: config.migrations.tableName,
      transactional: config.migrations.transactional,
      disableForeignKeys: false,
      allOrNothing: config.migrations.allOrNothing,
      dropTables: false,
      safe: config.migrations.safe,
      snapshot: true,
      emit: config.migrations.emit,
    },
    schemaGenerator: {
      disableForeignKeys: false,
      createForeignKeyConstraints: true,
      ignoreSchema: [],
    },
  };

  // Add cache configuration if enabled
  if (cacheConfig.enabled && cacheConfig.options) {
    baseConfig.cache = {
      enabled: true,
      adapter: RedisCacheAdapter,
      options: {
        host: cacheConfig.options.host || 'localhost',
        port: cacheConfig.options.port || 6379,
        password: cacheConfig.options.password,
        db: cacheConfig.options.db || 0,
        keyPrefix: cacheConfig.options.keyPrefix || 'mikro-orm-cache:',
        ttl: cacheConfig.options.ttl || 30,
        debugMode: cacheConfig.options.debugMode || false,
      },
    };
  }

  return baseConfig;
}
