// Temporary type stubs for database module
declare module '@app/database' {
  export class UserEntity {
    id: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    telegramId?: string;
    languageCode?: string;
    createdAt: Date;
    updatedAt: Date;
  }

  export class UserRepository {
    findOne(conditions: any): Promise<UserEntity | null>;
    findByTelegramId(telegramId: string): Promise<UserEntity | null>;
    getEntityManager(): any;
  }

  export class UserLastAuthRepository {
    upsertUserLastAuth(data: any, entityManager?: any): Promise<void>;
  }

  export class UserSourceVisitEntity {
    id: string;
    userId: string;
    country?: string;
    city?: string;
    continent?: string;
    createdAt: Date;
  }

  export enum PlatformType {
    Web = 'web',
    Bot = 'bot',
    Mobile = 'mobile',
  }

  export type UserSourceVisitPlatformData = Record<string, any>;
}
