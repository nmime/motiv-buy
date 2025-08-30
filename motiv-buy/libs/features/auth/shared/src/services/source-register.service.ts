import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { GetSourceParamsService } from './get-source-params.service';
import { UserSourceVisitEntity, PlatformType } from '@app/database';

export interface VisitDataParams {
  userId: string;
  platformType: PlatformType;
  platformData?: any;
  params?: string;
  language?: string;
  telegramLanguage?: string;
  country?: string;
  city?: string;
  continent?: string;
  ip?: string;
  isSignup?: boolean;
}

export interface TelegramAuthParams {
  telegramId?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}

@Injectable()
export class SourceRegisterService {
  private readonly logger: Logger = new Logger(this.constructor.name);
  private readonly excludedFields = ['id', 'createdAt', 'user', 'linkUser'];

  constructor(private readonly getSourceParamsService: GetSourceParamsService) {}

  prepareVisitData(
    {
      userId,
      platformType,
      platformData,
      params,
      language,
      isSignup = false,
      telegramLanguage,
      country,
      ip,
      city,
      continent,
    }: VisitDataParams,
    referrerUserId?: string,
  ): UserSourceVisitEntity {
    const sourceParams = this.getSourceParamsService.parseRequest(params);

    return new UserSourceVisitEntity({
      userId,
      platformType,
      platformData,
      params,
      utmSource: sourceParams?.utmSource,
      utmMedium: sourceParams?.utmMedium,
      utmCampaign: sourceParams?.utmCampaign,
      utmContent: sourceParams?.utmContent,
      linkType: sourceParams?.linkType,
      linkCode: sourceParams?.linkCode,
      linkUserId: referrerUserId,
      language,
      telegramLanguage,
      country,
      ip,
      city,
      continent,
      isSignup,
    });
  }

  getAnalyticsProperties(visit: UserSourceVisitEntity, telegramAuthParams?: TelegramAuthParams): Record<string, unknown> {
    const visitObj = Object.entries(visit as unknown as Record<string, unknown>).filter(
      ([key]) => !this.excludedFields.includes(key),
    );

    const visitFields: Record<string, unknown> = {};
    visitObj.forEach(([key, value]) => {
      const snakeKey = this.camelToSnakeCase(key);
      visitFields[snakeKey] = value;
    });

    visitFields['telegram_id'] = telegramAuthParams?.telegramId;
    visitFields['telegram_username'] = telegramAuthParams?.username;
    visitFields['telegram_first_name'] = telegramAuthParams?.firstName;
    visitFields['telegram_last_name'] = telegramAuthParams?.lastName;

    const initialProperties: Record<string, unknown> = {};
    Object.entries(visitFields).forEach(([key, value]) => {
      initialProperties[`initial_${key}`] = value;
    });

    const latestProperties: Record<string, unknown> = {};
    Object.entries(visitFields).forEach(([key, value]) => {
      latestProperties[key] = value;
    });

    return {
      ...visitFields,
      ['$set']: latestProperties,
      ['$set_once']: initialProperties,
    };
  }

  async registerVisit(visit: UserSourceVisitEntity, entityManager: EntityManager): Promise<UserSourceVisitEntity> {
    await entityManager.persistAndFlush(visit);
    return visit;
  }

  private camelToSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
}