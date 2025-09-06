import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@app/database';

/**
 * Bot Application Module
 *
 * Thin composition root that wires up domain modules for bot functionality.
 * No business logic should be implemented here.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    DatabaseModule,
  ],
  providers: [],
})
export class BotModule {}
