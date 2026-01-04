import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RedisModule } from '@app/common-redis';
import { AuthConfigModule, AuthConfigService } from './config';
import { createAuthJwtModuleOptions } from './const';
import {
  AuthCreateUserService,
  AuthJwtCacheService,
  AuthJwtValidationService,
  AuthUserService,
  AuthUserVisitService,
  GetSourceParamsService,
  GetUserRefLinkService,
  SourceRegisterService,
  UserVisitService,
} from './service';
import { JwtStrategy } from './strategy';

/**
 * Auth shared module.
 * Note: Repositories are provided globally by DatabaseModule, no need to re-provide them here.
 */
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
    AuthCreateUserService,
    AuthUserVisitService,
    GetSourceParamsService,
    GetUserRefLinkService,
    SourceRegisterService,
    UserVisitService,
    JwtStrategy,
  ],
  exports: [
    AuthJwtCacheService,
    AuthJwtValidationService,
    AuthUserService,
    AuthCreateUserService,
    AuthUserVisitService,
    GetSourceParamsService,
    GetUserRefLinkService,
    SourceRegisterService,
    UserVisitService,
    JwtStrategy,
    JwtModule,
  ],
})
export class AuthSharedModule {}
