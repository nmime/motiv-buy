import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { UnauthorizedException } from '@app/common-exception';
import { AuthJwtPayloadDto, UserData } from '../dto';
import { AuthJwtValidationService } from '../service';
import { AuthConfigService } from '../config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly authJwtValidationService: AuthJwtValidationService,
    private readonly authConfigService: AuthConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: authConfigService.jwtSecret,
    });
  }

  async validate(payload: AuthJwtPayloadDto): Promise<UserData> {
    const result = await this.authJwtValidationService.validate(payload);

    if (result.err) {
      throw new UnauthorizedException(result.val.message || 'Token validation failed');
    }

    return result.val;
  }
}
