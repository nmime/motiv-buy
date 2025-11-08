import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUserId, JwtAuthGuard } from '@app/feature-auth-shared';
import { ApiProblemExceptions, InternalException } from '@app/common-exception';
import { AsyncResult } from '@app/common-shared';
import { Ok } from 'ts-results';
import { UpdateSettingsDto, UserSettingsResponseDto } from '../dto';
import { SettingsService } from '../service';

/**
 * Settings Controller
 * Manages user preference settings including language, theme, and privacy settings
 */
@ApiTags('settings')
@Controller('settings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiProblemExceptions([[InternalException, { description: 'Internal server error occurred' }]])
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all user settings' })
  @ApiResponse({ status: 200, description: 'Settings retrieved successfully', type: UserSettingsResponseDto })
  async getSettings(@CurrentUserId() userId: string): AsyncResult<UserSettingsResponseDto, InternalException> {
    const result = await this.settingsService.getSettings(userId);

    return Ok(result);
  }

  @Patch()
  @ApiOperation({ summary: 'Update user settings' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully', type: UserSettingsResponseDto })
  async updateSettings(
    @CurrentUserId() userId: string,
    @Body() dto: UpdateSettingsDto,
  ): AsyncResult<UserSettingsResponseDto, InternalException> {
    const result = await this.settingsService.updateSettings(userId, dto);

    return Ok(result);
  }
}
