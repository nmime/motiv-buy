import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { ShutdownService } from './shutdown.service';
// import { RabbitMQHealthIndicator } from '@app/common-rabbit';
import { DiscoveryModule } from '@nestjs/core';

@Module({
  imports: [TerminusModule, DiscoveryModule],
  providers: [ShutdownService], // RabbitMQHealthIndicator
  exports: [TerminusModule, ShutdownService], // RabbitMQHealthIndicator
})
export class HealthModule {}
