import { DynamicModule, Global, Module, Provider, Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  JetStreamService,
  NatsConnectionService,
  NatsEventService,
  NatsMessageService,
  NatsQueueService,
} from './service';
import type { NatsConfig } from './interface';

/**
 * NATS Module Options
 */
export interface NatsModuleOptions {
  /** Use global module */
  isGlobal?: boolean;

  /** NATS configuration */
  config?: NatsConfig;

  /** Use ConfigService for configuration */
  useConfigService?: boolean;
}

/**
 * NATS Injection Token
 */
export const NatsConfigToken = 'NATS_CONFIG';

/**
 * NATS Module
 *
 * Provides NATS JetStream functionality for:
 * - Job Queues (background tasks, delayed jobs)
 * - Event Streaming (pub/sub)
 * - Message Broker (reliable delivery)
 */
@Global()
@Module({})
export class NatsModule {
  /**
   * Register NATS module synchronously
   */
  static forRoot(options: NatsModuleOptions = {}): DynamicModule {
    const configProvider: Provider = {
      provide: NatsConfigToken,
      useValue: options.config || this.getDefaultConfig(),
    };

    return {
      global: options.isGlobal !== false,
      module: NatsModule,
      imports: [],
      providers: [
        configProvider,
        {
          provide: NatsConnectionService,
          useFactory: (config: NatsConfig) => new NatsConnectionService(config),
          inject: [NatsConfigToken],
        },
        JetStreamService,
        NatsQueueService,
        NatsEventService,
        NatsMessageService,
      ],
      exports: [NatsConnectionService, JetStreamService, NatsQueueService, NatsEventService, NatsMessageService],
    };
  }

  /**
   * Register NATS module asynchronously
   */
  static forRootAsync(options: {
    isGlobal?: boolean;
    useFactory?: (...args: unknown[]) => Promise<NatsConfig> | NatsConfig;
    inject?: Array<Type<unknown> | string | symbol>;
  }): DynamicModule {
    const configProvider: Provider = {
      provide: NatsConfigToken,
      useFactory: options.useFactory || (async () => this.getDefaultConfig()),
      inject: options.inject || [],
    };

    return {
      global: options.isGlobal !== false,
      module: NatsModule,
      imports: [ConfigModule],
      providers: [
        configProvider,
        {
          provide: NatsConnectionService,
          useFactory: (config: NatsConfig) => new NatsConnectionService(config),
          inject: [NatsConfigToken],
        },
        JetStreamService,
        NatsQueueService,
        NatsEventService,
        NatsMessageService,
      ],
      exports: [NatsConnectionService, JetStreamService, NatsQueueService, NatsEventService, NatsMessageService],
    };
  }

  /**
   * Get default NATS configuration
   */
  private static getDefaultConfig(): NatsConfig {
    return {
      servers: [process.env['NATS_URL'] || 'nats://localhost:4222'],
      name: process.env['NATS_CLIENT_NAME'] || 'motiv-buy-app',
      user: process.env['NATS_USER'],
      pass: process.env['NATS_PASSWORD'],
      token: process.env['NATS_TOKEN'],
      maxReconnectAttempts: -1,
      reconnectTimeWait: 2000,
      timeout: 20000,
    };
  }
}
