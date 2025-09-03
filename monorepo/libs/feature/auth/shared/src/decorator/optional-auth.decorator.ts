import { SetMetadata } from '@nestjs/common';

export const optionalAuthKey = 'auth:optional';
export const OptionalAuth = () => SetMetadata(optionalAuthKey, true);