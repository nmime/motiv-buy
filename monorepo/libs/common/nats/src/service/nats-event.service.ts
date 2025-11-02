import { Injectable, Logger } from '@nestjs/common';
import { JsMsg, Msg, Subscription } from 'nats';
import { NatsConnectionService } from './nats-connection.service';
import { JetStreamService } from './jetstream.service';
import type { MessageOptions } from '../interface';

/**
 * NATS Event Service
 *
 * Provides pub/sub event streaming functionality
 */
@Injectable()
export class NatsEventService {
  private readonly logger = new Logger(NatsEventService.name);
  private subscriptions: Map<string, Subscription> = new Map();

  constructor(
    private readonly connectionService: NatsConnectionService,
    private readonly jetStreamService: JetStreamService,
  ) {}

  /**
   * Publish an event
   */
  async publish<T = unknown>(subject: string, data: T, options: MessageOptions = {}): Promise<void> {
    try {
      const js = await this.jetStreamService.getClient();

      const payload = JSON.stringify({
        data,
        timestamp: Date.now(),
        eventId: options.msgID || crypto.randomUUID(),
      });

      const publishOptions: Record<string, unknown> = {};

      if (options.msgID) {
        publishOptions['msgID'] = options.msgID;
      }

      if (options.headers) {
        publishOptions['headers'] = options.headers;
      }

      if (options.expect) {
        publishOptions['expect'] = options.expect;
      }

      await js.publish(subject, payload, publishOptions);

      this.logger.debug(`Published event to ${subject}`);
    } catch (error) {
      this.logger.error(`Failed to publish event to ${subject}`, error);
      throw error;
    }
  }

  /**
   * Subscribe to events (non-durable, no replay)
   */
  async subscribe<T = unknown>(subject: string, handler: (data: T, msg: Msg) => void | Promise<void>): Promise<string> {
    try {
      const connection = await this.connectionService.getConnection();

      const subscription = connection.subscribe(subject, {
        callback: async (err, msg) => {
          if (err) {
            this.logger.error(`Error in subscription for ${subject}`, err);

            return;
          }

          try {
            const payload = JSON.parse(msg.string());
            await handler(payload.data, msg);
          } catch (error) {
            this.logger.error(`Failed to handle event from ${subject}`, error);
          }
        },
      });

      const subscriptionId = `${subject}-${Date.now()}`;
      this.subscriptions.set(subscriptionId, subscription);

      this.logger.log(`Subscribed to ${subject}`);

      return subscriptionId;
    } catch (error) {
      this.logger.error(`Failed to subscribe to ${subject}`, error);
      throw error;
    }
  }

  /**
   * Subscribe to events with JetStream (durable, with replay)
   */
  async subscribeWithJetStream<T = unknown>(
    streamName: string,
    consumerName: string,
    handler: (data: T, msg: JsMsg) => Promise<void>,
  ): Promise<void> {
    try {
      const js = await this.jetStreamService.getClient();

      const consumer = await js.consumers.get(streamName, consumerName);

      const messages = await consumer.consume();

      for await (const msg of messages) {
        try {
          const payload = JSON.parse(msg.string());
          await handler(payload.data, msg);
          msg.ack();
        } catch (error) {
          this.logger.error(`Failed to handle JetStream event`, error);
          msg.nak();
        }
      }
    } catch (error) {
      this.logger.error(`Failed to subscribe with JetStream`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe from events
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);

    if (subscription) {
      await subscription.drain();
      this.subscriptions.delete(subscriptionId);
      this.logger.log(`Unsubscribed: ${subscriptionId}`);
    }
  }

  /**
   * Unsubscribe from all events
   */
  async unsubscribeAll(): Promise<void> {
    const promises = Array.from(this.subscriptions.keys()).map((id) => this.unsubscribe(id));
    await Promise.all(promises);
    this.logger.log('Unsubscribed from all events');
  }
}
