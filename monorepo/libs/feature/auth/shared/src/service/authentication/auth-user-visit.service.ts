import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { UserSourceVisitEntity } from '@app/database';
import { SourceParameters, SourceRegisterService, VisitDataParams, getGeoByIp } from '../../source';
import { TelegramAuthParams, UserRefLink } from '../../type';

@Injectable()
export class AuthUserVisitService {
  private readonly logger: Logger = new Logger(this.constructor.name);

  constructor(private readonly sourceRegisterService: SourceRegisterService) {}

  async registerVisit(
    userId: string,
    createUserDto: TelegramAuthParams,
    language: string | undefined,
    isSignup: boolean,
    entityManager: EntityManager,
    sourceParams?: SourceParameters,
    userRefLink?: UserRefLink,
  ): Promise<UserSourceVisitEntity> {
    const visitParams = this.prepareVisitDataParams(userId, createUserDto, language, isSignup);

    const visitData = this.sourceRegisterService.prepareVisitData(visitParams, sourceParams, userRefLink);

    return await this.sourceRegisterService.registerVisit(visitData, entityManager);
  }

  private prepareVisitDataParams(
    userId: string,
    telegramAuthParams: TelegramAuthParams,
    language: string | undefined,
    isSignup: boolean,
  ): VisitDataParams {
    const geo = this.getGeoFromIP(telegramAuthParams.ip);

    return {
      userId,
      platformType: telegramAuthParams.platformType,
      platformData: telegramAuthParams.platformData,
      params: telegramAuthParams.userSource,
      language,
      isSignup,
      telegramLanguage: telegramAuthParams.languageCode,
      country: geo?.country?.name,
      city: geo?.city,
      continent: geo?.continent,
      ip: telegramAuthParams.ip,
    };
  }

  private getGeoFromIP(ip?: string) {
    if (!ip) {
      return undefined;
    }

    try {
      return getGeoByIp(ip) ?? undefined;
    } catch (error) {
      this.logger.error('Error while getting geo by ip', { ip, error });

      return undefined;
    }
  }
}
