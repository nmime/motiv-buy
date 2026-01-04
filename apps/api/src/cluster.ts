/**
 * Node.js Cluster Mode Support
 *
 * Enables the API to run in cluster mode with multiple worker processes
 * for better CPU utilization and fault tolerance.
 *
 * Usage:
 * - Set CLUSTER_MODE=true to enable clustering
 * - Set CLUSTER_WORKERS=N to specify number of workers (defaults to CPU count)
 *
 * Architecture:
 * - Primary process manages workers
 * - Worker processes handle requests
 * - Automatic worker restart on crashes
 * - Graceful shutdown support
 */

import cluster from 'node:cluster';
import * as os from 'node:os';
import { Logger } from '@nestjs/common';

const logger = new Logger('Cluster');

/**
 * Get number of workers from environment or CPU count
 */
function getWorkerCount(): number {
  const envWorkers = process.env.CLUSTER_WORKERS;
  if (envWorkers) {
    const count = parseInt(envWorkers, 10);
    if (count > 0) {
      return count;
    }
  }

  return os.cpus().length;
}

/**
 * Check if cluster mode is enabled
 */
export function isClusterModeEnabled(): boolean {
  return process.env.CLUSTER_MODE === 'true';
}

/**
 * Fork a new worker process
 */
function forkWorker(): void {
  const worker = cluster.fork();
  logger.log(`Worker ${worker.process.pid} started`);
}

/**
 * Setup cluster mode with primary and worker processes
 */
export async function setupCluster(bootstrap: () => Promise<void>): Promise<void> {
  if (!isClusterModeEnabled()) {
    logger.log('Cluster mode disabled, running in single process mode');
    await bootstrap();

    return;
  }

  if (cluster.isPrimary) {
    // Primary process - spawn workers
    const workerCount = getWorkerCount();
    logger.log(`Starting cluster mode with ${workerCount} workers`);
    logger.log(`Primary process ${process.pid} is running`);

    // Fork workers
    for (let i = 0; i < workerCount; i++) {
      forkWorker();
    }

    // Handle worker exits and respawn
    cluster.on('exit', (worker, code, signal) => {
      const exitInfo = signal ? `signal ${signal}` : `code ${code}`;
      logger.warn(`Worker ${worker.process.pid} died (${exitInfo})`);

      // Respawn worker after a short delay to prevent rapid restart loops
      setTimeout(() => {
        logger.log('Starting a new worker...');
        forkWorker();
      }, 1000);
    });

    // Handle worker online event
    cluster.on('online', (worker) => {
      logger.log(`Worker ${worker.process.pid} is online`);
    });

    // Handle worker listening event
    cluster.on('listening', (worker, address) => {
      logger.log(`Worker ${worker.process.pid} is listening on ${address.address}:${address.port}`);
    });

    // Graceful shutdown for primary
    const shutdown = (signal: string) => {
      logger.log(`${signal} received in primary process, shutting down cluster...`);

      for (const id in cluster.workers) {
        const worker = cluster.workers[id];
        if (worker) {
          worker.send('shutdown');
          worker.disconnect();

          // Force kill after timeout
          setTimeout(() => {
            if (!worker.isDead()) {
              logger.warn(`Force killing worker ${worker.process.pid}`);
              worker.kill();
            }
          }, 10000);
        }
      }

      // Exit primary after all workers are done
      setTimeout(() => {
        logger.log('All workers shut down, exiting primary process');
        process.exit(0);
      }, 11000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } else {
    // Worker process - start NestJS application
    logger.log(`Worker ${process.pid} starting...`);

    try {
      await bootstrap();
      logger.log(`Worker ${process.pid} successfully started`);
    } catch (error: unknown) {
      logger.error(`Worker ${process.pid} failed to start:`, error);
      process.exit(1);
    }

    // Handle shutdown message from primary
    process.on('message', (msg) => {
      if (msg === 'shutdown') {
        logger.log(`Worker ${process.pid} received shutdown signal`);
        process.exit(0);
      }
    });

    // Graceful shutdown for worker
    const workerShutdown = (signal: string) => {
      logger.log(`${signal} received in worker ${process.pid}, shutting down...`);
      process.exit(0);
    };

    process.on('SIGTERM', () => workerShutdown('SIGTERM'));
    process.on('SIGINT', () => workerShutdown('SIGINT'));
  }
}
