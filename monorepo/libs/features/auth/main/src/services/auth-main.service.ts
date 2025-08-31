import { Injectable } from '@nestjs/common';
import { AuthService, AuthJwtService } from '@app/feature-auth-shared';
import { UserRepository, PlatformType } from '@app/database';
import { AuthConfigService } from '@app/feature-auth-shared';
import { VisitDataParams, TelegramAuthParams } from '@app/feature-auth-shared';

export interface LoginDto {
  telegramId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  isPremium?: boolean;
  startParam?: string;
  telegramVersion?: string;
  telegramPlatform?: string;
  url?: string;
  userAgent?: string;
  ip?: string;
  country?: string;
  city?: string;
  continent?: string;
}

export interface LoginResult {
  success: boolean;
  token?: string;
  error?: string;
  isNewUser?: boolean;
}

@Injectable()
export class AuthMainService {
  constructor(
    private readonly authService: AuthService,
    private readonly authJwtService: AuthJwtService,
    private readonly userRepository: UserRepository,
    private readonly configService: AuthConfigService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResult> {
    const visitParams: VisitDataParams = {
      userId: '',
      platformType: PlatformType.TELEGRAM,
      params: dto.startParam,
      platformData: {
        telegramVersion: dto.telegramVersion,
        telegramPlatform: dto.telegramPlatform,
      },
      language: dto.languageCode,
      ip: dto.ip,
      country: dto.country,
      city: dto.city,
      continent: dto.continent,
    };

    const telegramAuthParams: TelegramAuthParams = {
      telegramId: dto.telegramId,
      username: dto.username,
      firstName: dto.firstName,
      lastName: dto.lastName,
    };

    const existingUser = await this.userRepository.findByTelegramId(dto.telegramId);
    
    if (existingUser) {
      visitParams.userId = existingUser.id;
      const result = await this.authService.authenticateUser(dto.telegramId, visitParams, telegramAuthParams);
      return {
        ...result,
        isNewUser: false,
      };
    }

    const result = await this.authService.createUser({
      telegramId: dto.telegramId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      username: dto.username,
      languageCode: dto.languageCode,
    }, visitParams, telegramAuthParams);

    return {
      ...result,
      isNewUser: true,
    };
  }

  async devLogin(telegramId: string): Promise<LoginResult> {
    if (!this.configService.isDev) {
      return {
        success: false,
        error: 'Dev mode is disabled',
      };
    }

    const result = await this.authService.authenticateUser(telegramId);
    return {
      ...result,
      isNewUser: false,
    };
  }

  async validateToken(token: string): Promise<any> {
    return this.authService.validateToken(token);
  }
}
