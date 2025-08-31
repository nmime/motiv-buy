import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthConfigService } from '../config';
import { v4 as uuidV4 } from 'uuid';

export interface JwtPayload {
  userId: string;
  jti: string; // JWT ID for revocation
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthJwtService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: AuthConfigService,
  ) {}

  async createToken(userId: string): Promise<string> {
    const payload: JwtPayload = {
      userId,
      jti: uuidV4(),
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.jwtSecret,
      expiresIn: '7d',
    });
  }

  async verifyToken(token: string): Promise<JwtPayload | null> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.jwtSecret,
      });
      return payload;
    } catch {
      return null;
    }
  }

  decodeToken(token: string): JwtPayload | null {
    try {
      return this.jwtService.decode(token) as JwtPayload;
    } catch {
      return null;
    }
  }
}