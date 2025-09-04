import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from '../service/user.service';
import { ApiProblemExceptions, InternalException, UnauthorizedException } from '@app/common-exception';
import { AsyncResult } from '@app/common-shared';
import { JwtAuthGuard, CurrentUserId } from '@app/feature-auth-shared';
import { 
  UserResponseDto, 
  ReferralStatsDto, 
  ReferralLinkDto,
  NotificationSettingsDto, 
  UpdateNotificationSettingsDto 
} from '../dto';

@ApiTags('user')
@Controller('user')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @ApiProblemExceptions([
    [InternalException, { description: 'Internal server error occurred' }],
  ])
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Returns authenticated user profile information',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  async getProfile(@CurrentUserId() userId: string): AsyncResult<UserResponseDto, UnauthorizedException | InternalException> {
    const result = await this.userService.findById(userId);
    return { success: true, data: result };
  }

  @Get('referrals')
  @ApiProblemExceptions([
    [InternalException, { description: 'Internal server error occurred' }],
  ])
  @ApiOperation({
    summary: 'Get referral statistics',
    description: 'Returns number of referrals and total earnings from them (10% from their income)',
  })
  @ApiResponse({
    status: 200,
    description: 'Referral statistics retrieved successfully',
  })
  async getReferralStats(@CurrentUserId() userId: string): AsyncResult<ReferralStatsDto, UnauthorizedException | InternalException> {
    const result = await this.userService.getReferralStats(userId);
    return { success: true, data: result };
  }

  @Get('referrals-share')
  @ApiProblemExceptions([
    [InternalException, { description: 'Internal server error occurred' }],
  ])
  @ApiOperation({
    summary: 'Get referral link',
    description: 'Returns Telegram message with referral link for sharing',
  })
  @ApiResponse({
    status: 200,
    description: 'Referral link retrieved successfully',
  })
  async getReferralLink(@CurrentUserId() userId: string): AsyncResult<ReferralLinkDto, UnauthorizedException | InternalException> {
    const result = await this.userService.getReferralLink(userId);
    return { success: true, data: result };
  }

  @Get('notifications')
  @ApiProblemExceptions([
    [InternalException, { description: 'Internal server error occurred' }],
  ])
  @ApiOperation({
    summary: 'Get notification settings',
    description: 'Returns current notification settings for limit and inactivity notifications',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification settings retrieved successfully',
  })
  async getNotificationSettings(@CurrentUserId() userId: string): AsyncResult<NotificationSettingsDto, UnauthorizedException | InternalException> {
    const result = await this.userService.getNotificationSettings(userId);
    return { success: true, data: result };
  }

  @Put('notifications')
  @ApiProblemExceptions([
    [InternalException, { description: 'Internal server error occurred' }],
  ])
  @ApiOperation({
    summary: 'Update notification settings',
    description: 'Enable/disable limit and inactivity notifications',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification settings updated successfully',
  })
  async updateNotificationSettings(
    @CurrentUserId() userId: string,
    @Body() settings: UpdateNotificationSettingsDto,
  ): AsyncResult<NotificationSettingsDto, UnauthorizedException | InternalException> {
    const result = await this.userService.updateNotificationSettings(userId, settings);
    return { success: true, data: result };
  }
}
