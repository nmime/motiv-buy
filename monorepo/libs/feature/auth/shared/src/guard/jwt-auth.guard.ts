import { unknownToError } from '@app/common-shared';
import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { FastifyRequest } from 'fastify';
import { ExtractJwt } from 'passport-jwt';
import { Observable } from 'rxjs';
import { InjectRedis, RedisClient } from '@app/common-redis';
import { UserRepository } from '@app/database';
import { optionalAuthKey } from '../decorator';

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    userId: number;
  };
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private readonly activityThrottleSeconds = 5 * 60;
  private readonly redisKeyPrefix = 'auth:user_activity';

  constructor(
    private readonly reflector: Reflector,
    @InjectRedis()
    private readonly redisClient: RedisClient,
    private readonly userRepository: UserRepository,
  ) {
    super();
  }

  override canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(request);

    const isOptional = this.reflector.get<boolean>(optionalAuthKey, context.getHandler());

    if (isOptional && !token) {
      return true;
    }

    const result = super.canActivate(context);

    if (result instanceof Promise) {
      return result.then(async (isAuthenticated: boolean) => {
        if (isAuthenticated) {
          await this.trackUserActivity(context);
        }

        return isAuthenticated;
      });
    }

    if (result === true) {
      this.trackUserActivity(context).catch((error) => {
        this.logger.error('Failed to track user activity', error);
      });
    }

    return result;
  }

  private async trackUserActivity(context: ExecutionContext): Promise<void> {
    try {
      const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
      const userId = request.user?.userId;

      if (!userId) {
        return;
      }

      const activityKey = `${this.redisKeyPrefix}:${userId}`;
      const now = new Date().toISOString();

      const wasSet = await this.redisClient.set(activityKey, now, 'EX', this.activityThrottleSeconds, 'NX');

      if (wasSet === 'OK') {
        this.updateDatabaseActivity(userId, now).catch((error) => {
          this.logger.error('Failed to update database activity', error);
        });
      }
    } catch (error: unknown) {
      this.logger.warn('Failed to track user activity', {
        error: unknownToError(error),
      });
    }
  }

  private async updateDatabaseActivity(userId: number, timestamp: string): Promise<void> {
    try {
      const lastActiveTime = new Date(timestamp);

      await this.userRepository.nativeUpdate({ id: String(userId) }, { lastActiveAt: lastActiveTime });

      this.logger.debug('User lastActiveTime updated', { userId, lastActiveTime });
    } catch (error: unknown) {
      this.logger.error('Failed to update database activity', {
        userId,
        error: unknownToError(error),
      });
    }
  }
}
