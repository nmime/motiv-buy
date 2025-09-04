import { PlatformType } from '../const';

export type PlatformDataMap = {
  [PlatformType.TelegramMiniApp]: {
    telegramVersion?: string;
    telegramPlatform?: string;
  };
  [PlatformType.TelegramBot]: Record<string, never>;
  [PlatformType.TelegramWidget]: Record<string, never>;
};

export type UserSourceVisitPlatformData<T extends PlatformType = PlatformType> = 
  T extends keyof PlatformDataMap ? PlatformDataMap[T] : Record<string, unknown>;
