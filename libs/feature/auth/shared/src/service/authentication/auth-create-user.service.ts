import { Injectable, Logger } from '@nestjs/common';
import { EntityManager, ref } from '@mikro-orm/core';
import { randomBytes } from 'crypto';
import {
  UserEntity,
  UserRefLinkEntity,
  UserRefLinkRepository,
  UserRefLinkType,
  UserRefPercentLevel1,
  UserRefPercentLevel3,
  UserRepository,
} from '@app/database';
import { defaultLanguage, Language } from '@app/common-shared';
import { TelegramAuthParams, UserRefLink } from '../../type';

@Injectable()
export class AuthCreateUserService {
  private readonly logger: Logger = new Logger(this.constructor.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly userRefLinkRepository: UserRefLinkRepository,
  ) {}

  async createUser(
    createUserDto: TelegramAuthParams,
    entityManager: EntityManager,
    userRefLink?: UserRefLink,
  ): Promise<UserEntity> {
    const userLanguage = this.determineUserLanguage(createUserDto);
    const refCode = this.generateRefCode();

    const userData = {
      username: createUserDto.username,
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      telegramId: createUserDto.telegramId,
      ...(userLanguage && { language: userLanguage }),
      ...(userRefLink?.userId && { referredBy: userRefLink.userId }),
    };

    const user = new UserEntity(userData);

    entityManager.persist(user);
    await entityManager.flush();

    // Create default UserRefLink for the new user
    const userDefaultRefLink = await this.createDefaultRefLink(user, refCode, entityManager);

    // Update user with ref link levels
    user.refLinkLevel1 = userDefaultRefLink.id;

    // If user was referred, set their ref link levels based on referrer
    if (userRefLink) {
      user.refLinkLevel1 = userRefLink.id;

      const referrer = await this.userRepository.findOne({ id: userRefLink.userId });

      if (referrer) {
        user.refLinkLevel2 = referrer.refLinkLevel1;
        user.refLinkLevel3 = referrer.refLinkLevel2;
      }
    }

    await entityManager.flush();

    return user;
  }

  private async createDefaultRefLink(
    user: UserEntity,
    refCode: string,
    entityManager: EntityManager,
  ): Promise<UserRefLinkEntity> {
    const level2Percent = UserRefLinkEntity.level1ToLevel2RefPercent(UserRefPercentLevel1.Default);

    const userRefLink = new UserRefLinkEntity({
      user: ref(entityManager.getReference(UserEntity, user.id)),
      type: UserRefLinkType.User,
      refCode,
      refPercentLevel1: UserRefPercentLevel1.Default,
      refPercentLevel2: level2Percent,
      refPercentLevel3: UserRefPercentLevel3.Default,
      refCodeUniqueKey: refCode,
      defaultUniqueKey: user.id,
      isDefault: true,
      isCustom: false,
      isDeleted: false,
    });

    entityManager.persist(userRefLink);
    await entityManager.flush();

    return userRefLink;
  }

  private generateRefCode(length = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomArray = randomBytes(length);

    for (let i = 0; i < length; i++) {
      result += chars[randomArray[i] % chars.length];
    }

    return result;
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
