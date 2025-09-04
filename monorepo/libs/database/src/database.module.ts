import { Module, Global } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { SqliteDriver } from '@mikro-orm/sqlite';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';

import { DatabaseService } from './service/database.service';
import { getDatabaseConfig } from './config/database.config';
import * as repositories from './repository';

import { 
  UserEntity, 
  UserBalanceEntity, 
  UserBalanceHistoryEntity, 
  UserLastAuthEntity,
  UserRefLinkEntity,
  UserSettingsEntity, 
  UserSourceVisitEntity,
  TrafficSourceEntity,
  // TrafficSourceCategoryEntity, // Temporarily commented out due to circular dependency
  TrafficBuyerEntity, 
  TrafficUserEntity, 
  TrafficOrderEntity, 
  TrafficActionsEntity 
} from './entity';
import {
  TrafficActionsUsersEntity,
  TrafficBuyerSourceEntity,
  TrafficBuyerUsersEntity,
  UserTrafficBuyerEntity,
  UserTrafficOrderEntity,
  UserTrafficSourceEntity
} from './entity';

const entityClasses = [
  UserEntity, 
  UserBalanceEntity, 
  UserBalanceHistoryEntity, 
  UserLastAuthEntity,
  UserRefLinkEntity,
  UserSettingsEntity,
  UserSourceVisitEntity,
  TrafficSourceEntity,
  // TrafficSourceCategoryEntity, // Temporarily commented out due to circular dependency
  TrafficBuyerEntity, 
  TrafficUserEntity, 
  TrafficOrderEntity, 
  TrafficActionsEntity,
  TrafficActionsUsersEntity,
  TrafficBuyerSourceEntity,
  TrafficBuyerUsersEntity,
  UserTrafficBuyerEntity,
  UserTrafficOrderEntity,
  UserTrafficSourceEntity
];

@Global()
@Module({
  imports: [
    MikroOrmModule.forRoot({
      driver: SqliteDriver,
      dbName: process.env.DB_NAME || './dev.db',
      entities: entityClasses,
      metadataProvider: TsMorphMetadataProvider,
      debug: process.env.NODE_ENV !== 'production',
      autoLoadEntities: false,
      migrations: {
        path: './migrations',
        tableName: 'mikro_orm_migrations',
        transactional: true,
        allOrNothing: true,
        safe: false,
      },
    }),
    MikroOrmModule.forFeature(entityClasses),
  ],
  providers: [
    {
      provide: DatabaseService,
      useFactory: () => new DatabaseService(getDatabaseConfig()),
    },
    ...Object.values(repositories),
  ],
  exports: [
    DatabaseService,
    MikroOrmModule,
    ...Object.values(repositories),
  ],
})
export class DatabaseModule {}
