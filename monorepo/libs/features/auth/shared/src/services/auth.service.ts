import { Injectable } from '@nestjs/common';
import { UserRepository } from '@app/database';
import { AuthJwtService } from './auth-jwt.service';
import { AuthConfigService } from '../config';
import { UserVisitService } from './user-visit.service';
import { VisitDataParams, TelegramAuthParams } from './source-register.service';

export interface AuthResult {
  success: boolean;
  token?: string;
  error?: string;
}

export interface UserPayload {
  id: string;
  telegramId: string;
  username?: string;
  firstName: string;
  lastName?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly authJwtService: AuthJwtService,
    private readonly configService: AuthConfigService,
    private readonly userVisitService: UserVisitService,
  ) {}

  async authenticateUser(telegramId: string, visitParams?: VisitDataParams, telegramAuthParams?: TelegramAuthParams): Promise<AuthResult> {
    const user = await this.userRepository.findByTelegramId(telegramId);
    
    if (!user) {
      return {
        success: false,
        error: 'User not found',
      };
    }

    if (!user.isActive) {
      return {
        success: false,
        error: 'User is blocked',
      };
    }

    const token = await this.authJwtService.createToken(user.id);

    await this.userRepository.updateLastActive(telegramId);

    if (visitParams) {
      await this.userVisitService.trackUserVisit({
        userId: user.id,
        isSignup: false,
        ...visitParams,
      }, telegramAuthParams);
    }

    return {
      success: true,
      token,
    };
  }

  async createUser(data: {
    telegramId: string;
    username?: string;
    firstName: string;
    lastName?: string;
    languageCode?: string;
    referredBy?: string;
  }, visitParams?: VisitDataParams, telegramAuthParams?: TelegramAuthParams): Promise<AuthResult> {
    const existingUser = await this.userRepository.findByTelegramId(data.telegramId);
    
    if (existingUser) {
      return this.authenticateUser(data.telegramId, visitParams, telegramAuthParams);
    }

    const user = await this.userRepository.createUser({
      telegramId: data.telegramId,
      username: data.username,
      firstName: data.firstName,
      lastName: data.lastName,
      languageCode: data.languageCode,
      referredBy: data.referredBy,
      isActive: true,
      isPremium: false,
    });

    const token = await this.authJwtService.createToken(user.id);

    if (visitParams) {
      await this.userVisitService.trackUserVisit({
        userId: user.id,
        isSignup: true,
        ...visitParams,
      }, telegramAuthParams);
    }

    return {
      success: true,
      token,
    };
  }

  async validateToken(token: string): Promise<UserPayload | null> {
    const payload = await this.authJwtService.verifyToken(token);
    
    if (!payload) {
      return null;
    }

    const user = await this.userRepository.findOne({ id: payload.userId });
    
    if (!user || !user.isActive) {
      return null;
    }

    return {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }
}