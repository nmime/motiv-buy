import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsEnum } from 'class-validator';

export enum ThemePreference {
  Light = 'light',
  Dark = 'dark',
  Auto = 'auto',
}

export class UserSettingsResponseDto {
  @ApiProperty({ example: 'en', description: 'User language preference' })
  language!: string;

  @ApiProperty({ enum: ThemePreference, example: ThemePreference.Auto, description: 'Theme preference' })
  theme!: ThemePreference;

  @ApiProperty({ example: true, description: 'Show balance in UI' })
  showBalance!: boolean;

  @ApiProperty({ example: true, description: 'Show referral information in UI' })
  showReferrals!: boolean;

  @ApiProperty({ example: true, description: 'Enable notifications' })
  enableNotifications!: boolean;
}

export class UpdateSettingsDto {
  @ApiProperty({ required: false, example: 'en' })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiProperty({ required: false, enum: ThemePreference, example: ThemePreference.Dark })
  @IsEnum(ThemePreference)
  @IsOptional()
  theme?: ThemePreference;

  @ApiProperty({ required: false, example: true })
  @IsBoolean()
  @IsOptional()
  showBalance?: boolean;

  @ApiProperty({ required: false, example: true })
  @IsBoolean()
  @IsOptional()
  showReferrals?: boolean;

  @ApiProperty({ required: false, example: true })
  @IsBoolean()
  @IsOptional()
  enableNotifications?: boolean;
}
