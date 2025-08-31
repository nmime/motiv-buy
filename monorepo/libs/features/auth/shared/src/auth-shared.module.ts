import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthConfigModule } from './config';
import { authJwtModuleOptions } from './const';
import { 
  AuthJwtService, 
  AuthService, 
  GetSourceParamsService,
  GetUserRefLinkService,
  SourceRegisterService,
  UserVisitService 
} from './services';
import { JwtStrategy, CompositeStrategy } from './strategies';
import { UserRepository, UserSourceVisitRepository } from '@app/database';
import { RedisModule } from '@app/common-redis';

@Module({
  imports: [
    AuthConfigModule,
    RedisModule,
    JwtModule.register(authJwtModuleOptions),
  ],
  providers: [
    AuthJwtService,
    AuthService,
    GetSourceParamsService,
    GetUserRefLinkService,
    SourceRegisterService,
    UserVisitService,
    
    JwtStrategy,
    CompositeStrategy,
    
    UserRepository,
    UserSourceVisitRepository,
  ],
  exports: [
    AuthJwtService,
    AuthService,
    GetSourceParamsService,
    GetUserRefLinkService,
    SourceRegisterService,
    UserVisitService,
    JwtStrategy,
    CompositeStrategy,
    JwtModule,
  ],
})
export class AuthSharedModule {}
