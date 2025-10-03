import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RedisModule } from '@app/common-redis';
import { UserRepository, UserRefLinkRepository, UserSourceVisitRepository, UserLastAuthRepository } from '@app/database';
import { AuthConfigModule } from './config';
import { createAuthJwtModuleOptions } from './const';
import { AuthConfigService } from './config';
import {
  AuthJwtCacheService,
  AuthJwtValidationService,
  AuthUserService,
  AuthCreateUserService,
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
