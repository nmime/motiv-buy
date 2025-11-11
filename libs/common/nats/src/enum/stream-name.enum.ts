/**
 * NATS JetStream Stream Names
 *
 * Define all streams used in the application
 */
export enum StreamName {
  /** Job queue stream for background tasks */
  Jobs = 'jobs',

  /** Events stream for pub/sub messaging */
  Events = 'events',

  /** Messages stream for reliable message delivery */
  Messages = 'messages',

  /** User events stream */
  UserEvents = 'user_events',

  /** Transaction events stream */
  TransactionEvents = 'transaction_events',

  /** System events stream */
  SystemEvents = 'system_events',
}
