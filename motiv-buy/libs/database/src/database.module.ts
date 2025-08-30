import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';

import { DatabaseService } from './service/database.service';
import { MigrationService } from './service/migration.service';
import * as repositories from './repository';

// Import only entity classes, not enums
import { 
  UserEntity, 
  UserBalanceEntity, 
  UserBalanceHistoryEntity, 
  UserSettingsEntity, 
  TrafficSourceEntity, 
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
} from './entity/junction';

const entityClasses = [
  UserEntity, 
  UserBalanceEntity, 
  UserBalanceHistoryEntity, 
  UserSettingsEntity, 
  TrafficSourceEntity, 
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

@Module({
  imports: [
    MikroOrmModule.forFeature(entityClasses),
  ],
  providers: [
    DatabaseService,
    MigrationService,
    ...Object.values(repositories),
  ],
  exports: [
    DatabaseService,
    MigrationService,
    MikroOrmModule,
    ...Object.values(repositories),
  ],
})
export class DatabaseModule {}
