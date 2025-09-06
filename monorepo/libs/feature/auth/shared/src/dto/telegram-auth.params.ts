import { PlatformType } from '@app/database';
import { LinkType } from '../source';

export class TelegramAuthParams {
  telegramId!: string;
  username?: string;
  firstName!: string;
  lastName?: string;
  languageCode?: string;
  userSource?: string;
  platformType!: PlatformType;
  platformData?: {
    telegramVersion?: string;
    telegramPlatform?: string;
  };
  sourceParams?: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    refCode?: string;
    linkType?: LinkType;
    linkCode?: string;
  };
  ip?: string;

  constructor(params: TelegramAuthParams) {
    Object.assign(this, params);
  }
}
