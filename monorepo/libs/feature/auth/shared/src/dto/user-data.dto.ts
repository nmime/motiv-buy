import { AuthJwtApp } from '../const';

export class UserData {
  app!: AuthJwtApp;
  userId!: string;
  telegramId?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
  isPremium?: boolean;
  isBlocked?: boolean;
  premiumUntil?: Date;
  referralCode?: string;

  constructor(data: Partial<UserData>) {
    Object.assign(this, data);
  }
}