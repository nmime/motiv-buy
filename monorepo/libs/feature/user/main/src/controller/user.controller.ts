import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from '../service';
import { UserMapper } from '../mapper';
import { ApiProblemExceptions, InternalException } from '@app/common-exception';
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
  constructor(
    private readonly userService: UserService,
    private readonly userMapper: UserMapper,
  ) {}

  @Get('profile')
  @ApiProblemExceptions([[InternalException, { description: 'Internal server error occurred' }]])
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully' })
  async getProfile(@CurrentUserId() userId: string): AsyncResult<UserResponseDto, InternalException> {
    const userResult = await this.userService.findById(userId);
    if (userResult.err) {
      return userResult;
    }

    const referralDataResult = await this.userService.getReferralData(userId);
    if (referralDataResult.err) {
      return Err(referralDataResult.val);
    }

    const userResponse = this.userMapper.toResponse(userResult.val, referralDataResult.val);

    return Ok(userResponse);
  }

  @Get('referrals')
  @ApiProblemExceptions([[InternalException, { description: 'Internal server error occurred' }]])
  @ApiOperation({ summary: 'Get referral statistics' })
  @ApiResponse({ status: 200, description: 'Referral statistics retrieved successfully' })
  async getReferralStats(@CurrentUserId() userId: string): AsyncResult<ReferralStatsDto, InternalException> {
    const result = await this.userService.getReferralStats(userId);
    if (result.err) {
      return result;
    }

    const dto = this.userMapper.toReferralStats(result.val);

    return Ok(dto);
  }

  @Get('referrals-share')
  @ApiProblemExceptions([[InternalException, { description: 'Internal server error occurred' }]])
  @ApiOperation({ summary: 'Get referral link' })
  @ApiResponse({ status: 200, description: 'Referral link retrieved successfully' })
  async getReferralLink(@CurrentUserId() userId: string): AsyncResult<ReferralLinkDto, InternalException> {
    const result = await this.userService.getReferralLink(userId);
    if (result.err) {
      return result;
    }

    const dto = this.userMapper.toReferralLink(result.val);

    return Ok(dto);
  }

  @Get('notifications')
  @ApiProblemExceptions([[InternalException, { description: 'Internal server error occurred' }]])
  @ApiOperation({ summary: 'Get notification settings' })
  @ApiResponse({ status: 200, description: 'Notification settings retrieved successfully' })
  async getNotificationSettings(
    @CurrentUserId() userId: string,
  ): AsyncResult<NotificationSettingsDto, InternalException> {
    const result = await this.userService.getNotificationSettings(userId);
    if (result.err) {
      return result;
    }

    const dto = this.userMapper.toNotificationSettings(result.val);

    return Ok(dto);
  }

  @Post('notifications')
  @ApiProblemExceptions([[InternalException, { description: 'Internal server error occurred' }]])
  @ApiOperation({ summary: 'Send notification to user' })
  @ApiResponse({ status: 201, description: 'Notification sent successfully' })
  async sendNotification(
    @CurrentUserId() userId: string,
    @Body() settings: UpdateNotificationSettingsDto,
  ): AsyncResult<NotificationSettingsDto, InternalException> {
    const result = await this.userService.sendNotification(userId, settings);
    if (result.err) {
      return result;
    }

    const dto = this.userMapper.toNotificationSettings(result.val);

    return Ok(dto);
  }
}
