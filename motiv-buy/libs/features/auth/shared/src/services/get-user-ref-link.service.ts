import { Injectable, Logger } from '@nestjs/common';
import { UserRepository } from '@app/database';
import { SourceParameters } from './get-source-params.service';

@Injectable()
export class GetUserRefLinkService {
  private readonly logger: Logger = new Logger(this.constructor.name);

  constructor(private readonly userRepository: UserRepository) {}

  async resolveReferrerUserId(sourceParams: SourceParameters): Promise<string | null> {
    const { linkCode, refCode } = sourceParams;
    const code = refCode || linkCode;
    
    if (!code) {
      return null;
    }

    try {
      // Try to find user by telegram ID (assuming referral codes are telegram IDs)
      const user = await this.userRepository.findByTelegramId(code);
      if (user && user.isActive) {
        return user.id;
      }

      // Try to find by username
      const userByUsername = await this.userRepository.findByUsername(code);
      if (userByUsername && userByUsername.isActive) {
        return userByUsername.id;
      }

      return null;
    } catch (error) {
      this.logger.error(`Error resolving referrer user ID for code ${code}`, error);
      return null;
    }
  }
}