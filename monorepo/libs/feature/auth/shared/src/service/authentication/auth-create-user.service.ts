import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { UserEntity, UserRepository } from '@app/database';
import { defaultLanguage, Language } from '@app/common-shared';
import { TelegramAuthParams, UserRefLink } from '../../type';

@Injectable()
export class AuthCreateUserService {
  private readonly logger: Logger = new Logger(this.constructor.name);

  constructor(private readonly userRepository: UserRepository) {}

  async createUser(
    createUserDto: TelegramAuthParams,
    entityManager: EntityManager,
    userRefLink?: UserRefLink,
  ): Promise<UserEntity> {
    const userLanguage = this.determineUserLanguage(createUserDto);

    const userData = {
      username: createUserDto.username,
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      telegramId: createUserDto.telegramId,
      ...(userLanguage && { languageCode: userLanguage }),
      ...(userRefLink?.userId && { referredBy: userRefLink.userId }),
    };

    const user = new UserEntity(userData);

    entityManager.persist(user);
    await entityManager.flush();

    return user;
  }

  determineLanguage(languageCode: string | undefined): Language {
    const isLanguage = (value: unknown): value is Language => {
      return Object.values(Language).includes(value as Language);
    };

    return isLanguage(languageCode) ? languageCode : defaultLanguage;
  }

  private determineUserLanguage(createUserDto: TelegramAuthParams): Language | undefined {
    if (createUserDto.languageCode) {
      return this.determineLanguage(createUserDto.languageCode);
    }

    return undefined;
  }
}
