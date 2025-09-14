import { EntityManager, EntityRepository, ref } from '@mikro-orm/core';
import {
  UserRefLinkEntity,
  UserRefLinkType,
  UserRefPercentLevel1,
  UserRefPercentLevel2,
  UserRefPercentLevel3,
} from '../entity/UserRefLink.entity';
import { UserEntity } from '../entity';
import { randomBytes } from 'crypto';

export interface RefLinks {
  level1RefLink: UserRefLinkEntity | null;
  level2RefLink: UserRefLinkEntity | null;
  level3RefLink: UserRefLinkEntity | null;
}

export class UserRefLinkRepository extends EntityRepository<UserRefLinkEntity> {
  constructor(em: EntityManager) {
    super(em, UserRefLinkEntity);
  }

  async addRefLink(params: {
    userId: string;
    type: UserRefLinkType;
    refPercentLevel1: UserRefPercentLevel1 | string;
    refPercentLevel2?: UserRefPercentLevel2 | string;
    refPercentLevel3?: UserRefPercentLevel3 | string;
    isCustom: boolean;
    isDefault: boolean;
    refCode?: string;
    entityManager?: EntityManager;
  }): Promise<UserRefLinkEntity> {
    const {
      userId,
      type,
      isCustom,
      refPercentLevel1,
      refPercentLevel2,
      refPercentLevel3,
      isDefault,
      refCode,
      entityManager = this.em,
    } = params;

    const userRefCode = refCode || this.generateRefCode();
    const level2Percent = refPercentLevel2 ?? UserRefLinkEntity.level1ToLevel2RefPercent(refPercentLevel1);

    const userRefLink = new UserRefLinkEntity({
      user: ref(entityManager.getReference(UserEntity, userId)),
      type,
      refCode: userRefCode,
      refPercentLevel1: refPercentLevel1.toString(),
      refPercentLevel2: level2Percent,
      refPercentLevel3: refPercentLevel3?.toString() ?? UserRefPercentLevel3.Default,
      refCodeUniqueKey: userRefCode,
      defaultUniqueKey: isDefault ? userId : `${userId}_${this.generateUniqueKey()}`,
      isDefault,
      isCustom,
      isDeleted: false,
    });

    await entityManager.persistAndFlush(userRefLink);

    return userRefLink;
  }

  async findByRefCode(refCode: string): Promise<UserRefLinkEntity | null> {
    return this.findOne({ refCode, isDeleted: false });
  }

  async findDefaultByUserId(userId: string): Promise<UserRefLinkEntity | null> {
    return this.findOne({ user: userId, isDeleted: false, isDefault: true });
  }

  async getUserRefLinks(user: UserEntity): Promise<RefLinks> {
    const ids = [user.refLinkLevel1, user.refLinkLevel2, user.refLinkLevel3].filter((id): id is string => Boolean(id));

    if (ids.length === 0) {
      return { level1RefLink: null, level2RefLink: null, level3RefLink: null };
    }

    const links = await this.find({
      id: { $in: ids },
      isDeleted: false,
    });

    const linkMap = new Map(links.map((l) => [l.id, l]));

    return {
      level1RefLink: user.refLinkLevel1 ? (linkMap.get(user.refLinkLevel1) ?? null) : null,
      level2RefLink: user.refLinkLevel2 ? (linkMap.get(user.refLinkLevel2) ?? null) : null,
      level3RefLink: user.refLinkLevel3 ? (linkMap.get(user.refLinkLevel3) ?? null) : null,
    };
  }

  async getUserRefLinksBatch(users: UserEntity[]): Promise<Record<string, RefLinks>> {
    const result: Record<string, RefLinks> = {};

    const allRefLinkIds = new Set<string>();
    for (const user of users) {
      if (user.refLinkLevel1) {
        allRefLinkIds.add(user.refLinkLevel1);
      }

      if (user.refLinkLevel2) {
        allRefLinkIds.add(user.refLinkLevel2);
      }

      if (user.refLinkLevel3) {
        allRefLinkIds.add(user.refLinkLevel3);
      }
    }

    if (allRefLinkIds.size === 0) {
      for (const user of users) {
        result[user.id] = {
          level1RefLink: null,
          level2RefLink: null,
          level3RefLink: null,
        };
      }

      return result;
    }

    const links = await this.find({
      id: { $in: [...allRefLinkIds] },
      isDeleted: false,
    });

    const linkMap = new Map<string, UserRefLinkEntity>(links.map((link) => [link.id, link]));

    for (const user of users) {
      result[user.id] = {
        level1RefLink: user.refLinkLevel1 ? (linkMap.get(user.refLinkLevel1) ?? null) : null,
        level2RefLink: user.refLinkLevel2 ? (linkMap.get(user.refLinkLevel2) ?? null) : null,
        level3RefLink: user.refLinkLevel3 ? (linkMap.get(user.refLinkLevel3) ?? null) : null,
      };
    }

    return result;
  }

  async findActiveByUserId(userId: string): Promise<UserRefLinkEntity[]> {
    return this.find({ user: userId, isDeleted: false });
  }

  async softDelete(id: string, entityManager?: EntityManager): Promise<void> {
    const em = entityManager || this.em;
    await em.nativeUpdate(UserRefLinkEntity, { id }, { isDeleted: true });
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

  private generateUniqueKey(): string {
    return randomBytes(16).toString('hex');
  }
}
