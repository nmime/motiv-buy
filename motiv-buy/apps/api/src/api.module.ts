import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from '@app/feature-user-main';
import { DatabaseModule } from '@app/database';
import { HealthController } from './health.controller';

/**
 * API Application Module
 * 
 * Thin composition root that wires up domain modules.
 * No business logic should be implemented here.
 */
@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Database connection
    DatabaseModule,

    // Domain modules
    UserModule,
  ],
  controllers: [
    HealthController,
  ],
})
export class ApiModule {}
