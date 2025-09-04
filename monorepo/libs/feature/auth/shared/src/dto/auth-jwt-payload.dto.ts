import { PlatformType } from '@app/database';
import { AuthTokenType } from '../const';

export class AuthJwtPayloadDto {
  app!: PlatformType;
  userId!: string;
  jti?: string;
  uniqueKey?: string;
  type?: AuthTokenType;
  iat?: number;
  exp?: number;

  constructor(object: AuthJwtPayloadDto) {
    Object.assign(this, object);
  }
}
