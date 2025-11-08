import { PlatformType } from '@app/database';

export class AuthJwtPayloadDto {
  app!: PlatformType;
  userId!: string;
  jti?: string;
  uniqueKey!: string;
  iat?: number;
  exp?: number;

  constructor(object: AuthJwtPayloadDto) {
    Object.assign(this, object);
  }
}
