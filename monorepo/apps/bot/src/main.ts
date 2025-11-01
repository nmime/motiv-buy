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
import { BotService } from './service';
import { createAppConfig } from '@app/common-shared';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(BotModule);
  const configService = app.get(ConfigService);
  const appConfig = createAppConfig(configService);
  const botService = app.get(BotService);

  await botService.start();

  Logger.log('🤖 Telegram Bot Application is running');
  Logger.log(`🌍 Environment: ${appConfig.nodeEnv}`);

  process.once('SIGINT', () => {
    void botService.stop();
  });

  process.once('SIGTERM', () => {
    void botService.stop();
  });
}

bootstrap().catch((err: unknown) => {
  Logger.error('❌ Error starting bot application', err);
  process.exit(1);
});
