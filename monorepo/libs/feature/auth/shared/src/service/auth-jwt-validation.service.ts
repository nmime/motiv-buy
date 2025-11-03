import { Injectable } from '@nestjs/common';
import { Err, Ok, Result } from 'ts-results';
import { AsyncResult } from '@app/common-shared';
import { UserRepository, UserRole, UserStatus, UserEntity } from '@app/database';
import { AuthJwtPayloadDto } from '../dto';
import { UserData } from '../type';
import { BadTokenException, UserBlockedException, UserNotFoundException } from '@app/common-exception';
import { AuthConfigService } from '../config';

@Injectable()
export class AuthJwtValidationService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly configService: AuthConfigService,
  ) {}

  async validate(
    payload: AuthJwtPayloadDto,
  ): AsyncResult<UserData, UserBlockedException | UserNotFoundException | BadTokenException> {
    if (!payload?.app || !payload?.userId) {
      return Err(new BadTokenException());
    }

    const user = await this.userRepository.findOne({ id: payload.userId });
    if (!user) {
      return Err(new UserNotFoundException());
    }

    if (this.configService.isDev && !this.hasDevAccess(user)) {
      return Err(new UserNotFoundException());
    }

    if (user.status !== UserStatus.Active && user.status !== UserStatus.Restricted) {
      return Err(new UserBlockedException());
    }

    return Ok(
      new UserData({
        app: payload.app,
        userId: String(payload.userId),
      }),
    );
  }

  private hasDevAccess(user: UserEntity): boolean {
    return user.role === UserRole.Admin || user.role === UserRole.Developer;
  }
}
