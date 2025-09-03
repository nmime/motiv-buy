import { LinkType } from '../const';

export class UserRefLinkDto {
  code!: string;
  url!: string;
  linkType!: LinkType;
  createdAt!: Date;
  isActive?: boolean;
  usageCount?: number;
  maxUsages?: number;

  constructor(data: UserRefLinkDto) {
    Object.assign(this, data);
  }
}
