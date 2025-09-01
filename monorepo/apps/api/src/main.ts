import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { ApiModule } from './api.module';
import { createAppConfig } from '@app/shared-config';
import { ProblemValidationPipe } from '@app/common-validation';
import { ProblemResponseTransformer } from '@app/common-response';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    ApiModule,
    new FastifyAdapter({ 
      logger: true,
      disableRequestLogging: false,
      trustProxy: true
    })
  );
  const configService = app.get(ConfigService);
  const appConfig = createAppConfig(configService);

  app.setGlobalPrefix(appConfig.apiPrefix);

  app.useGlobalPipes(new ProblemValidationPipe({ transform: true }));

  if (appConfig.corsEnabled) {
    await app.register(require('@fastify/cors'), {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
  }

  // Setup problem response transformer for RFC 9457 compliance
  ProblemResponseTransformer.setup(app);

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
  
  Logger.log(
    `🚀 API Application is running on: http://${appConfig.host}:${appConfig.port}/${appConfig.apiPrefix}`
  );
  
  if (appConfig.nodeEnv !== 'production') {
    Logger.log(
      `📚 Swagger documentation: http://${appConfig.host}:${appConfig.port}/${appConfig.apiPrefix}/docs`
    );
  }
}

bootstrap().catch(err => {
  Logger.error('❌ Error starting application', err);
  process.exit(1);
});
