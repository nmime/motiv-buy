import { UserRefLinkType } from '@app/database';

export class UserRefLink {
  id!: string;
  type!: UserRefLinkType;
  sourceType?: string;
  sourceId?: string;
  userId!: string;
  refCode!: string;
  refCodeUniqueKey!: string;
  defaultUniqueKey!: string;
  refPercentLevel1!: string;
  refPercentLevel2!: string;
  refPercentLevel3!: string;
  isDefault!: boolean;
  isCustom!: boolean;
  isDeleted!: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(data: Partial<UserRefLink>) {
    Object.assign(this, data);
  }
}