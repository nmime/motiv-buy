import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Controller, Get, Headers, Ip, Query, Req, UseGuards } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { ApiProblemExceptions } from '@app/common-exception';
import { AsyncResult } from '@app/common-shared';
import { AuthService } from '../service';
import { AuthDevRequestDto, AuthResponseDto, TelegramWidgetAuthDto } from '../dto';
import { AppThrottlerGuard, IpAuthGuard, AuthResultDto } from '@app/feature-auth-shared';
import {
  NotInDevModeException,
  TmaDataValidationException,
  UserBlockedException,
  UserNotFoundException,
} from '@app/common-exception';

@ApiTags('auth')
@Controller()
@UseGuards(AppThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('/api/v1/auth/dev')
  @ApiOkResponse({ type: AuthResponseDto, description: 'Successful auth' })
  @ApiProblemExceptions([
    [NotInDevModeException, { description: 'Not in development mode' }],
    [UserBlockedException, { description: 'User is blocked' }],
    [UserNotFoundException, { description: 'User not found' }],
  ])
  @UseGuards(IpAuthGuard)
  async authDev(
    @Query() dto: AuthDevRequestDto,
  ): AsyncResult<AuthResultDto, NotInDevModeException | UserBlockedException | UserNotFoundException> {
    return await this.authService.authDev(String(dto.id));
  }

  @Get('/api/v1/auth/tma')
  @ApiOkResponse({ type: AuthResponseDto, description: 'Successful auth' })
  @ApiProblemExceptions([
    [TmaDataValidationException, { description: 'TMA data validation failed' }],
    [UserBlockedException, { description: 'User is blocked' }],
    [UserNotFoundException, { description: 'User not found' }],
  ])
  @ApiOperation({ description: 'You need to pass TMA data to query params' })
  async authTMA(
    @Ip() ip: string,
    @Req() req: FastifyRequest,
    @Headers() headers: Record<string, string>,
  ): AsyncResult<AuthResultDto, TmaDataValidationException | UserBlockedException | UserNotFoundException> {
    return await this.authService.authTma({
      url: req.url,
      hostname: req.hostname,
      ip: headers['cf-connecting-ip'] ?? headers['x-real-ip'] ?? ip ?? undefined,
    });
  }

  @Get('/api/v1/auth/telegram-widget')
  @ApiOkResponse({ type: AuthResponseDto, description: 'Successful auth' })
  @ApiProblemExceptions([
    [TmaDataValidationException, { description: 'TMA data validation failed' }],
    [UserBlockedException, { description: 'User is blocked' }],
    [UserNotFoundException, { description: 'User not found' }],
  ])
  @ApiOperation({ description: 'Authenticate using Telegram Widget data' })
  async authTelegramWidget(
    @Query() dto: TelegramWidgetAuthDto,
    @Ip() ip: string,
    @Headers() headers: Record<string, string>,
  ): AsyncResult<AuthResultDto, TmaDataValidationException | UserBlockedException | UserNotFoundException> {
    return await this.authService.authTelegramWidget({
      dto,
      ip: headers['cf-connecting-ip'] ?? headers['x-real-ip'] ?? ip ?? undefined,
    });
  }
}
