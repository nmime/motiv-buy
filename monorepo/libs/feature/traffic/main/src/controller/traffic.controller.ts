import { Controller, Get, Post, Body, Param, UseGuards, HttpCode, HttpStatus, Ip } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiHeader } from '@nestjs/swagger';
import { CurrentUserId, JwtAuthGuard } from '@app/feature-auth-shared';
import { ApiProblemExceptions, InternalException } from '@app/common-exception';
import { ClientDataProblemValidationException } from '@app/common-validation';
import { BotTokenValidationDto, BotTokenValidationResponseDto, BotResponseDto } from '@app/feature-traffic-shared';
import { TrafficService } from '../service';

/**
 * Controller for traffic token validation operations
 */
@ApiTags('Traffic')
@Controller('traffic')
@ApiProblemExceptions([
  [InternalException, { description: 'Internal server error occurred' }],
  [ClientDataProblemValidationException, { description: 'Request validation failed' }],
])
export class TrafficController {
  constructor(private readonly trafficService: TrafficService) {}

  @Post('bot-token/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate bot token for traffic operations',
    description: 'Validates a bot token and returns bot information and permissions',
  })
  @ApiResponse({
    status: 200,
    description: 'Token validation result',
    type: BotTokenValidationResponseDto,
  })
  @ApiHeader({
    name: 'X-Bot-Token',
    description: 'Bot token to validate',
    required: false,
  })
  async validateBotToken(
    @Body() dto: BotTokenValidationDto,
    @Ip() clientIp: string,
  ): Promise<BotTokenValidationResponseDto> {
    return this.trafficService.validateBotToken(dto, clientIp);
  }

  @Get('bot-token/permissions/:botId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get bot permissions for traffic operations',
    description: 'Returns available permissions for a specific bot',
  })
  @ApiParam({ name: 'botId', description: 'Bot ID' })
  @ApiResponse({
    status: 200,
    description: 'Bot permissions',
    schema: {
      type: 'object',
      properties: {
        botId: { type: 'string' },
        permissions: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  async getBotPermissions(@Param('botId') botId: string): Promise<{ botId: string; permissions: string[] }> {
    const permissions = await this.trafficService.getBotPermissions(botId);

    return { botId, permissions };
  }

  @Post('bot-token/invalidate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Invalidate bot token',
    description: 'Invalidates a bot token for security purposes',
  })
  @ApiResponse({
    status: 204,
    description: 'Token invalidated successfully',
  })
  async invalidateBotToken(@Body() body: { token: string }): Promise<void> {
    await this.trafficService.invalidateBotToken(body.token);
  }

  @Get('bots/managed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get managed bots',
    description: 'Returns bots managed by the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Managed bots retrieved',
    type: [BotResponseDto],
  })
  async getManagedBots(@CurrentUserId() userId: string): Promise<BotResponseDto[]> {
    return this.trafficService.getUserBots(userId);
  }
}
