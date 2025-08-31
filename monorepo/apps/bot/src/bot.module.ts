import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from '@app/user/main';
import { DatabaseModule } from '@app/database';
import { BotService } from './service/bot.service';

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
      envFilePath: ['.env.local', '.env'],
    }),

    DatabaseModule,

    UserModule,
  ],
  providers: [
    BotService,
  ],
})
export class BotModule {}
