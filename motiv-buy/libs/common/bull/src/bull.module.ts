import { DynamicModule, Global, Module } from '@nestjs/common';
import { BullModule as NestBullModule } from '@nestjs/bull';
import Redis, { Cluster } from 'ioredis';
import { RedisInjectToken, RedisModule } from '@app/common/redis';
import { BullModuleOptions } from '@nestjs/bull/dist/interfaces/bull-module-options.interface';
import { BullQueue } from './const';

@Global()
@Module({
  imports: [
    RedisModule,

    NestBullModule.forRootAsync({
      useFactory: (client: Redis | Cluster) => ({
        createClient(type): Redis | Cluster {
          if (type === 'client') {
            return client;
          }

          if (client.isCluster) {
            return (client as Cluster).duplicate([], {
              enableReadyCheck: false,
              maxRetriesPerRequest: null,
            });
          } else {
            return (client as Redis).duplicate({
              enableReadyCheck: false,
              maxRetriesPerRequest: null,
            });
          }
        },
      }),
      inject: [RedisInjectToken],
    }),
  ],
})
export class BullModule {
  static registerQueue = (...options: (BullModuleOptions & { name: BullQueue })[]) => {
    return NestBullModule.registerQueue(
      ...options.map((item) => ({
        ...item,
        defaultJobOptions: {
          removeOnComplete: {
            age: 60 * 60, // keep up to 1 hour
            count: 100, // keep up to 100 jobs
          },
          removeOnFail: {
            age: 24 * 60 * 60, // keep up to 24 hours
          },
          ...item.defaultJobOptions,
        },
        settings: {
          lockDuration: 5 * 60 * 60 * 1000, // 5 min in ms
          ...item.settings,
        },
      })),
    );
  };
}
