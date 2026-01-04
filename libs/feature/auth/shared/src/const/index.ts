export * from './jwt-module-options.const';
export * from '../source/const';

export const AuthConstant = {
  JwtExpirationSeconds: 86400,
  TmaMaxAgeSeconds: 180,
  TelegramWidgetMaxAgeSeconds: 86400,
  CacheTtlJwt: 3600,
  CacheTtlBlocked: 1800,
  CacheTtlPremium: 900,
  CacheTtlLanguage: 7200,
} as const;

export enum AuthTokenType {
  Main = 'main',
}
