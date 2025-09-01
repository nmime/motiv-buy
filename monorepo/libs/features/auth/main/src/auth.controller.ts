import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { AuthMainService, LoginDto } from './services/auth-main.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiProblemExceptions } from '@app/common-exception';
import { UnauthorizedException } from '@app/feature-auth-shared';
import { AsyncResult } from '@app/common-shared';

@ApiTags('auth')
@Controller('auth')
@ApiProblemExceptions([
  [UnauthorizedException, { description: 'Invalid credentials or unauthorized access' }],
])
export class AuthController {
  constructor(private readonly authMainService: AuthMainService) {}

  @Post('login')
  @ApiOkResponse({ description: 'User login' })
  async login(@Body() dto: LoginDto): AsyncResult<any, UnauthorizedException> {
    const result = await this.authMainService.login(dto);
    return { success: true, data: result };
  }

  @Post('dev-login')
  @ApiOkResponse({ description: 'Dev mode login' })
  async devLogin(@Body() body: { telegramId: string }): AsyncResult<any, UnauthorizedException> {
    const result = await this.authMainService.devLogin(body.telegramId);
    return { success: true, data: result };
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiOkResponse({ description: 'Get current user' })
  async getMe(@Request() req: any): AsyncResult<{ success: boolean; user: any }, never> {
    return {
      success: true,
      data: {
        success: true,
        user: req.user,
      },
    };
  }

  @Get('validate')
  @UseGuards(AuthGuard('composite'))
  @ApiOkResponse({ description: 'Validate token' })
  async validate(@Request() req: any): AsyncResult<{ success: boolean; user: any }, never> {
    return {
      success: true,
      data: {
        success: true,
        user: req.user,
      },
    };
  }
}