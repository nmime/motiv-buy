import { Injectable, Logger } from '@nestjs/common';
import { UserRepository } from '@app/database';
import { TelegramAuthParams } from '../dto';
import { UserVisitService } from '../source';

@Injectable()
export class AuthUserService {
  private readonly logger = new Logger(AuthUserService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly userVisitService: UserVisitService,
  ) {}

  async findOrCreateByWebAuth(
    params: TelegramAuthParams,
    options: {
      trackAnalytics?: boolean;
      trackUserVisit?: boolean;
      trackUserLastAuth?: boolean;
      updateUserFields?: boolean;
      analyticsEventType?: string;
    } = {}
  ): Promise<any | null> {
    try {
      // First try to find existing user
      let user = await this.userRepository.findOne({
        telegramId: params.telegramId,
      });

      if (user) {
        // Update user fields if requested
        if (options.updateUserFields) {
          const updateData: any = {};
          
          if (params.firstName !== user.firstName) {
            updateData.firstName = params.firstName;
          }
          
          if (params.lastName && params.lastName !== user.lastName) {
            updateData.lastName = params.lastName;
          }
          
          if (params.username && params.username !== user.username) {
            updateData.username = params.username;
          }
          
          if (params.languageCode && params.languageCode !== user.languageCode) {
            updateData.languageCode = params.languageCode;
          }

          if (options.trackUserLastAuth) {
            updateData.lastAuthAt = new Date();
          }

          if (Object.keys(updateData).length > 0) {
            await this.userRepository.nativeUpdate({ id: user.id }, updateData);
            user = { ...user, ...updateData };
          }
        }

        // Track visit for existing user
        if (options.trackUserVisit) {
          try {
            await this.userVisitService.registerVisit(
              user!.id.toString(),
              params,
              params.languageCode,
              false, // isSignup = false for existing users
            );
          } catch (error) {
            this.logger.error('Failed to register visit for existing user', { userId: user!.id, error });
          }
        }

        return user!;
      }

      // Create new user if not found
      const newUserData: any = {
        telegramId: params.telegramId,
        firstName: params.firstName,
        lastName: params.lastName || null,
        username: params.username || null,
        languageCode: params.languageCode || 'en',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (options.trackUserLastAuth) {
        newUserData.lastAuthAt = new Date();
      }

      user = await this.userRepository.create(newUserData);
      
      if (options.trackAnalytics) {
        // Analytics tracking logic would go here
      }
      
      if (options.trackUserVisit) {
        try {
          await this.userVisitService.registerVisit(
            user.id.toString(),
            params,
            params.languageCode,
            true, // isSignup = true for new users
          );
        } catch (error) {
          this.logger.error('Failed to register visit for new user', { userId: user.id, error });
        }
      }

      return user;
    } catch (error) {
      console.error('Failed to find or create user:', error);
      return null;
    }
  }

  async findByTelegramId(telegramId: string): Promise<any | null> {
    try {
      return await this.userRepository.findOne({ telegramId });
    } catch (error) {
      console.error('Failed to find user by telegram ID:', error);
      return null;
    }
  }

  async findById(userId: string): Promise<any | null> {
    try {
      return await this.userRepository.findOne({ id: parseInt(userId, 10) });
    } catch (error) {
      console.error('Failed to find user by ID:', error);
      return null;
    }
  }
}
