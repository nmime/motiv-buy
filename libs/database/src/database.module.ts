import { Global, Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import 'reflect-metadata';

import { DatabaseService } from './service/database.service';
import { getDatabaseConfig } from './config/database.config';
import { createMikroOrmConfig } from './config/mikro-orm.config';
import * as repositories from './repository';

import {
  TrafficActionsEntity,
  TrafficOrderEntity,
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
  NotificationEntity,
  NotificationTemplateEntity,
} from './entity';
import { TrafficSourceCategoryEntity } from './entity/TrafficSourceCategory.entity';
import { TrafficSourceCategoriesEntity } from './entity/junction/TrafficSourceCategories.entity';
import {
  TrafficActionsUsersEntity,
  TrafficTargetSourceEntity,
  TrafficTargetUsersEntity,
  UserTrafficOrderEntity,
  UserTrafficSourceEntity,
  UserTrafficTargetEntity,
} from './entity/junction';

const entityClasses = [
  UserEntity,
  UserBalanceEntity,
  UserBalanceHistoryEntity,
  UserLastAuthEntity,
  UserRefLinkEntity,
  UserSettingsEntity,
  UserSourceVisitEntity,
  CurrencyEntity,
  CurrencyRatesHistoryEntity,
  TrafficSourceEntity,
  TrafficSourceCategoryEntity,
  TrafficTargetEntity,
  TrafficUserEntity,
  TrafficOrderEntity,
  TrafficActionsEntity,
  TrafficActionsUsersEntity,
  TrafficTargetSourceEntity,
  TrafficTargetUsersEntity,
  UserTrafficTargetEntity,
  UserTrafficOrderEntity,
  UserTrafficSourceEntity,
  TrafficSourceCategoriesEntity,
  NotificationEntity,
  NotificationTemplateEntity,
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
