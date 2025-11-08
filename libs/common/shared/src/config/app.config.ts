import { ConfigService } from '@nestjs/config';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  host: string;
  apiPrefix: string;
  corsEnabled: boolean;
}

export function createAppConfig(configService: ConfigService): AppConfig {
  return {
    nodeEnv: configService.get<string>('NODE_ENV', 'development'),
    port: configService.get<number>('PORT', 3000),
    host: configService.get<string>('HOST', '0.0.0.0'),
    apiPrefix: configService.get<string>('API_PREFIX', 'api/v1'),
    corsEnabled: configService.get<boolean>('CORS_ENABLED', true),
  };
}
