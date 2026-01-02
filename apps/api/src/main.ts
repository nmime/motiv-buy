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
import { isClusterModeEnabled, setupCluster } from './cluster';

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

  // Setup Swagger documentation

  // External API Swagger - X-API-Key authentication (for traffic sources)
  const externalConfig = new DocumentBuilder()
    .setTitle('Motiv-Buy External API')
    .setDescription(
      'External API for traffic source integration.\n\n' +
        '**Authentication:** Pass your API key via `X-API-Key` header.\n\n' +
        '📚 [Detailed HTML Documentation](docs/external/html)',
    )
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'X-API-Key')
    .build();

  const externalDocument = SwaggerModule.createDocument(app, externalConfig, {
    deepScanRoutes: true,
    operationIdFactory: (controllerKey: string, methodKey: string) => `${controllerKey}_${methodKey}`,
  });

  // Filter to only include external API tags
  const externalTags = ['Traffic Source - External API'];
  externalDocument.paths = Object.fromEntries(
    Object.entries(externalDocument.paths).filter(([, pathItem]) => {
      const operations = Object.values(pathItem as Record<string, { tags?: string[] }>);

      return operations.some((op) => op.tags?.some((tag) => externalTags.includes(tag)));
    }),
  );

  SwaggerModule.setup(`${appConfig.apiPrefix}/docs/external`, app, externalDocument);

  // Private API Swagger - JWT Bearer authentication required (always available)
  const privateConfig = new DocumentBuilder()
    .setTitle('Motiv-Buy Private API')
    .setDescription('Private endpoints - requires JWT Bearer authentication')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const privateDocument = SwaggerModule.createDocument(app, privateConfig, {
    deepScanRoutes: true,
    operationIdFactory: (controllerKey: string, methodKey: string) => `${controllerKey}_${methodKey}`,
  });

  // Filter to exclude public tags, webhooks, and external API
  const excludeTags = [
    'health',
    'auth',
    'public-statistics',
    'Payment Webhooks',
    'Bot Webhook',
    'Traffic Source - External API',
  ];

  privateDocument.paths = Object.fromEntries(
    Object.entries(privateDocument.paths).filter(([, pathItem]) => {
      const operations = Object.values(pathItem as Record<string, { tags?: string[] }>);

      return operations.some((op) => op.tags?.every((tag) => !excludeTags.includes(tag)));
    }),
  );

  SwaggerModule.setup(`${appConfig.apiPrefix}/docs/private`, app, privateDocument);

  // Public API Swagger - No authentication required (development only)
  if (appConfig.nodeEnv !== 'production') {
    const publicConfig = new DocumentBuilder()
      .setTitle('Motiv-Buy Public API')
      .setDescription('Public endpoints - authentication, health checks, public statistics')
      .setVersion('1.0')
      .build();

    const publicDocument = SwaggerModule.createDocument(app, publicConfig, {
      include: [],
      deepScanRoutes: true,
      operationIdFactory: (controllerKey: string, methodKey: string) => `${controllerKey}_${methodKey}`,
    });

    // Filter to only include public tags
    const publicTags = ['health', 'auth', 'public-statistics'];
    publicDocument.paths = Object.fromEntries(
      Object.entries(publicDocument.paths).filter(([, pathItem]) => {
        const operations = Object.values(pathItem as Record<string, { tags?: string[] }>);

        return operations.some((op) => op.tags?.some((tag) => publicTags.includes(tag)));
      }),
    );

    SwaggerModule.setup(`${appConfig.apiPrefix}/docs/public`, app, publicDocument);
  }

  await app.listen(appConfig.port, appConfig.host);

  const clusterMode = isClusterModeEnabled() ? ' (cluster mode)' : '';
  Logger.log(
    `🚀 API Application is running on: http://${appConfig.host}:${appConfig.port}/${appConfig.apiPrefix}${clusterMode}`,
  );

  Logger.log(`📚 Swagger (Private): http://${appConfig.host}:${appConfig.port}/${appConfig.apiPrefix}/docs/private`);

  Logger.log(`📚 External API Docs: http://${appConfig.host}:${appConfig.port}/${appConfig.apiPrefix}/docs/external`);

  if (appConfig.nodeEnv !== 'production') {
    Logger.log(`📚 Swagger (Public): http://${appConfig.host}:${appConfig.port}/${appConfig.apiPrefix}/docs/public`);
  }

  Logger.log(`🌍 Environment: ${appConfig.nodeEnv}`);
  Logger.log(`⚙️  Process ID: ${process.pid}`);
}

// Start application with optional cluster mode
setupCluster(bootstrap).catch((err: unknown) => {
  Logger.error('❌ Error starting application', err);
  process.exit(1);
});
