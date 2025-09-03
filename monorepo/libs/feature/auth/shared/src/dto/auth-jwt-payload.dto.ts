import { AuthJwtApp, TokenType } from '../const';

export class AuthJwtPayloadDto {
  app!: AuthJwtApp;
  userId!: string;
  jti?: string;
  uniqueKey?: string;
  type?: TokenType;
  iat?: number;
  exp?: number;

  constructor(object: AuthJwtPayloadDto) {
    Object.assign(this, object);
  }
}
