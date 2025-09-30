import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { URL } from 'url';
import { v4 as uuidV4 } from 'uuid';
import { checkSignature, validateWebAppData } from '@grammyjs/validator';
import { AsyncResult } from '@app/common-shared';
import { Ok, Err } from 'ts-results';
import {
  AuthConfigService,
  AuthJwtCacheService,
  AuthJwtPayloadDto,
  AuthResultDto,
  AuthUserService,
  TelegramAuthParams,
  getGeoByIp,
} from '@app/feature-auth-shared';
import {
  NotInDevModeException,
  TmaDataValidationException,
  UserBlockedException,
  UserNotFoundException,
} from '@app/common-exception';
import { UserRepository, UserLastAuthRepository, UserStatus, UserRole, UserEntity } from '@app/database';
import { PlatformType } from '@app/database';
import { TelegramWidgetAuthDto } from '../dto';
import { AuthUserData } from '../type';

@Injectable()
export class AuthService {
  private readonly logger: Logger = new Logger(this.constructor.name);

  constructor(
    private readonly authUserService: AuthUserService,
    private readonly configService: AuthConfigService,
    private readonly userRepository: UserRepository,
    private readonly userLastAuthRepository: UserLastAuthRepository,
    private readonly jwtService: JwtService,
    private readonly authJwtCacheService: AuthJwtCacheService,
  ) {}

  async authDev(
    userId: string,
    platformType: PlatformType = PlatformType.TelegramBot,
  ): AsyncResult<AuthResultDto, NotInDevModeException | UserBlockedException | UserNotFoundException> {
    if (!this.configService.isDev) {
      return Err(new NotInDevModeException());
    }

    const user = await this.userRepository.findOne({ telegramId: userId });
    if (!user) {
      return Err(new UserNotFoundException());
    }

    if (user.status !== UserStatus.Active && user.status !== UserStatus.Restricted) {
      return Err(new UserBlockedException());
    }

    const payload = this.packPayload(platformType, user.id);
    const jwtToken = await this.createJwt({ ...payload });

    return Ok(
      new AuthResultDto({
        token: jwtToken,
      }),
    );
  }

  async authTma(params: {
    hostname: string;
    url: string;
    app?: PlatformType;
    ip: string;
  }): AsyncResult<AuthResultDto, TmaDataValidationException | UserBlockedException | UserNotFoundException> {
    const { hostname, url, app = PlatformType.TelegramMiniApp, ip } = params;
    const { searchParams } = new URL(`https://${hostname}${url}`);

    const userSearchParam = searchParams.get('user');
    if (!userSearchParam) {
      return Err(new TmaDataValidationException('Data validation failed'));
    }

    let userData: AuthUserData;
    try {
      userData = JSON.parse(userSearchParam) as AuthUserData;
    } catch (error) {
      this.logger.error('Failed to parse user data', error);

      return Err(new TmaDataValidationException('Data validation failed'));
    }

    if (!this.configService.isDev) {
      const rawAuthDate = searchParams.get('auth_date');
      const authDate = rawAuthDate ? new Date(rawAuthDate) : undefined;
      if (!authDate || new Date().getTime() - authDate.getTime() > 3 * 60 * 1000) {
        return Err(new TmaDataValidationException('Auth date expired'));
      }
    }

    const validationParams = new URLSearchParams(
      [...searchParams].filter(([key]) => key !== 'telegram_platform' && key !== 'telegram_version'),
    );

    const success = validateWebAppData(this.configService.botToken, validationParams);
    if (!success) {
      return Err(new TmaDataValidationException('Data validation failed'));
    }

    return this.auth({
      userData: {
        id: userData.id,
        firstName: userData.first_name,
        lastName: userData.last_name,
        username: userData.username,
        languageCode: userData.language_code,
      },
      additionalParams: {
        startParam: searchParams.get('start_param') ?? undefined,
        telegramVersion: searchParams.get('telegram_version') ?? undefined,
        telegramPlatform: searchParams.get('telegram_platform') ?? undefined,
      },
      platformType: app,
      ip,
    });
  }

  async authTelegramWidget(params: {
    dto: TelegramWidgetAuthDto;
    ip: string;
  }): AsyncResult<AuthResultDto, TmaDataValidationException | UserBlockedException | UserNotFoundException> {
    const { dto, ip } = params;

    if (!this.configService.isDev) {
      const authTimestamp = Number(dto.auth_date) * 1000;
      const currentTime = new Date().getTime();
      const maxAuthAge = 24 * 60 * 60 * 1000;

      if (currentTime - authTimestamp > maxAuthAge) {
        return Err(new TmaDataValidationException('Auth date expired'));
      }
    }

    const isValid = checkSignature(this.configService.botToken, {
      id: dto.id,
      first_name: dto.first_name,
      auth_date: dto.auth_date,
      hash: dto.hash,
      ...(dto.last_name && { last_name: dto.last_name }),
      ...(dto.photo_url && { photo_url: dto.photo_url }),
      ...(dto.username && { username: dto.username }),
    });

    if (!isValid) {
      return Err(new TmaDataValidationException('Data validation failed'));
    }

    return this.auth({
      userData: {
        id: dto.id,
        firstName: dto.first_name,
        lastName: dto.last_name,
        username: dto.username,
        languageCode: undefined,
      },
      additionalParams: {
        utmSource: dto.utmSource,
        utmMedium: dto.utmMedium,
        utmCampaign: dto.utmCampaign,
        utmContent: dto.utmContent,
        refCode: dto.refCode,
      },
      platformType: PlatformType.TelegramWidget,
      ip,
    });
  }

  async auth(params: {
    userData: {
      id: string;
      firstName: string;
      lastName?: string;
      username?: string;
      languageCode?: string;
    };
    additionalParams?: {
      startParam?: string;
      telegramVersion?: string;
      telegramPlatform?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      utmContent?: string;
      refCode?: string;
    };
    platformType: PlatformType;
    ip: string;
  }): AsyncResult<AuthResultDto, TmaDataValidationException | UserBlockedException | UserNotFoundException> {
    const { userData, additionalParams = {}, ip, platformType } = params;
    const { startParam, telegramVersion, telegramPlatform, utmSource, utmMedium, utmCampaign, utmContent, refCode } =
      additionalParams;

    const userParams = new TelegramAuthParams({
      telegramId: userData.id,
      username: userData.username,
      firstName: userData.firstName,
      lastName: userData.lastName,
      languageCode: userData.languageCode,
      userSource: startParam,
      platformType,
      platformData: {
        telegramVersion,
        telegramPlatform,
      },
      sourceParams: {
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        refCode,
      },
      ip,
    });

    const user = await this.authUserService.findOrCreateByWebAuth(userParams, {
      trackAnalytics: true,
      trackUserVisit: true,
      trackUserLastAuth: true,
      updateUserFields: true,
    });

    if (!user) {
      return Err(new UserNotFoundException());
    }

    if (this.configService.isDev && !this.hasDevAccess(user)) {
      return Err(new UserNotFoundException());
    }

    if (user.status !== UserStatus.Active && user.status !== UserStatus.Restricted) {
      return Err(new UserBlockedException());
    }

    const payload = this.packPayload(platformType, user.id);
    const jwtToken = await this.createJwt({ ...payload });

    return Ok(
      new AuthResultDto({
        token: jwtToken,
      }),
    );
  }

  private async saveKey(payload: AuthJwtPayloadDto): Promise<void> {
    await this.authJwtCacheService.saveJwtKey(payload);
  }

  private packPayload(app: PlatformType, userId: string): AuthJwtPayloadDto {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn24Hours = now + 24 * 60 * 60;

    return new AuthJwtPayloadDto({
      app,
      userId,
      uniqueKey: uuidV4(),
      jti: uuidV4(),
      iat: now,
      exp: expiresIn24Hours,
    });
  }

  private async createJwt(payload: AuthJwtPayloadDto): Promise<string> {
    await this.saveKey(payload);

    const plainPayload = { ...payload };

    return this.jwtService.signAsync(plainPayload, {
      secret: this.configService.jwtSecret,
    });
  }

  private hasDevAccess(user: UserEntity): boolean {
    return user.role === UserRole.Admin || user.role === UserRole.Developer;
  }
}
