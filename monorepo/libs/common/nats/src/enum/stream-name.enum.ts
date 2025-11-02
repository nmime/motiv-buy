/**
 * NATS JetStream Stream Names
 *
 * Define all streams used in the application
 */
export enum StreamName {
  /** Job queue stream for background tasks */
  Jobs = 'JOBS',

  /** Events stream for pub/sub messaging */
  Events = 'EVENTS',

  /** Messages stream for reliable message delivery */
  Messages = 'MESSAGES',

  /** User events stream */
  UserEvents = 'USER_EVENTS',

  /** Transaction events stream */
  TransactionEvents = 'TRANSACTION_EVENTS',

  /** System events stream */
  SystemEvents = 'SYSTEM_EVENTS',
}
