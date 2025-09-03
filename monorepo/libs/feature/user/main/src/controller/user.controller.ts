import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query,
  HttpStatus,
  HttpCode,
  UseGuards,
  UnauthorizedException,
  createParamDecorator,
  ExecutionContext
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserService } from '../service/user.service';
import { ApiProblemExceptions, InternalException } from '@app/common-exception';
import { AsyncResult } from '@app/common-shared';

// Local guards and decorators to avoid cross-library imports
export const JwtAuthGuard = AuthGuard('jwt');

export const CurrentUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    if (!request.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return request.user.id;
  },
);

// Local DTOs to avoid cross-library imports
export interface CreateUserDto {
  username: string;
  firstName: string;
  lastName?: string;
  email?: string;
  telegramId: string;
  languageCode?: string;
  password: string;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  username?: string;
}

export interface UserResponseDto {
  id: string;
  username?: string;
  firstName: string;
  lastName?: string;
  email?: string;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReferralStatsDto {
  totalReferrals: number;
  totalEarnings: number;
}

export interface ReferralLinkDto {
  telegramMessage: string;
  link: string;
}

export interface NotificationSettingsDto {
  limitNotificationsEnabled: boolean;
  inactivityNotificationsEnabled: boolean;
}

export interface UpdateNotificationSettingsDto {
  limitNotificationsEnabled?: boolean;
  inactivityNotificationsEnabled?: boolean;
}

/**
 * User controller - HTTP API endpoints
 */
@ApiTags('users')
@Controller('users')
@ApiProblemExceptions([
  // [UnauthorizedException, { description: 'User not authenticated' }],
  [InternalException, { description: 'Internal server error occurred' }],
])
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Create a new user (public registration)
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new user',
    description: 'Create a new user account (public endpoint)',
  })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
  })
  async register(@Body() createUserDto: CreateUserDto): AsyncResult<UserResponseDto, InternalException> {
    const result = await this.userService.create(createUserDto);
    return { success: true, data: result };
  }

  /**
   * Get current user profile
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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

  /**
   * Update current user profile
   */
  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update current user profile',
    description: 'Update authenticated user profile information',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile updated successfully',
  })
  async updateProfile(
    @CurrentUserId() userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ): AsyncResult<UserResponseDto, UnauthorizedException | InternalException> {
    const result = await this.userService.update(userId, updateUserDto);
    return { success: true, data: result };
  }

  /**
   * Get referral statistics
   */
  @Get('profile/referrals')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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

  /**
   * Get referral link
   */
  @Get('profile/referral-link')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get referral link',
    description: 'Returns Telegram message with referral link',
  })
  @ApiResponse({
    status: 200,
    description: 'Referral link retrieved successfully',
  })
  async getReferralLink(@CurrentUserId() userId: string): AsyncResult<ReferralLinkDto, UnauthorizedException | InternalException> {
    const result = await this.userService.getReferralLink(userId);
    return { success: true, data: result };
  }

  /**
   * Get notification settings
   */
  @Get('profile/notifications')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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

  /**
   * Update notification settings
   */
  @Put('profile/notifications')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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

  // Admin endpoints below

  /**
   * Get user by ID (admin only)
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Returns user information by ID (admin access)',
  })
  @ApiResponse({
    status: 200,
    description: 'User retrieved successfully',
  })
  async findById(@Param('id') id: string): AsyncResult<UserResponseDto, UnauthorizedException | InternalException> {
    const result = await this.userService.findById(id);
    return { success: true, data: result };
  }

  /**
   * Get all users with pagination (admin only)
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all users',
    description: 'Returns paginated list of all users (admin access)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        users: {
          type: 'array',
          items: { $ref: '#/components/schemas/UserResponseDto' },
        },
        total: {
          type: 'number',
          example: 100,
        },
      },
    },
  })
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ): AsyncResult<{
    users: UserResponseDto[];
    total: number;
  }, UnauthorizedException | InternalException> {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const result = await this.userService.findAll(pageNum, limitNum);
    return { success: true, data: result };
  }

  /**
   * Delete user by ID (admin only)
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete user by ID',
    description: 'Delete user account by ID (admin access)',
  })
  @ApiResponse({
    status: 204,
    description: 'User deleted successfully',
  })
  async delete(@Param('id') id: string): AsyncResult<void, UnauthorizedException | InternalException> {
    const result = await this.userService.delete(id);
    return { success: true, data: result };
  }
}