import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RedisModule } from '@app/common-redis';
import {
  UserLastAuthRepository,
  UserRefLinkRepository,
  UserRepository,
  UserSourceVisitRepository,
} from '@app/database';
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
    UserRepository,
    UserRefLinkRepository,
    UserSourceVisitRepository,
    UserLastAuthRepository,
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
    UserRepository,
    UserRefLinkRepository,
    UserSourceVisitRepository,
    UserLastAuthRepository,
  ],
})
export class AuthSharedModule {}
