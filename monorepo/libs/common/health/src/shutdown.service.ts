import { Injectable, OnApplicationShutdown } from '@nestjs/common';

@Injectable()
export class ShutdownService implements OnApplicationShutdown {
  private isShuttingDown = false;

  get shuttingDown(): boolean {
    return this.isShuttingDown;
  }

  onApplicationShutdown(signal: string) {
    if (signal === 'SIGINT' || signal === 'SIGTERM') {
      this.isShuttingDown = true;
    }
  }
}
