import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { connect, NatsConnection, ConnectionOptions } from 'nats';
import type { NatsConfig } from '../interface';

/**
 * NATS Connection Service
 *
 * Manages NATS server connection lifecycle
 */
@Injectable()
export class NatsConnectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NatsConnectionService.name);
  private connection: NatsConnection | null = null;
  private connectionPromise: Promise<NatsConnection> | null = null;

  constructor(private readonly config: NatsConfig) {}

  /**
   * Initialize NATS connection on module init
   */
  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  /**
   * Close NATS connection on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  /**
   * Get NATS connection (creates if doesn't exist)
   */
  async getConnection(): Promise<NatsConnection> {
    if (this.connection) {
      return this.connection;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    return this.connect();
  }

  /**
   * Connect to NATS server
   */
  private async connect(): Promise<NatsConnection> {
    this.connectionPromise = this.establishConnection();

    try {
      this.connection = await this.connectionPromise;
      this.logger.log(`Connected to NATS: ${this.config.servers.join(', ')}`);
      this.setupEventHandlers();

      return this.connection;
    } catch (error) {
      this.logger.error('Failed to connect to NATS', error);
      this.connectionPromise = null;
      throw error;
    }
  }

  /**
   * Establish NATS connection
   */
  private async establishConnection(): Promise<NatsConnection> {
    const options: ConnectionOptions = {
      servers: this.config.servers,
      name: this.config.name || 'motiv-buy-app',
      user: this.config.user,
      pass: this.config.pass,
      token: this.config.token,
      maxReconnectAttempts: this.config.maxReconnectAttempts ?? -1, // Infinite retries
      reconnectTimeWait: this.config.reconnectTimeWait ?? 2000,
      timeout: this.config.timeout ?? 20000,
      verbose: this.config.verbose ?? false,
      debug: this.config.debug ?? false,
    };

    return connect(options);
  }

  /**
   * Setup connection event handlers
   */
  private setupEventHandlers(): void {
    if (!this.connection) {
      return;
    }

    // Handle connection events
    (async () => {
      if (!this.connection) {
        return;
      }

      for await (const status of this.connection.status()) {
        const { type, data } = status;

        switch (type) {
          case 'disconnect':
            this.logger.warn('Disconnected from NATS');
            break;

          case 'reconnect':
            this.logger.log('Reconnected to NATS');
            break;

          case 'reconnecting':
            this.logger.warn('Reconnecting to NATS...');
            break;

          case 'error':
            if (data) {
              this.logger.error('NATS connection error:', data);
            }

            break;

          case 'pingTimer':
            // Optionally log ping/pong events
            break;
        }
      }
    })();
  }

  /**
   * Disconnect from NATS server
   */
  private async disconnect(): Promise<void> {
    if (!this.connection) {
      return;
    }

    try {
      await this.connection.drain();
      await this.connection.close();
      this.logger.log('Disconnected from NATS');
    } catch (error) {
      this.logger.error('Error disconnecting from NATS', error);
    } finally {
      this.connection = null;
      this.connectionPromise = null;
    }
  }

  /**
   * Check if connected to NATS
   */
  isConnected(): boolean {
    return this.connection !== null && !this.connection.isClosed();
  }

  /**
   * Get connection stats
   */
  getStats() {
    if (!this.connection) {
      return null;
    }

    return {
      connected: this.isConnected(),
      server: this.connection.getServer(),
      stats: this.connection.stats(),
    };
  }
}
