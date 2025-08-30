import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { AuthMainService, LoginDto } from './services/auth-main.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authMainService: AuthMainService) {}

  @Post('login')
  @ApiOkResponse({ description: 'User login' })
  async login(@Body() dto: LoginDto) {
    return this.authMainService.login(dto);
  }

  @Post('dev-login')
  @ApiOkResponse({ description: 'Dev mode login' })
  async devLogin(@Body() body: { telegramId: string }) {
    return this.authMainService.devLogin(body.telegramId);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiOkResponse({ description: 'Get current user' })
  async getMe(@Request() req: any) {
    return {
      success: true,
      user: req.user,
    };
  }

  @Get('validate')
  @UseGuards(AuthGuard('composite'))
  @ApiOkResponse({ description: 'Validate token' })
  async validate(@Request() req: any) {
    return {
      success: true,
      user: req.user,
    };
  }
}