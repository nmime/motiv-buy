import { Injectable } from '@nestjs/common';
import { InjectRedis, RedisClient } from '@app/common-redis';
import { AuthJwtPayloadDto, UserData } from '../dto';
import { AuthConstant } from '../const';

@Injectable()
export class AuthJwtCacheService {
  private readonly jwtCachePrefix = 'auth:jwt:';
  private readonly validationCachePrefix = 'auth:validation:';
  private readonly userTokensPrefix = 'auth:user_tokens:';

  constructor(
    @InjectRedis()
    private readonly redis: RedisClient,
  ) {}

  async saveJwtKey(payload: AuthJwtPayloadDto): Promise<void> {
    try {
      const key = payload.jti || payload.uniqueKey;
      if (!key) return;

      const cacheKey = this.getJwtCacheKey(key);
      await this.redis.setex(
        cacheKey,
        AuthConstant.CacheTtlJwt,
        JSON.stringify(payload)
      );

      await this.addToUserTokens(payload.userId, key);
    } catch (error) {
      console.error('Failed to save JWT key to cache:', error);
    }
  }

  async getJwtPayload(jti: string): Promise<AuthJwtPayloadDto | null> {
    try {
      const cacheKey = this.getJwtCacheKey(jti);
      const cached = await this.redis.get(cacheKey);
      
      if (!cached) {
        return null;
      }
      
      return JSON.parse(cached) as AuthJwtPayloadDto;
    } catch (error) {
      console.error('Failed to get JWT payload from cache:', error);
      return null;
    }
  }

  async cacheValidation(jti: string, userData: UserData): Promise<void> {
    try {
      const cacheKey = this.getValidationCacheKey(jti);
      await this.redis.setex(
        cacheKey,
        AuthConstant.CacheTtlJwt,
        JSON.stringify(userData)
      );
    } catch (error) {
      console.error('Failed to cache validation result:', error);
    }
  }

  async getCachedValidation(jti: string): Promise<UserData | null> {
    try {
      const cacheKey = this.getValidationCacheKey(jti);
      const cached = await this.redis.get(cacheKey);
      
      if (!cached) {
        return null;
      }
      
      return new UserData(JSON.parse(cached));
    } catch (error) {
      console.error('Failed to get cached validation:', error);
      return null;
    }
  }

  async getUserTokens(userId: string): Promise<string[]> {
    try {
      const cacheKey = this.getUserTokensKey(String(userId));
      const tokensStr = await this.redis.get(cacheKey);
      if (!tokensStr) return [];
      return JSON.parse(tokensStr) as string[];
    } catch (error) {
      console.error('Failed to get user tokens:', error);
      return [];
    }
  }

  async clearUserTokens(userId: number): Promise<void> {
    try {
      const cacheKey = this.getUserTokensKey(String(userId));
      await this.redis.del(cacheKey);
    } catch (error) {
      console.error('Failed to clear user tokens:', error);
    }
  }

  private async addToUserTokens(userId: string, jti: string): Promise<void> {
    try {
      const cacheKey = this.getUserTokensKey(String(userId));
      
      const existing = await this.getUserTokens(userId);
      
      if (!existing.includes(jti)) {
        existing.push(jti);
        await this.redis.setex(
          cacheKey,
          AuthConstant.CacheTtlJwt,
          JSON.stringify(existing)
        );
      }
    } catch (error) {
      console.error('Failed to add to user tokens:', error);
    }
  }

  private getJwtCacheKey(jti: string): string {
    return `${this.jwtCachePrefix}${jti}`;
  }

  private getValidationCacheKey(jti: string): string {
    return `${this.validationCachePrefix}${jti}`;
  }

  private getUserTokensKey(userId: string): string {
    return `${this.userTokensPrefix}${userId}`;
  }
}
