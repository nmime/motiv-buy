import { Injectable, Logger } from '@nestjs/common';
import {
  JetStreamClient,
  JetStreamManager,
  StreamConfig as NatsStreamConfig,
  ConsumerConfig as NatsConsumerConfig,
} from 'nats';
import { NatsConnectionService } from './nats-connection.service';
import type { StreamConfig, ConsumerConfig } from '../interface';

/**
 * JetStream Service
 *
 * Manages JetStream streams and consumers
 */
@Injectable()
export class JetStreamService {
  private readonly logger = new Logger(JetStreamService.name);
  private jsm: JetStreamManager | null = null;
  private js: JetStreamClient | null = null;

  constructor(private readonly connectionService: NatsConnectionService) {}

  /**
   * Get JetStream Manager
   */
  async getManager(): Promise<JetStreamManager> {
    if (this.jsm) {
      return this.jsm;
    }

    const connection = await this.connectionService.getConnection();
    this.jsm = await connection.jetstreamManager();

    return this.jsm;
  }

  /**
   * Get JetStream Client
   */
  async getClient(): Promise<JetStreamClient> {
    if (this.js) {
      return this.js;
    }

    const connection = await this.connectionService.getConnection();
    this.js = connection.jetstream();

    return this.js;
  }

  /**
   * Create or update a stream
   */
  async createOrUpdateStream(config: StreamConfig): Promise<void> {
    try {
      const jsm = await this.getManager();

      const streamConfig: Partial<NatsStreamConfig> = {
        name: config.name,
        subjects: config.subjects,
        retention: config.retention,
        storage: config.storage,
        max_msgs: config.max_msgs,
        max_bytes: config.max_bytes,
        max_age: config.max_age,
        max_msg_size: config.max_msg_size,
        discard: config.discard,
        num_replicas: config.num_replicas,
        duplicate_window: config.duplicate_window,
      };

      try {
        // Try to update existing stream
        await jsm.streams.update(config.name, streamConfig);
        this.logger.log(`Updated stream: ${config.name}`);
        // eslint-disable-next-line sonarjs/no-ignored-exceptions
      } catch (_error) {
        // Stream doesn't exist, create it (expected error, intentionally ignored)
        await jsm.streams.add(streamConfig);
        this.logger.log(`Created stream: ${config.name}`);
      }
    } catch (error) {
      this.logger.error(`Failed to create/update stream ${config.name}`, error);
      throw error;
    }
  }

  /**
   * Delete a stream
   */
  async deleteStream(streamName: string): Promise<void> {
    try {
      const jsm = await this.getManager();
      await jsm.streams.delete(streamName);
      this.logger.log(`Deleted stream: ${streamName}`);
    } catch (error) {
      this.logger.error(`Failed to delete stream ${streamName}`, error);
      throw error;
    }
  }

  /**
   * Get stream info
   */
  async getStreamInfo(streamName: string) {
    try {
      const jsm = await this.getManager();

      return await jsm.streams.info(streamName);
    } catch (error) {
      this.logger.error(`Failed to get stream info for ${streamName}`, error);
      throw error;
    }
  }

  /**
   * List all streams
   */
  async listStreams() {
    try {
      const jsm = await this.getManager();
      const streams = await jsm.streams.list().next();

      return streams;
    } catch (error) {
      this.logger.error('Failed to list streams', error);
      throw error;
    }
  }

  /**
   * Create or update a consumer
   */
  async createOrUpdateConsumer(config: ConsumerConfig): Promise<void> {
    try {
      const jsm = await this.getManager();

      const consumerConfig: Partial<NatsConsumerConfig> = {
        durable_name: config.name,
        deliver_subject: config.deliver_subject,
        filter_subject: config.filter_subject,
        ack_policy: config.ack_policy,
        deliver_policy: config.deliver_policy,
        replay_policy: config.replay_policy,
        max_deliver: config.max_deliver,
        ack_wait: config.ack_wait,
        max_ack_pending: config.max_ack_pending,
        flow_control: config.flow_control,
        idle_heartbeat: config.idle_heartbeat,
      };

      try {
        // Try to update existing consumer
        await jsm.consumers.update(config.stream, config.name, consumerConfig);
        this.logger.log(`Updated consumer: ${config.name} on stream ${config.stream}`);
        // eslint-disable-next-line sonarjs/no-ignored-exceptions
      } catch (_error) {
        // Consumer doesn't exist, create it (expected error, intentionally ignored)
        await jsm.consumers.add(config.stream, consumerConfig);
        this.logger.log(`Created consumer: ${config.name} on stream ${config.stream}`);
      }
    } catch (error) {
      this.logger.error(`Failed to create/update consumer ${config.name}`, error);
      throw error;
    }
  }

  /**
   * Delete a consumer
   */
  async deleteConsumer(streamName: string, consumerName: string): Promise<void> {
    try {
      const jsm = await this.getManager();
      await jsm.consumers.delete(streamName, consumerName);
      this.logger.log(`Deleted consumer: ${consumerName} from stream ${streamName}`);
    } catch (error) {
      this.logger.error(`Failed to delete consumer ${consumerName}`, error);
      throw error;
    }
  }

  /**
   * Get consumer info
   */
  async getConsumerInfo(streamName: string, consumerName: string) {
    try {
      const jsm = await this.getManager();

      return await jsm.consumers.info(streamName, consumerName);
    } catch (error) {
      this.logger.error(`Failed to get consumer info for ${consumerName}`, error);
      throw error;
    }
  }

  /**
   * Purge stream (remove all messages)
   */
  async purgeStream(streamName: string): Promise<void> {
    try {
      const jsm = await this.getManager();
      await jsm.streams.purge(streamName);
      this.logger.log(`Purged stream: ${streamName}`);
    } catch (error) {
      this.logger.error(`Failed to purge stream ${streamName}`, error);
      throw error;
    }
  }
}
