import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { UserSourceVisitEntity, UserSourceVisitRepository } from '@app/database';
import { GetSourceParamsService, SourceParameters } from './get-source-params.service';
import { GetUserRefLinkService } from './get-user-ref-link.service';
import { SourceRegisterService, VisitDataParams } from './source-register.service';
import { getGeoByIp } from '../util';
import { TelegramAuthParams } from '../../type';

@Injectable()
export class UserVisitService {
  private readonly logger: Logger = new Logger(this.constructor.name);

  constructor(
    private readonly sourceRegisterService: SourceRegisterService,
    private readonly userSourceVisitRepository: UserSourceVisitRepository,
    private readonly getSourceParamsService: GetSourceParamsService,
    private readonly getUserRefLinkService: GetUserRefLinkService,
  ) {}

  registerVisit(
    userId: string,
    createUserDto: TelegramAuthParams,
    language: string | undefined,
    isSignup: boolean,
    sourceParams?: SourceParameters,
    userRefLink?: { userId: string },
  ): UserSourceVisitEntity {
    const visitParams = this.prepareVisitDataParams(userId, createUserDto, language, isSignup);

    const visitData = this.sourceRegisterService.prepareVisitData(visitParams, sourceParams, userRefLink);

    return this.userSourceVisitRepository.create(visitData);
  }

  async registerVisitWithEntityManager(
    userId: string,
    createUserDto: TelegramAuthParams,
    language: string | undefined,
    isSignup: boolean,
    entityManager: EntityManager,
    sourceParams?: SourceParameters,
    userRefLink?: { userId: string },
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
      return getGeoByIp(ip);
    } catch (error: unknown) {
      this.logger.error('Error while getting geo by ip', { ip, error });

      return undefined;
    }
  }
}
