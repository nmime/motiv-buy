import { JwtModuleOptions } from '@nestjs/jwt';
import { AuthConfigService } from '../config';

export const createAuthJwtModuleOptions = (authConfigService: AuthConfigService): JwtModuleOptions => ({
  global: true,
  secret: authConfigService.jwtSecret,
  signOptions: {
    expiresIn: authConfigService.jwtExpiresIn,
  },
});
