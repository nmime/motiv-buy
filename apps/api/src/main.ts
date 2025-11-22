// Suppress url.parse() deprecation warning from nats library (DEP0169)
// The nats library uses url.parse() internally which triggers this warning
// This is a known issue and will be fixed when nats updates to use WHATWG URL API
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && warning.message.includes('url.parse()')) {
    return;
  }
  console.warn(warning.name, warning.message);
});

/**
 * API Application Bootstrap
 *
 * Entry point for the REST API service.
 * Supports both single-process and cluster mode operation.
 *
 * Environment Variables:
 * - CLUSTER_MODE=true - Enable cluster mode with multiple workers (separate for API and Bot)
 * - CLUSTER_WORKERS=N - Number of worker processes (defaults to CPU count, separate for API and Bot)
 * - API_PORT - HTTP port (default: 5501)
 * - BOT_PORT - Bot service port (default: 5502, reserved for future HTTP server)
 * - API_HOST - Bind address (default: 0.0.0.0)
 * - API_PREFIX - API route prefix (default: api/v1)
 * - NODE_ENV - Environment (development/production)
 * - CORS_ENABLED - Enable CORS (default: true)
 */

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import fastifyCors from '@fastify/cors';
import { ApiModule } from './api.module';
import { setupCluster, isClusterModeEnabled } from './cluster';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    ApiModule,
    new FastifyAdapter({
      logger: false,
      trustProxy: true,
    }),
  );

  // Application configuration
  const appConfig = {
    apiPrefix: process.env.API_PREFIX || 'api/v1',
    port: parseInt(process.env.API_PORT || '5501', 10),
    host: process.env.API_HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
    corsEnabled: process.env.CORS_ENABLED !== 'false',
  };

  app.setGlobalPrefix(appConfig.apiPrefix);

  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  if (appConfig.corsEnabled) {
    await app.register(fastifyCors, {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
  }

  // Setup Swagger documentation in development
  if (appConfig.nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Motiv-Buy API')
      .setDescription('HTTP API for Motiv-Buy platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${appConfig.apiPrefix}/docs`, app, document);
  }

  await app.listen(appConfig.port, appConfig.host);

  const clusterMode = isClusterModeEnabled() ? ' (cluster mode)' : '';
  Logger.log(
    `🚀 API Application is running on: http://${appConfig.host}:${appConfig.port}/${appConfig.apiPrefix}${clusterMode}`,
  );

  if (appConfig.nodeEnv !== 'production') {
    Logger.log(`📚 Swagger documentation: http://${appConfig.host}:${appConfig.port}/${appConfig.apiPrefix}/docs`);
  }

  Logger.log(`🌍 Environment: ${appConfig.nodeEnv}`);
  Logger.log(`⚙️  Process ID: ${process.pid}`);
}

// Start application with optional cluster mode
setupCluster(bootstrap).catch((err: unknown) => {
  Logger.error('❌ Error starting application', err);
  process.exit(1);
});
