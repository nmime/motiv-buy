import { PlatformType, UserSourceVisitPlatformData } from '@app/database';

export interface User {
  id: number;
  telegramId: string;
  username: string;
  firstName: string;
  lastName?: string;
  languageCode?: string;
  status: string;
}

export interface IUserRepository {
  findByTelegramId(telegramId: string): Promise<User | null>;
  findOne(criteria: { id: number }): Promise<User | null>;
  create(userData: Partial<User>): Promise<User>;
}


export interface CreateUserData {
  telegramId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
}