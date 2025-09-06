import { Injectable, Logger } from '@nestjs/common';
import { UserRepository, UserRefLinkRepository } from '@app/database';
import { UserRefLink } from '../../dto/user-ref-link.dto';
import { SourceParameters } from './get-source-params.service';

@Injectable()
export class GetUserRefLinkService {
  private readonly logger: Logger = new Logger(this.constructor.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly userRefLinkRepository: UserRefLinkRepository,
  ) {}

  async resolveUserRefLink(sourceParams: SourceParameters): Promise<UserRefLink | null> {
    const { linkCode, refCode } = sourceParams;
    const code = refCode || linkCode;

    if (!code) {
      return null;
    }

    try {
      const refLinkEntity = await this.userRefLinkRepository.findByRefCode(code);

      if (refLinkEntity && !refLinkEntity.isDeleted) {
        return new UserRefLink({
          id: refLinkEntity.id,
          type: refLinkEntity.type,
          sourceType: refLinkEntity.sourceType,
          sourceId: refLinkEntity.sourceId,
          userId: refLinkEntity.userId,
          refCode: refLinkEntity.refCode,
          refCodeUniqueKey: refLinkEntity.refCodeUniqueKey,
          defaultUniqueKey: refLinkEntity.defaultUniqueKey,
          refPercentLevel1: refLinkEntity.refPercentLevel1,
          refPercentLevel2: refLinkEntity.refPercentLevel2,
          refPercentLevel3: refLinkEntity.refPercentLevel3,
          isDefault: refLinkEntity.isDefault,
          isCustom: refLinkEntity.isCustom,
          isDeleted: refLinkEntity.isDeleted,
          createdAt: refLinkEntity.createdAt,
          updatedAt: refLinkEntity.updatedAt,
        });
      }

      return null;
    } catch (error) {
      this.logger.error(`Error resolving user ref link for code ${code}`, error);
      return null;
    }
  }

  async resolveReferrerUserId(sourceParams: SourceParameters): Promise<string | undefined> {
    const { linkCode, refCode } = sourceParams;
    const code = refCode || linkCode;

    if (!code) {
      return undefined;
    }

    try {
      const user = await this.userRepository.findByTelegramId(code);
      if (user && user.isActive) {
        return String(user.id);
      }

      const userByUsername = await this.userRepository.findByUsername(code);
      if (userByUsername && userByUsername.isActive) {
        return String(userByUsername.id);
      }

      return undefined;
    } catch (error) {
      this.logger.error(`Error resolving referrer user ID for code ${code}`, error);
      return undefined;
    }
  }
}
