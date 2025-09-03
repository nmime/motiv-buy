import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { UnauthorizedException } from '@app/common-exception';
import { AuthJwtPayloadDto, UserData } from '../dto';
import { TokenType } from '../const';
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
    // Check for exchange token type and reject if needed
    if (payload.type === TokenType.Exchange) {
      throw new UnauthorizedException('Invalid token type for this endpoint');
    }

    // Validate payload using the validation service
    const result = await this.authJwtValidationService.validate(payload);

    if (result.err) {
      throw new UnauthorizedException(result.val.message || 'Token validation failed');
    }

    return result.val;
  }
}
