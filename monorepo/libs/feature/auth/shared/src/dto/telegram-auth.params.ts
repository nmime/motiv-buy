import { PlatformType } from '@app/database';

export class TelegramAuthParams {
  telegramId!: string;
  username?: string;
  firstName!: string;
  lastName?: string;
  languageCode?: string;
  timezone?: string;
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
  };
  ip?: string;

  constructor(params: TelegramAuthParams) {
    Object.assign(this, params);
  }
}
