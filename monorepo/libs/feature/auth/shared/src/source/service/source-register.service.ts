import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { GetSourceParamsService, SourceParameters } from './get-source-params.service';
import { PlatformType, UserSourceVisitEntity } from '@app/database';
import { TelegramAuthParams } from '../../type';

export interface VisitDataParams {
  userId: string;
  platformType: PlatformType;
  platformData?: Record<string, unknown>;
  params?: string;
  language?: string;
  telegramLanguage?: string;
  country?: string;
  city?: string;
  continent?: string;
  ip?: string;
  isSignup?: boolean;
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
    sourceParams?: SourceParameters,
    userRefLink?: { userId: string },
  ): UserSourceVisitEntity {
    return new UserSourceVisitEntity({
      userId,
      linkUserId: userRefLink?.userId,
      platformType,
      platformData,
      params,
      utmSource: sourceParams?.utmSource,
      utmMedium: sourceParams?.utmMedium,
      utmCampaign: sourceParams?.utmCampaign,
      utmContent: sourceParams?.utmContent,
      linkType: sourceParams?.linkType,
      linkCode: sourceParams?.linkCode,
      language,
      telegramLanguage,
      country,
      ip,
      city,
      continent,
      isSignup,
    });
  }

  getAnalyticsProperties(
    visit: UserSourceVisitEntity,
    telegramAuthParams?: TelegramAuthParams,
  ): Record<string, unknown> {
    const visitObj = Object.entries(visit as unknown as Record<string, unknown>).filter(
      ([key]) => !this.excludedFields.includes(key),
    );

    const visitFields: Record<string, unknown> = {};
    visitObj.forEach(([key, value]: [string, unknown]) => {
      const snakeKey = this.camelToSnakeCase(key);
      visitFields[snakeKey] = value;
    });

    visitFields['telegram_id'] = telegramAuthParams?.telegramId ?? null;
    visitFields['telegram_username'] = telegramAuthParams?.username ?? null;
    visitFields['telegram_first_name'] = telegramAuthParams?.firstName ?? null;
    visitFields['telegram_last_name'] = telegramAuthParams?.lastName ?? null;

    const initialProperties: Record<string, unknown> = {};
    Object.entries(visitFields).forEach(([key, value]: [string, unknown]) => {
      initialProperties[`initial_${key}`] = value;
    });

    const latestProperties: Record<string, unknown> = {};
    Object.entries(visitFields).forEach(([key, value]: [string, unknown]) => {
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
