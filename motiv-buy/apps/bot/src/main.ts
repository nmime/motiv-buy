/**
 * Bot Application Bootstrap
 * 
 * Entry point for the Telegram bot service.
 * Configures Grammy bot with proper middleware and handlers.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { BotModule } from './bot.module';
import { BotService } from './service/bot.service';
import { createAppConfig } from '@app/shared-config';

async function bootstrap() {
  const app = await NestFactory.create(BotModule);
  const configService = app.get(ConfigService);
  const appConfig = createAppConfig(configService);
  const botService = app.get(BotService);

  // Initialize and start the bot
  await botService.start();

  Logger.log('🤖 Telegram Bot Application is running');
  Logger.log(`🌍 Environment: ${appConfig.nodeEnv}`);
  
  // Graceful shutdown
  process.once('SIGINT', () => botService.stop());
  process.once('SIGTERM', () => botService.stop());
}

bootstrap().catch(err => {
  Logger.error('❌ Error starting bot application', err);
  process.exit(1);
});
