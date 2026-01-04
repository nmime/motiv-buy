import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { UserEntity, UserLastAuthRepository, UserRepository, UserSourceVisitEntity } from '@app/database';
import { AuthCreateUserService } from './auth-create-user.service';
import { AuthUserVisitService } from './auth-user-visit.service';
import { getGeoByIp, GetSourceParamsService, GetUserRefLinkService, SourceRegisterService } from '../../source';
import { TelegramAuthParams, UserRefLink } from '../../type';

interface FindOrCreateOptions {
  trackUserVisit?: boolean;
  trackAnalytics?: boolean;
  trackUserLastAuth?: boolean;
  updateUserFields?: boolean;
}

@Injectable()
export class AuthUserService {
  private readonly logger: Logger = new Logger(AuthUserService.name);

  constructor(
    private readonly usersRepository: UserRepository,
    private readonly userLastAuthRepository: UserLastAuthRepository,
    private readonly createUserService: AuthCreateUserService,
    private readonly userVisitService: AuthUserVisitService,
    private readonly sourceRegisterService: SourceRegisterService,
    private readonly getSourceParamsService: GetSourceParamsService,
    private readonly getUserRefLinkService: GetUserRefLinkService,
  ) {}

  async findOrCreateByWebAuth(
    telegramAuthParams: TelegramAuthParams,
    options?: FindOrCreateOptions,
  ): Promise<UserEntity> {
    return (await this.findOrCreateWithVisit(telegramAuthParams, options)).user;
  }

  async findOrCreateByBot(telegramAuthParams: TelegramAuthParams, options?: FindOrCreateOptions): Promise<UserEntity> {
    const result = await this.findOrCreateWithVisit(telegramAuthParams, {
      trackUserVisit: options?.trackUserVisit ?? false,
      trackAnalytics: options?.trackAnalytics ?? false,
      trackUserLastAuth: options?.trackUserLastAuth ?? false,
      updateUserFields: options?.updateUserFields ?? true,
    });

    return result.user;
  }

  /**
   * Find user by Telegram platform ID
   * @param platformId - Telegram user ID as string
   * @returns User entity or null if not found
   */
  async findByPlatformId(platformId: string): Promise<UserEntity | null> {
    return await this.usersRepository.findOne({
      telegramId: platformId,
    });
  }

  private async findOrCreateWithVisit(
    telegramAuthParams: TelegramAuthParams,
    options?: FindOrCreateOptions,
  ): Promise<{ user: UserEntity; visit?: UserSourceVisitEntity; isSignup: boolean }> {
    const em = this.usersRepository.getEntityManager();

    return await em.transactional(async (entityManager: EntityManager) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let sourceParams: any;

      const { sourceParams: directSourceParams, userSource } = telegramAuthParams;

      if (directSourceParams) {
        sourceParams = directSourceParams;
      } else if (userSource) {
        sourceParams = this.getSourceParamsService.parseRequest(userSource);
      } else {
        sourceParams = undefined;
      }

      let userRefLink: UserRefLink | undefined;

      if (sourceParams && ((sourceParams.linkType && sourceParams.linkCode) || sourceParams.refCode)) {
        userRefLink = (await this.getUserRefLinkService.resolveUserRefLink(sourceParams)) ?? undefined;
      }

      let user = await this.usersRepository.findOne({
        telegramId: telegramAuthParams.telegramId,
      });

      let isSignup = false;

      if (!user) {
        user = await this.createUserService.createUser(telegramAuthParams, entityManager, userRefLink);
        isSignup = true;
      } else if (options?.updateUserFields) {
        await this.updateUserFields(user, telegramAuthParams, entityManager);
      }

      let visit: UserSourceVisitEntity | undefined;
      if (options?.trackUserVisit) {
        visit = await this.userVisitService.registerVisit(
          user.id,
          telegramAuthParams,
          user.language,
          isSignup,
          entityManager,
          sourceParams,
          userRefLink,
        );
      }

      if (options?.trackUserLastAuth) {
        await this.updateUserLastAuth(user.id, telegramAuthParams, visit, entityManager);
      }

      return { user, visit, isSignup };
    });
  }

  private async updateUserFields(
    user: UserEntity,
    telegramAuthParams: TelegramAuthParams,
    entityManager: EntityManager,
  ): Promise<void> {
    const updates: Partial<UserEntity> = {
      firstName: telegramAuthParams.firstName,
      lastName: telegramAuthParams.lastName,
      username: telegramAuthParams.username,
      ...(!user.language && {
        language: this.createUserService.determineLanguage(telegramAuthParams.languageCode),
      }),
    };

    const hasChanges = Object.entries(updates).some(([key, value]) => {
      if (!value) {
        return false;
      }

      const currentValue = user[key as keyof UserEntity];

      return currentValue !== value;
    });

    if (hasChanges) {
      await entityManager.nativeUpdate(UserEntity, { id: user.id }, updates);
      Object.assign(user, updates);
    }
  }

  private async updateUserLastAuth(
    userId: string,
    telegramAuthParams: TelegramAuthParams,
    visit: UserSourceVisitEntity | undefined,
    entityManager: EntityManager,
  ): Promise<void> {
    let geo;
    try {
      geo = telegramAuthParams.ip ? getGeoByIp(telegramAuthParams.ip) : undefined;
    } catch (error: unknown) {
      this.logger.error('Error while getting geo by ip', { ip: telegramAuthParams.ip, error });
      geo = undefined;
    }

    await this.userLastAuthRepository.upsertUserLastAuth(
      {
        userId,
        ip: telegramAuthParams.ip,
        country: geo?.country?.name || visit?.country || undefined,
        city: geo?.city || visit?.city || undefined,
        continent: geo?.continent || visit?.continent || undefined,
      },
      entityManager,
    );
  }
}
