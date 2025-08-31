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
  UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/feature-auth-main';
import { CurrentUser } from '@app/feature-auth-shared';
import { UserService } from '../service/user.service';
import { 
  CreateUserDto, 
  UpdateUserDto, 
  UserResponseDto,
  ReferralStatsDto,
  ReferralLinkDto,
  NotificationSettingsDto,
  UpdateNotificationSettingsDto
} from '@app/feature-user-shared';

/**
 * User controller - HTTP API endpoints
 */
@ApiTags('users')
@Controller('users')
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
    type: UserResponseDto,
  })
  async register(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.userService.create(createUserDto);
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
    type: UserResponseDto,
  })
  async getProfile(@CurrentUser('id') userId: string): Promise<UserResponseDto> {
    return this.userService.findById(userId);
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
    type: UserResponseDto,
  })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.userService.update(userId, updateUserDto);
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
    type: ReferralStatsDto,
  })
  async getReferralStats(@CurrentUser('id') userId: string): Promise<ReferralStatsDto> {
    return this.userService.getReferralStats(userId);
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
    type: ReferralLinkDto,
  })
  async getReferralLink(@CurrentUser('id') userId: string): Promise<ReferralLinkDto> {
    return this.userService.getReferralLink(userId);
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
    type: NotificationSettingsDto,
  })
  async getNotificationSettings(@CurrentUser('id') userId: string): Promise<NotificationSettingsDto> {
    return this.userService.getNotificationSettings(userId);
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
    type: NotificationSettingsDto,
  })
  async updateNotificationSettings(
    @CurrentUser('id') userId: string,
    @Body() settings: UpdateNotificationSettingsDto,
  ): Promise<NotificationSettingsDto> {
    return this.userService.updateNotificationSettings(userId, settings);
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
    type: UserResponseDto,
  })
  async findById(@Param('id') id: string): Promise<UserResponseDto> {
    return this.userService.findById(id);
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
  ): Promise<{
    users: UserResponseDto[];
    total: number;
  }> {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    return this.userService.findAll(pageNum, limitNum);
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
  async delete(@Param('id') id: string): Promise<void> {
    return this.userService.delete(id);
  }
}