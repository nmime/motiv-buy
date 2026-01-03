// Suppress url.parse() deprecation warning from nats library (DEP0169)
// The nats library uses url.parse() internally which triggers this warning
// This is a known issue and will be fixed when nats updates to use WHATWG URL API
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && warning.message.includes('url.parse()')) {
    return;
  }

  // eslint-disable-next-line no-console -- Early boot-time handler before NestJS Logger is available
  console.warn(warning.name, warning.message);
});

/**
 * Bot Application Bootstrap
 *
 * Entry point for the Telegram bot service.
 * Configures Grammy bot with proper middleware and handlers.
 *
 * Environment Variables:
 * - CLUSTER_MODE=true - Enable cluster mode with multiple workers (separate for API and Bot)
 * - CLUSTER_WORKERS=N - Number of worker processes (defaults to CPU count, separate for API and Bot)
 * - BOT_PORT - Bot service port (default: 5502, reserved for future HTTP server)
 * - TELEGRAM_BOT_TOKEN - Telegram Bot API token (required)
 * - NODE_ENV - Environment (development/production)
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { BotModule } from './bot.module';
import { BotService } from './service';
import { createAppConfig } from '@app/common-shared';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(BotModule, new FastifyAdapter({ logger: false }));

  const configService = app.get(ConfigService);
  const appConfig = createAppConfig(configService);
  const botService = app.get(BotService);

  // Same API prefix as API service for consistency
  const apiPrefix = 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  await botService.start();

  const port = parseInt(process.env.BOT_PORT || '5502', 10);
  await app.listen(port, '0.0.0.0');

  Logger.log('🤖 Telegram Bot Application is running');
  Logger.log(`🏥 Health endpoint: http://0.0.0.0:${port}/${apiPrefix}/health`);
  Logger.log(`🌍 Environment: ${appConfig.nodeEnv}`);

  process.once('SIGINT', async () => {
    await botService.stop();
  });

  process.once('SIGTERM', async () => {
    await botService.stop();
  });
}

bootstrap().catch((err: unknown) => {
  Logger.error('❌ Error starting bot application', err);
  process.exit(1);
});
