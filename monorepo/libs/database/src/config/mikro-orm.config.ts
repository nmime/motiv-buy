import { defineConfig } from '@mikro-orm/postgresql';
import { type Options, ReflectMetadataProvider } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations';
import 'reflect-metadata';
import { DatabaseConfig } from './database.config';

import {
  TrafficActionsEntity,
  TrafficOrderEntity,
  TrafficSourceCategoryEntity,
  TrafficSourceEntity,
  TrafficTargetEntity,
  TrafficUserEntity,
  UserBalanceEntity,
  UserBalanceHistoryEntity,
  UserEntity,
  UserLastAuthEntity,
  UserRefLinkEntity,
  UserSettingsEntity,
  UserSourceVisitEntity,
  CurrencyEntity,
  CurrencyRatesHistoryEntity,
} from '../entity';
import {
  TrafficActionsUsersEntity,
  TrafficSourceCategoriesEntity,
  TrafficTargetSourceEntity,
  TrafficTargetUsersEntity,
  UserTrafficOrderEntity,
  UserTrafficSourceEntity,
  UserTrafficTargetEntity,
} from '../entity/junction';

export function createMikroOrmConfig(config: DatabaseConfig): Options {
  return defineConfig({
    entities: [
      UserEntity,
      UserBalanceEntity,
      UserBalanceHistoryEntity,
      UserSettingsEntity,
      UserLastAuthEntity,
      UserRefLinkEntity,
      UserSourceVisitEntity,
      CurrencyEntity,
      CurrencyRatesHistoryEntity,
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
  }) as Options;
}
