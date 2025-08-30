import { type Options } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { Migrator } from '@mikro-orm/migrations';
import { DatabaseConfig } from './database.config';
import { 
  UserEntity, UserBalanceEntity, UserBalanceHistoryEntity, UserSettingsEntity,
  TrafficSourceEntity, TrafficBuyerEntity, TrafficUserEntity, TrafficOrderEntity,
  TrafficActionsEntity
} from '../entity';
import {
  TrafficActionsUsersEntity, UserTrafficBuyerEntity, UserTrafficSourceEntity,
  UserTrafficOrderEntity, TrafficBuyerSourceEntity, TrafficBuyerUsersEntity
} from '../entity';

export function createMikroOrmConfig(config: DatabaseConfig): Options {
  return {
    entities: [
      UserEntity, UserBalanceEntity, UserBalanceHistoryEntity, UserSettingsEntity,
      TrafficSourceEntity, TrafficBuyerEntity, TrafficUserEntity, TrafficOrderEntity,
      TrafficActionsEntity,
      // Junction entities for M:N relationships
      TrafficActionsUsersEntity, UserTrafficBuyerEntity, UserTrafficSourceEntity,
      UserTrafficOrderEntity, TrafficBuyerSourceEntity, TrafficBuyerUsersEntity
    ],
    driver: PostgreSqlDriver,
    host: config.host,
    port: config.port,
    dbName: config.dbName,
    user: config.user,
    password: config.password,
    metadataProvider: TsMorphMetadataProvider,
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
  } as Options;
}
