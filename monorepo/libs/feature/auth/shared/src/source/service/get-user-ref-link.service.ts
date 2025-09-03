import { Injectable, Logger } from '@nestjs/common';
import { UserRepository } from '@app/database';
import { SourceParameters } from './get-source-params.service';

@Injectable()
export class GetUserRefLinkService {
  private readonly logger: Logger = new Logger(this.constructor.name);

  constructor(private readonly userRepository: UserRepository) {}

  async resolveReferrerUserId(sourceParams: SourceParameters): Promise<string | undefined> {
    const { linkCode, refCode } = sourceParams;
    const code = refCode || linkCode;
    
    if (!code) {
      return undefined;
    }

    try {
      const user = await this.userRepository.findByTelegramId(code);
      if (user && user.isActive) {
        return String(user.id);
      }

      const userByUsername = await this.userRepository.findByUsername(code);
      if (userByUsername && userByUsername.isActive) {
        return String(userByUsername.id);
      }

      return undefined;
    } catch (error) {
      this.logger.error(`Error resolving referrer user ID for code ${code}`, error);
      return undefined;
    }
  }
}