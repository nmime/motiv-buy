import type { RetentionPolicy, StorageType, DiscardPolicy, AckPolicy, DeliverPolicy, ReplayPolicy } from 'nats';

/**
 * NATS Configuration Interface
 */
export interface NatsConfig {
  /** NATS server URLs */
  servers: string[];

  /** Connection name for monitoring */
  name?: string;

  /** Username for authentication */
  user?: string;

  /** Password for authentication */
  pass?: string;

  /** Token for authentication */
  token?: string;

  /** Maximum reconnect attempts */
  maxReconnectAttempts?: number;

  /** Reconnect time wait in milliseconds */
  reconnectTimeWait?: number;

  /** Timeout for connection in milliseconds */
  timeout?: number;

  /** Enable verbose logging */
  verbose?: boolean;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * JetStream Stream Configuration
 */
export interface StreamConfig {
  /** Stream name */
  name: string;

  /** Subjects that belong to this stream */
  subjects: string[];

  /** Retention policy */
  retention?: RetentionPolicy;

  /** Storage type */
  storage?: StorageType;

  /** Maximum messages in stream */
  max_msgs?: number;

  /** Maximum bytes in stream */
  max_bytes?: number;

  /** Maximum age of messages in nanoseconds */
  max_age?: number;

  /** Maximum message size in bytes */
  max_msg_size?: number;

  /** Discard policy when limits are reached */
  discard?: DiscardPolicy;

  /** Number of replicas */
  num_replicas?: number;

  /** Enable duplicate message detection */
  duplicate_window?: number;
}

/**
 * JetStream Consumer Configuration
 */
export interface ConsumerConfig {
  /** Consumer name (durable name) */
  name: string;

  /** Stream name to consume from */
  stream: string;

  /** Delivery subject for push consumers */
  deliver_subject?: string;

  /** Durable consumer name */
  durable_name?: string;

  /** Filter subject */
  filter_subject?: string;

  /** Acknowledgement policy */
  ack_policy?: AckPolicy;

  /** Delivery policy */
  deliver_policy?: DeliverPolicy;

  /** Replay policy */
  replay_policy?: ReplayPolicy;

  /** Max delivery attempts */
  max_deliver?: number;

  /** Ack wait time in nanoseconds */
  ack_wait?: number;

  /** Max ack pending */
  max_ack_pending?: number;

  /** Flow control */
  flow_control?: boolean;

  /** Idle heartbeat */
  idle_heartbeat?: number;
}

/**
 * Job Options
 */
export interface JobOptions {
  /** Job delay in milliseconds */
  delay?: number;

  /** Job priority (1-10, higher is more important) */
  priority?: number;

  /** Maximum retry attempts */
  maxRetries?: number;

  /** Retry backoff in milliseconds */
  retryBackoff?: number;

  /** Job timeout in milliseconds */
  timeout?: number;

  /** Job metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Message Options
 */
export interface MessageOptions {
  /** Message headers */
  headers?: Record<string, string>;

  /** Message ID for deduplication */
  msgID?: string;

  /** Expected stream name */
  expect?: {
    streamName?: string;
    lastSequence?: number;
  };

  /** Timeout in milliseconds */
  timeout?: number;
}
