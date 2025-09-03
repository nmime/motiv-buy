export interface LoginDto {
  telegramId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
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