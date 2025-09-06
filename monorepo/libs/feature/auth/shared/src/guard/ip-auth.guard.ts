import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { AuthConfigService } from '../config';

@Injectable()
export class IpAuthGuard implements CanActivate {
  constructor(private authConfigService: AuthConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.authConfigService.skipIpCheck) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const { headers } = request;
    const ip = (headers['cf-connecting-ip'] as string) ?? (headers['x-real-ip'] as string) ?? null;

    return this.authConfigService.allowedIps.includes(ip);
  }
}
