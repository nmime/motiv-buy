import { Injectable } from '@nestjs/common';
import { UserEntity } from '@app/database';
import { UserResponseDto, ReferralStatsDto, ReferralLinkDto, NotificationSettingsDto } from '../dto';
import { UserReferralData, ReferralStatsData, ReferralLinkData, NotificationSettingsData } from '../type';

@Injectable()
export class UserMapper {
  toResponse(user: UserEntity, referralData: UserReferralData): UserResponseDto {
    return {
      id: user.id,
      name: user.firstName,
      username: user.username,
      language: user.languageCode,
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
