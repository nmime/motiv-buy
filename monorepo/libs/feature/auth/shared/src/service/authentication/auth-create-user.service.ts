import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { UserRepository, UserEntity } from '@app/database';
import { Language, defaultLanguage } from '@app/common-shared';
import { TelegramAuthParams } from '../../dto';
import { UserRefLink } from '../../dto';

const isLanguage = (value: any): value is Language => {
  return Object.values(Language).includes(value);
};

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
    
    await entityManager.persist(user);
    await entityManager.flush();

    return user;
  }

  determineLanguage(languageCode: string | undefined): Language {
    return isLanguage(languageCode) ? languageCode : defaultLanguage;
  }

  private determineUserLanguage(createUserDto: TelegramAuthParams): Language | undefined {
    if (createUserDto.languageCode) {
      return this.determineLanguage(createUserDto.languageCode);
    }

    return undefined;
  }
}
