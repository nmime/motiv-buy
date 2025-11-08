import { Injectable, Logger } from '@nestjs/common';
import { UserRefLinkRepository } from '@app/database';
import { UserRefLink } from '../../type';
import { SourceParameters } from './get-source-params.service';
import { LinkType } from '../const';

type LinkResolver = (code: string) => Promise<UserRefLink | null>;

@Injectable()
export class GetUserRefLinkService {
  private readonly logger: Logger = new Logger(this.constructor.name);

  private readonly resolvers: Record<LinkType, LinkResolver>;

  constructor(private readonly userRefLinkRepository: UserRefLinkRepository) {
    this.resolvers = {
      [LinkType.Referral]: this.resolveReferral.bind(this),
      [LinkType.Invite]: this.resolveInvite.bind(this),
    };
  }

  async resolveUserRefLink(sourceParams: SourceParameters): Promise<UserRefLink | null> {
    const { linkType, linkCode, refCode } = sourceParams;
    if ((!linkType || !linkCode) && !refCode) {
      return null;
    }

    try {
      if (linkType && linkCode) {
        const resolver = this.resolvers?.[linkType];
        if (resolver) {
          const resolved = await resolver(linkCode);
          if (resolved) {
            return resolved;
          }
        }
      }

      if (refCode) {
        return await this.resolveReferral(refCode);
      }

      return null;
    } catch (error: unknown) {
      this.logger.error(`Error resolving link user ID for type ${linkType} and code ${linkCode}`, error);
      throw error;
    }
  }

  private async resolveReferral(code: string): Promise<UserRefLink | null> {
    const customRef = (await this.userRefLinkRepository.findByRefCode(code)) as UserRefLink | null;
    if (customRef && !customRef.isDeleted) {
      const userIdValue = (customRef as unknown as { user: { id: string } }).user.id;

      return new UserRefLink({
        id: customRef.id,
        type: customRef.type,
        sourceType: customRef.sourceType,
        sourceId: customRef.sourceId,
        userId: userIdValue,
        refCode: customRef.refCode,
        refCodeUniqueKey: customRef.refCodeUniqueKey,
        defaultUniqueKey: customRef.defaultUniqueKey,
        refPercentLevel1: customRef.refPercentLevel1,
        refPercentLevel2: customRef.refPercentLevel2,
        refPercentLevel3: customRef.refPercentLevel3,
        isDefault: customRef.isDefault,
        isCustom: customRef.isCustom,
        isDeleted: customRef.isDeleted,
        createdAt: customRef.createdAt,
        updatedAt: customRef.updatedAt,
      });
    }

    return null;
  }

  private resolveInvite(code: string): Promise<UserRefLink | null> {
    // NOTE: Invite link resolution pending implementation
    this.logger.debug(`Invite link resolution not implemented for code: ${code}`);

    return Promise.resolve(null);
  }
}
