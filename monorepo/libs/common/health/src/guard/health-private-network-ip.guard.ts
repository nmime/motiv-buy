import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
// import ip from 'ip';
import { PrivateNetworkIps } from '@app/common-shared';

@Injectable()
export class HealthPrivateNetworkIpGuard implements CanActivate {
  private readonly logger = new Logger(HealthPrivateNetworkIpGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    let clientIp = (request.headers['cf-connecting-ip'] ?? request.headers['x-real-ip'] ?? request.ip) as string;

    if (clientIp?.startsWith('::ffff:')) {
      clientIp = clientIp.replace('::ffff:', '');
    }

    // Simplified IP checking for now - FUTURE: implement proper CIDR checking with ip library
    const result =
      !!clientIp &&
      PrivateNetworkIps.some((allowedIp) =>
        allowedIp.includes('/')
          ? clientIp.startsWith(allowedIp.split('/')[0].split('.').slice(0, 3).join('.'))
          : clientIp === allowedIp,
      );

    if (!result) {
      this.logger.log(`Request from ${clientIp} is not allowed`);
    }

    return result;
  }
}
