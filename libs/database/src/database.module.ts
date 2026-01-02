import { Global, Module, Provider } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EntityManager } from '@mikro-orm/core';
import { EntityManager as SqlEntityManager } from '@mikro-orm/postgresql';
import 'reflect-metadata';

import { DatabaseService } from './service/database.service';
import { getDatabaseConfig } from './config/database.config';
import { createMikroOrmConfig } from './config/mikro-orm.config';
import {
  CurrencyRateProviderRepository,
  CurrencyRatesHistoryRepository,
  CurrencyRepository,
  ModerationRequestRepository,
  NotificationRepository,
  NotificationTemplateRepository,
  PaymentProviderRepository,
  ProviderCurrencyRepository,
  ProviderRoutingRepository,
  RateProviderCurrencyRepository,
  TrafficActionsRepository,
  TrafficOrderBalanceRepository,
  TrafficOrderRepository,
  TrafficSourceRepository,
  TrafficTargetRepository,
  TrafficUserRepository,
  UserBalanceHistoryRepository,
  UserBalanceRepository,
  UserLastAuthRepository,
  UserRefLinkRepository,
  UserRepository,
  UserSettingsRepository,
  UserSourceVisitRepository,
} from './repository';

import {
  CurrencyEntity,
  CurrencyRateProviderEntity,
  CurrencyRatesHistoryEntity,
  NotificationEntity,
  NotificationTemplateEntity,
  RateProviderCurrencyEntity,
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
  CurrencyRateProviderEntity,
  RateProviderCurrencyEntity,
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

/**
 * Create repository providers with proper EntityManager injection.
 * Each repository needs the EntityManager injected via factory function.
 */
const repositoryProviders: Provider[] = [
  {
    provide: UserRepository,
    useFactory: (em: EntityManager) => new UserRepository(em),
    inject: [EntityManager],
  },
  {
    provide: UserBalanceRepository,
    useFactory: (em: EntityManager) => new UserBalanceRepository(em),
    inject: [EntityManager],
  },
  {
    provide: UserBalanceHistoryRepository,
    useFactory: (em: EntityManager) => new UserBalanceHistoryRepository(em),
    inject: [EntityManager],
  },
  {
    provide: UserLastAuthRepository,
    useFactory: (em: EntityManager) => new UserLastAuthRepository(em),
    inject: [EntityManager],
  },
  {
    provide: UserRefLinkRepository,
    useFactory: (em: EntityManager) => new UserRefLinkRepository(em),
    inject: [EntityManager],
  },
  {
    provide: UserSettingsRepository,
    useFactory: (em: EntityManager) => new UserSettingsRepository(em),
    inject: [EntityManager],
  },
  {
    provide: UserSourceVisitRepository,
    useFactory: (em: EntityManager) => new UserSourceVisitRepository(em),
    inject: [EntityManager],
  },
  {
    provide: TrafficSourceRepository,
    useFactory: (em: EntityManager) => new TrafficSourceRepository(em),
    inject: [EntityManager],
  },
  {
    provide: TrafficTargetRepository,
    useFactory: (em: EntityManager) => new TrafficTargetRepository(em),
    inject: [EntityManager],
  },
  {
    provide: TrafficUserRepository,
    useFactory: (em: EntityManager) => new TrafficUserRepository(em),
    inject: [EntityManager],
  },
  {
    provide: TrafficOrderRepository,
    useFactory: (em: EntityManager) => new TrafficOrderRepository(em),
    inject: [EntityManager],
  },
  {
    provide: TrafficOrderBalanceRepository,
    useFactory: (em: EntityManager) => new TrafficOrderBalanceRepository(em),
    inject: [EntityManager],
  },
  {
    provide: TrafficActionsRepository,
    useFactory: (em: EntityManager) => new TrafficActionsRepository(em),
    inject: [EntityManager],
  },
  {
    provide: ModerationRequestRepository,
    useFactory: (em: EntityManager) => new ModerationRequestRepository(em),
    inject: [EntityManager],
  },
  {
    provide: CurrencyRepository,
    useFactory: (em: EntityManager) => new CurrencyRepository(em),
    inject: [EntityManager],
  },
  {
    provide: CurrencyRatesHistoryRepository,
    useFactory: (em: EntityManager) => new CurrencyRatesHistoryRepository(em),
    inject: [EntityManager],
  },
  {
    provide: CurrencyRateProviderRepository,
    useFactory: (em: EntityManager) => new CurrencyRateProviderRepository(em),
    inject: [EntityManager],
  },
  {
    provide: RateProviderCurrencyRepository,
    useFactory: (em: EntityManager) => new RateProviderCurrencyRepository(em),
    inject: [EntityManager],
  },
  {
    provide: PaymentProviderRepository,
    useFactory: (em: EntityManager) => new PaymentProviderRepository(em),
    inject: [EntityManager],
  },
  {
    provide: ProviderCurrencyRepository,
    useFactory: (em: EntityManager) => new ProviderCurrencyRepository(em),
    inject: [EntityManager],
  },
  {
    provide: ProviderRoutingRepository,
    useFactory: (em: EntityManager) => new ProviderRoutingRepository(em),
    inject: [EntityManager],
  },
  {
    provide: NotificationRepository,
    useFactory: (em: SqlEntityManager) => new NotificationRepository(em),
    inject: [EntityManager],
  },
  {
    provide: NotificationTemplateRepository,
    useFactory: (em: SqlEntityManager) => new NotificationTemplateRepository(em),
    inject: [EntityManager],
  },
];

const repositoryClasses = [
  UserRepository,
  UserBalanceRepository,
  UserBalanceHistoryRepository,
  UserLastAuthRepository,
  UserRefLinkRepository,
  UserSettingsRepository,
  UserSourceVisitRepository,
  TrafficSourceRepository,
  TrafficTargetRepository,
  TrafficUserRepository,
  TrafficOrderRepository,
  TrafficOrderBalanceRepository,
  TrafficActionsRepository,
  ModerationRequestRepository,
  CurrencyRepository,
  CurrencyRatesHistoryRepository,
  CurrencyRateProviderRepository,
  RateProviderCurrencyRepository,
  PaymentProviderRepository,
  ProviderCurrencyRepository,
  ProviderRoutingRepository,
  NotificationRepository,
  NotificationTemplateRepository,
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
    ...repositoryProviders,
  ],
  exports: [DatabaseService, MikroOrmModule, ...repositoryClasses],
})
export class DatabaseModule {}
