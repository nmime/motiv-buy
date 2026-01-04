import { Injectable, Logger } from '@nestjs/common';
import { JsMsg } from 'nats';
import { JetStreamService } from './jetstream.service';
import type { JobOptions } from '../interface';
import { StreamName } from '../enum';

/**
 * NATS Queue Service
 *
 * Provides job queue functionality using JetStream work queues
 */
@Injectable()
export class NatsQueueService {
  private readonly logger = new Logger(NatsQueueService.name);

  constructor(private readonly jetStreamService: JetStreamService) {}

  /**
   * Add a job to the queue
   */
  async addJob<T = unknown>(subject: string, data: T, options: JobOptions = {}): Promise<void> {
    try {
      const js = await this.jetStreamService.getClient();

      const payload = JSON.stringify({
        data,
        metadata: options.metadata || {},
        createdAt: Date.now(),
        priority: options.priority || 5,
        maxRetries: options.maxRetries || 3,
        retryBackoff: options.retryBackoff || 1000,
        timeout: options.timeout,
      });

      const publishOptions: Record<string, unknown> = {};

      // Add message ID for deduplication
      if (options.metadata && 'jobId' in options.metadata) {
        publishOptions['msgID'] = String(options.metadata['jobId']);
      }

      // Add delay if specified (using headers)
      if (options.delay && options.delay > 0) {
        publishOptions['headers'] = {
          'Nats-Msg-Id': publishOptions['msgID'] || `job-${Date.now()}`,
          'X-Delay': String(options.delay),
        };
      }

      await js.publish(subject, payload, publishOptions);

      this.logger.debug(`Added job to queue: ${subject}`);
    } catch (error) {
      this.logger.error(`Failed to add job to queue: ${subject}`, error);
      throw error;
    }
  }

  /**
   * Process jobs from queue
   *
   * @param subject - Subject to subscribe to
   * @param handler - Job handler function
   * @param options - Consumer options
   */
  async processJobs<T = unknown>(
    subject: string,
    handler: (data: T, msg: JsMsg) => Promise<void>,
    options: {
      consumerName: string;
      maxConcurrent?: number;
      autoAck?: boolean;
    } = { consumerName: 'default' },
  ): Promise<void> {
    try {
      const js = await this.jetStreamService.getClient();

      // Subscribe to queue
      const consumer = await js.consumers.get(StreamName.Jobs, options.consumerName);

      const messages = await consumer.consume({
        max_messages: options.maxConcurrent || 1,
      });

      // Process messages
      for await (const msg of messages) {
        let payload!: {
          data: T;
          createdAt: number;
          maxRetries?: number;
          retryBackoff?: number;
        };

        try {
          // Parse job data
          payload = JSON.parse(msg.string());

          // Check for delayed message
          const delayHeader = msg.headers?.get('X-Delay');
          if (delayHeader) {
            const delay = parseInt(delayHeader, 10);
            const elapsed = Date.now() - payload.createdAt;

            if (elapsed < delay) {
              // Message is not ready to be processed yet
              msg.nak(delay - elapsed); // NAK with delay
              continue;
            }
          }

          // Execute handler
          await handler(payload.data, msg);

          // Auto-acknowledge if enabled
          if (options.autoAck !== false) {
            msg.ack();
          }

          this.logger.debug(`Processed job from ${subject}`);
        } catch (error) {
          this.logger.error(`Failed to process job from ${subject}`, error);

          // Check retry count
          const { info } = msg;
          const maxRetries = payload?.maxRetries || 3;
          const retryBackoff = payload?.retryBackoff || 1000;

          if (info.redeliveryCount < maxRetries) {
            // NAK message for retry with exponential backoff
            const retryDelay = retryBackoff * Math.pow(2, info.redeliveryCount);
            msg.nak(retryDelay);
          } else {
            // Max retries exceeded, terminate message
            msg.term();
            this.logger.warn(`Job from ${subject} exceeded max retries, terminated`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to process jobs from ${subject}`, error);
      throw error;
    }
  }

  /**
   * Get queue stats
   */
  async getQueueStats(subject: string) {
    try {
      const streamInfo = await this.jetStreamService.getStreamInfo(StreamName.Jobs);

      return {
        total: streamInfo.state.messages,
        consumers: streamInfo.state.consumer_count,
        subjects: streamInfo.state.num_subjects,
      };
    } catch (error) {
      this.logger.error(`Failed to get queue stats for ${subject}`, error);
      throw error;
    }
  }
}
