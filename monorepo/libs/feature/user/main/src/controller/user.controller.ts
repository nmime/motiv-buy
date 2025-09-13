import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from '../service/user.service';
import { ApiProblemExceptions, InternalException, UnauthorizedException } from '@app/common-exception';
import { AsyncResult } from '@app/common-shared';
import { Ok, Err } from 'ts-results';
import { JwtAuthGuard, CurrentUserId } from '@app/feature-auth-shared';
import {
  UserResponseDto,
  ReferralStatsDto,
  ReferralLinkDto,
  NotificationSettingsDto,
  UpdateNotificationSettingsDto,
} from '../dto';

@ApiTags('user')
@Controller('user')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @ApiProblemExceptions([[InternalException, { description: 'Internal server error occurred' }]])
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully' })
  async getProfile(
    @CurrentUserId() userId: string,
  ): AsyncResult<UserResponseDto, InternalException> {
    return this.userService.findById(userId);
  }

  @Get('referrals')
  @ApiProblemExceptions([[InternalException, { description: 'Internal server error occurred' }]])
  @ApiOperation({ summary: 'Get referral statistics' })
  @ApiResponse({ status: 200, description: 'Referral statistics retrieved successfully' })
  async getReferralStats(
    @CurrentUserId() userId: string,
  ): AsyncResult<ReferralStatsDto, InternalException> {
    return this.userService.getReferralStats(userId);
  }

  @Get('referrals-share')
  @ApiProblemExceptions([[InternalException, { description: 'Internal server error occurred' }]])
  @ApiOperation({ summary: 'Get referral link' })
  @ApiResponse({ status: 200, description: 'Referral link retrieved successfully' })
  async getReferralLink(
    @CurrentUserId() userId: string,
  ): AsyncResult<ReferralLinkDto, InternalException> {
    return this.userService.getReferralLink(userId);
  }

  @Get('notifications')
  @ApiProblemExceptions([[InternalException, { description: 'Internal server error occurred' }]])
  @ApiOperation({ summary: 'Get notification settings' })
  @ApiResponse({ status: 200, description: 'Notification settings retrieved successfully' })
  async getNotificationSettings(
    @CurrentUserId() userId: string,
  ): AsyncResult<NotificationSettingsDto, InternalException> {
    return this.userService.getNotificationSettings(userId);
  }

  @Post('notifications')
  @ApiProblemExceptions([[InternalException, { description: 'Internal server error occurred' }]])
  @ApiOperation({ summary: 'Send notification to user' })
  @ApiResponse({ status: 201, description: 'Notification sent successfully' })
  async sendNotification(
    @CurrentUserId() userId: string,
    @Body() settings: UpdateNotificationSettingsDto,
  ): AsyncResult<NotificationSettingsDto, InternalException> {
    return this.userService.sendNotification(userId, settings);
  }
}
