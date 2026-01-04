import { Injectable } from '@nestjs/common';
import { UserEntity } from '@app/database';
import { NotificationSettingsDto, ReferralLinkDto, ReferralStatsDto, UserResponseDto } from '../dto';
import { NotificationSettingsData, ReferralLinkData, ReferralStatsData, UserReferralData } from '../type';

@Injectable()
export class UserMapper {
  toResponse(user: UserEntity, referralData: UserReferralData): UserResponseDto {
    const userData = user;

    return {
      id: userData.id,
      name: userData.firstName ?? undefined,
      username: userData.username ?? undefined,
      language: userData.language ?? undefined,
      referral: referralData,
    };
  }

  toReferralStats(data: ReferralStatsData): ReferralStatsDto {
    return {
      totalReferrals: data.totalReferrals,
      totalEarnings: data.totalEarnings,
    };
  }

  toReferralLink(data: ReferralLinkData): ReferralLinkDto {
    return {
      telegramMessage: data.telegramMessage,
      link: data.link,
    };
  }

  toNotificationSettings(data: NotificationSettingsData): NotificationSettingsDto {
    return {
      limitNotificationsEnabled: data.limitNotificationsEnabled,
      inactivityNotificationsEnabled: data.inactivityNotificationsEnabled,
    };
  }
}
