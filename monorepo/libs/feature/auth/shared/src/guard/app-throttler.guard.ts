import { ThrottlerGuard } from '@nestjs/throttler';
import { Injectable } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: FastifyRequest): Promise<string> {
    const ip = (req.headers['cf-connecting-ip'] as string) ?? (req.headers['x-real-ip'] as string) ?? null;
    const cf = (req.headers['cf-ray'] as string) ?? null;
    return Promise.resolve(`${ip}-${cf}`);
  }
}
