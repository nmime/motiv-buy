import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RedisModule } from '@app/common-redis';
import { UserRepository, UserSourceVisitRepository } from '@app/database';
import { AuthConfigModule } from './config';
import { createAuthJwtModuleOptions } from './const';
import { AuthConfigService } from './config';
import {
  AuthJwtCacheService,
  AuthJwtValidationService,
  AuthUserService,
  GetSourceParamsService,
  GetUserRefLinkService,
  SourceRegisterService,
  UserVisitService,
} from './service';
import { JwtStrategy } from './strategy';

@Module({
  imports: [
    RedisModule,
    AuthConfigModule,
    JwtModule.registerAsync({
      inject: [AuthConfigService],
      useFactory: createAuthJwtModuleOptions,
    }),
  ],
  providers: [
    AuthJwtCacheService,
    AuthJwtValidationService,
    AuthUserService,
    GetSourceParamsService,
    GetUserRefLinkService,
    SourceRegisterService,
    UserVisitService,
    JwtStrategy,
    UserRepository,
    UserSourceVisitRepository,
  ],
  exports: [
    AuthJwtCacheService,
    AuthJwtValidationService,
    AuthUserService,
    GetSourceParamsService,
    GetUserRefLinkService,
    SourceRegisterService,
    UserVisitService,
    JwtStrategy,
    UserRepository,
    UserSourceVisitRepository,
  ],
})
export class AuthSharedModule {}
