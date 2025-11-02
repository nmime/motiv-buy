import type { JwtModuleOptions } from '@nestjs/jwt';
import { AuthConfigService } from '../config';

export const createAuthJwtModuleOptions = (authConfigService: AuthConfigService): JwtModuleOptions => ({
  global: true,
  secret: authConfigService.jwtSecret,
  signOptions: {
    // @ts-expect-error - string is compatible with StringValue at runtime, but TypeScript strict mode doesn't recognize this
    expiresIn: authConfigService.jwtExpiresIn,
  },
});
