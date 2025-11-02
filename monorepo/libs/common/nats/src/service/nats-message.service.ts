import { Injectable, Logger } from '@nestjs/common';
import { NatsConnectionService } from './nats-connection.service';
import { JetStreamService } from './jetstream.service';
import type { MessageOptions } from '../interface';

/**
 * NATS Message Service
 *
 * Provides reliable message broker functionality
 */
@Injectable()
export class NatsMessageService {
  private readonly logger = new Logger(NatsMessageService.name);

  constructor(
    private readonly connectionService: NatsConnectionService,
    private readonly jetStreamService: JetStreamService,
  ) {}

  /**
   * Send a message (request-reply pattern)
   */
  async send<TRequest = unknown, TResponse = unknown>(
    subject: string,
    data: TRequest,
    options: MessageOptions = {},
  ): Promise<TResponse> {
    try {
      const connection = await this.connectionService.getConnection();

      const payload = JSON.stringify({
        data,
        timestamp: Date.now(),
        messageId: options.msgID || crypto.randomUUID(),
      });

      const timeout = options.timeout || 5000;

      const response = await connection.request(subject, payload, { timeout });

      const result = JSON.parse(response.string());

      return result.data as TResponse;
    } catch (error) {
      this.logger.error(`Failed to send message to ${subject}`, error);
      throw error;
    }
  }

  /**
   * Send a message without waiting for response (fire-and-forget)
   */
  async sendAsync<T = unknown>(subject: string, data: T, options: MessageOptions = {}): Promise<void> {
    try {
      const js = await this.jetStreamService.getClient();

      const payload = JSON.stringify({
        data,
        timestamp: Date.now(),
        messageId: options.msgID || crypto.randomUUID(),
      });

      const publishOptions: Record<string, unknown> = {};

      if (options.msgID) {
        publishOptions['msgID'] = options.msgID;
      }

      if (options.headers) {
        publishOptions['headers'] = options.headers;
      }

      await js.publish(subject, payload, publishOptions);

      this.logger.debug(`Sent async message to ${subject}`);
    } catch (error) {
      this.logger.error(`Failed to send async message to ${subject}`, error);
      throw error;
    }
  }

  /**
   * Reply to a message
   */
  async reply<T = unknown>(msg: { respond: (payload: string) => void }, data: T): Promise<void> {
    try {
      const payload = JSON.stringify({
        data,
        timestamp: Date.now(),
      });

      msg.respond(payload);
      this.logger.debug('Replied to message');
    } catch (error) {
      this.logger.error('Failed to reply to message', error);
      throw error;
    }
  }

  /**
   * Handle incoming messages (responder pattern)
   */
  async handleMessages<TRequest = unknown, TResponse = unknown>(
    subject: string,
    handler: (data: TRequest) => Promise<TResponse>,
  ): Promise<void> {
    try {
      const connection = await this.connectionService.getConnection();

      connection.subscribe(subject, {
        callback: async (err, msg) => {
          if (err) {
            this.logger.error(`Error in message handler for ${subject}`, err);

            return;
          }

          try {
            const payload = JSON.parse(msg.string());
            const response = await handler(payload.data);

            await this.reply(msg, response);
          } catch (error) {
            this.logger.error(`Failed to handle message from ${subject}`, error);

            // Send error response
            const errorPayload = JSON.stringify({
              error: {
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now(),
              },
            });

            msg.respond(errorPayload);
          }
        },
      });

      this.logger.log(`Handling messages on ${subject}`);
    } catch (error) {
      this.logger.error(`Failed to setup message handler for ${subject}`, error);
      throw error;
    }
  }

  /**
   * Broadcast a message to all subscribers
   */
  async broadcast<T = unknown>(subject: string, data: T): Promise<void> {
    try {
      const connection = await this.connectionService.getConnection();

      const payload = JSON.stringify({
        data,
        timestamp: Date.now(),
        broadcastId: crypto.randomUUID(),
      });

      connection.publish(subject, payload);

      this.logger.debug(`Broadcasted message to ${subject}`);
    } catch (error) {
      this.logger.error(`Failed to broadcast message to ${subject}`, error);
      throw error;
    }
  }
}
