import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import fastifyCors from '@fastify/cors';
import { ApiModule } from './api.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    ApiModule,
    new FastifyAdapter({
      logger: true,
      disableRequestLogging: false,
      trustProxy: true,
    }),
  );

  // Simple app config inline
  const appConfig = {
    apiPrefix: process.env.API_PREFIX || 'api',
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
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

  Logger.log(`🚀 API Application is running on: http://${appConfig.host}:${appConfig.port}/${appConfig.apiPrefix}`);

  if (appConfig.nodeEnv !== 'production') {
    Logger.log(`📚 Swagger documentation: http://${appConfig.host}:${appConfig.port}/${appConfig.apiPrefix}/docs`);
  }
}

bootstrap().catch((err: unknown) => {
  Logger.error('❌ Error starting application', err);
  process.exit(1);
});
