import { Module, Global } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ReflectMetadataProvider } from '@mikro-orm/core';
import 'reflect-metadata';

import { DatabaseService } from './service/database.service';
import { getDatabaseConfig } from './config/database.config';
import { createMikroOrmConfig } from './config/mikro-orm.config';
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
  TrafficBuyerEntity,
  TrafficUserEntity,
  TrafficOrderEntity,
  TrafficActionsEntity,
} from './entity';
import { TrafficSourceCategoryEntity } from './entity/TrafficSourceCategory.entity';
import { TrafficSourceCategoriesEntity } from './entity/junction/TrafficSourceCategories.entity';
import {
  TrafficActionsUsersEntity,
  TrafficBuyerSourceEntity,
  TrafficBuyerUsersEntity,
  UserTrafficBuyerEntity,
  UserTrafficOrderEntity,
  UserTrafficSourceEntity,
} from './entity/junction';

const entityClasses = [
  UserEntity,
  UserBalanceEntity,
  UserBalanceHistoryEntity,
  UserLastAuthEntity,
  UserRefLinkEntity,
  UserSettingsEntity,
  UserSourceVisitEntity,
  TrafficSourceEntity,
  TrafficSourceCategoryEntity,
  TrafficBuyerEntity,
  TrafficUserEntity,
  TrafficOrderEntity,
  TrafficActionsEntity,
  TrafficActionsUsersEntity,
  TrafficBuyerSourceEntity,
  TrafficBuyerUsersEntity,
  UserTrafficBuyerEntity,
  UserTrafficOrderEntity,
  UserTrafficSourceEntity,
  TrafficSourceCategoriesEntity,
];

@Global()
@Module({
  imports: [
    MikroOrmModule.forRoot(createMikroOrmConfig(getDatabaseConfig())),
    MikroOrmModule.forFeature(entityClasses),
  ],
  providers: [
    {
      provide: DatabaseService,
      useFactory: () => new DatabaseService(getDatabaseConfig()),
    },
    ...Object.values(repositories),
  ],
  exports: [DatabaseService, MikroOrmModule, ...Object.values(repositories)],
})
export class DatabaseModule {}
