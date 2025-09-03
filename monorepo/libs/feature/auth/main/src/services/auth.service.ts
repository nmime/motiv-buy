import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { URL } from 'url';
import { v4 as uuidV4 } from 'uuid';
import { checkSignature, validateWebAppData } from '@grammyjs/validator';
import { AsyncResult } from '@app/common-shared';
import {
  AuthConfigService,
  AuthJwtApp,
  AuthJwtCacheService,
  AuthJwtPayloadDto,
  AuthResultDto,
  AuthUserService,
  TelegramAuthParams,
} from '@app/feature-auth-shared';
import {
  NotInDevModeException,
  TmaDataValidationException,
  UserBlockedException,
  UserNotFoundException,
} from '@app/common-exception';
import { UserRepository } from '@app/database';
import { PlatformType } from '@app/database';
import { AuthUserDataDto, TelegramWidgetAuthDto } from '../dto';

@Injectable()
export class AuthService {
  private readonly logger: Logger = new Logger(AuthService.name);

  constructor(
    private readonly authUserService: AuthUserService,
    private readonly configService: AuthConfigService,
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly authJwtCacheService: AuthJwtCacheService,
  ) {}

  async authDev(
    userId: string,
    app: AuthJwtApp = AuthJwtApp.TelegramBot,
  ): AsyncResult<AuthResultDto, NotInDevModeException | UserBlockedException | UserNotFoundException> {
    if (!this.configService.isDev) {
      return { success: false, error: new NotInDevModeException() };
    }

    const user = await this.userRepository.findOne({ telegramId: userId });
    if (!user) {
      return { success: false, error: new UserNotFoundException() };
    }

    if (!user.isActive) {
      return { success: false, error: new UserBlockedException() };
    }

    const payload = this.packPayload(app, user.id);
    const jwtToken = await this.createJwt({ ...payload });

    return {
      success: true,
      data: new AuthResultDto({
        token: jwtToken,
      }),
    };
  }

  async authTma(params: {
    hostname: string;
    url: string;
    app?: AuthJwtApp;
    ip: string;
  }): AsyncResult<AuthResultDto, TmaDataValidationException | UserBlockedException | UserNotFoundException> {
    const { hostname, url, app = AuthJwtApp.TelegramMiniApp, ip } = params;
    const { searchParams } = new URL(`https://${hostname}${url}`);

    const userSearchParam = searchParams.get('user');
    if (!userSearchParam) {
      return { success: false, error: new TmaDataValidationException('Data validation failed') };
    }

    let userData: AuthUserDataDto;
    try {
      userData = JSON.parse(userSearchParam) as AuthUserDataDto;
    } catch (e) {
      return { success: false, error: new TmaDataValidationException('Data validation failed', e) };
    }

    if (!this.configService.isDev) {
      const rawAuthDate = searchParams.get('auth_date');
      const authDate = rawAuthDate ? new Date(rawAuthDate) : undefined;
      if (!authDate || new Date().getTime() - authDate.getTime() > 3 * 60 * 1000) {
        return { success: false, error: new TmaDataValidationException('Auth date expired') };
      }
    }

    const validationParams = new URLSearchParams(
      [...searchParams].filter(
        ([key]) => key !== 'telegram_platform' && key !== 'telegram_version' && key !== 'timezone',
      ),
    );

    const success = validateWebAppData(this.configService.botToken, validationParams);
    if (!success) {
      return { success: false, error: new TmaDataValidationException('Data validation failed') };
    }

    return this.auth({
      userData: {
        id: userData.id,
        firstName: userData.first_name,
        lastName: userData.last_name,
        username: userData.username,
        languageCode: userData.language_code,
        isPremium: userData.is_premium,
      },
      additionalParams: {
        startParam: searchParams.get('start_param') ?? undefined,
        telegramVersion: searchParams.get('telegram_version') ?? undefined,
        telegramPlatform: searchParams.get('telegram_platform') ?? undefined,
        timezone: searchParams.get('timezone') ?? undefined,
      },
      app,
      platformType: PlatformType.Telegram,
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
        return { success: false, error: new TmaDataValidationException('Auth date expired') };
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
      return { success: false, error: new TmaDataValidationException('Data validation failed') };
    }

    return this.auth({
      userData: {
        id: dto.id,
        firstName: dto.first_name,
        lastName: dto.last_name,
        username: dto.username,
        languageCode: undefined,
        isPremium: undefined,
      },
      additionalParams: {
        utmSource: dto.utmSource,
        utmMedium: dto.utmMedium,
        utmCampaign: dto.utmCampaign,
        utmContent: dto.utmContent,
        refCode: dto.refCode,
        timezone: dto.timezone,
      },
      app: AuthJwtApp.TelegramWidget,
      platformType: PlatformType.WEB,
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
      isPremium?: boolean | string;
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
      timezone?: string;
    };
    app?: AuthJwtApp;
    platformType: PlatformType;
    ip: string;
  }): AsyncResult<AuthResultDto, TmaDataValidationException | UserBlockedException | UserNotFoundException> {
    const { userData, additionalParams = {}, app = AuthJwtApp.TelegramMiniApp, ip, platformType } = params;
    const { startParam, telegramVersion, telegramPlatform, utmSource, utmMedium, utmCampaign, utmContent, refCode } =
      additionalParams;

    const userParams = new TelegramAuthParams({
      telegramId: userData.id,
      username: userData.username,
      firstName: userData.firstName,
      lastName: userData.lastName,
      languageCode: userData.languageCode,
      timezone: additionalParams.timezone,
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
      return { success: false, error: new UserNotFoundException() };
    }

    if (this.configService.isDev && !this.hasDevAccess(user)) {
      return { success: false, error: new UserNotFoundException() };
    }

    if (!user.isActive) {
      return { success: false, error: new UserBlockedException() };
    }

    const payload = this.packPayload(app, user.id);
    const jwtToken = await this.createJwt({ ...payload });

    return {
      success: true,
      data: new AuthResultDto({
        token: jwtToken,
      }),
    };
  }

  private async saveKey(payload: AuthJwtPayloadDto): Promise<void> {
    await this.authJwtCacheService.saveJwtKey(payload);
  }

  private packPayload(app: AuthJwtApp, userId: string): AuthJwtPayloadDto {
    return new AuthJwtPayloadDto({
      app,
      userId,
      uniqueKey: uuidV4(),
    });
  }

  private async createJwt(payload: AuthJwtPayloadDto): Promise<string> {
    await this.saveKey(payload);

    return this.jwtService.sign(payload, { secret: this.configService.jwtSecret, expiresIn: '1d' });
  }

  private hasDevAccess(user: any): boolean {
    return user.isCreator || user.isAdmin || user.isDev || false;
  }
}