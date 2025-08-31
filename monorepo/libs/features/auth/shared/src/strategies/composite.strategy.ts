import { Strategy } from 'passport-strategy';
import { ExtractJwt } from 'passport-jwt';
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { AuthJwtService } from '../services';
import { UserRepository } from '@app/database';

interface AuthRequest {
  headers: {
    authorization?: string;
  };
}

@Injectable()
export class CompositeStrategy extends PassportStrategy(Strategy, 'composite') {
  constructor(
    private readonly authJwtService: AuthJwtService,
    private readonly userRepository: UserRepository,
  ) {
    super();
  }

  override async authenticate(req: AuthRequest) {
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);

    if (!token) {
      return this.fail(new ForbiddenException('No token provided'), 401);
    }

    const payload = await this.authJwtService.verifyToken(token);
    if (!payload) {
      return this.fail(new ForbiddenException('Invalid token'), 401);
    }

    const user = await this.userRepository.findOne({ id: payload.userId });
    if (!user || !user.isActive) {
      return this.fail(new ForbiddenException('User not found or inactive'), 401);
    }

    return this.success({
      userId: user.id,
      telegramId: user.telegramId,
      username: user.username,
    });
  }
}
