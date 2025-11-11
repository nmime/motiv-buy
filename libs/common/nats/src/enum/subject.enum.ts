/**
 * NATS Subject Names
 *
 * Define all subjects/topics used in the application
 * Use hierarchical naming: domain.action.resource
 * NATS subjects conventionally use dot notation, not snake_case
 */
/* eslint-disable no-restricted-syntax */
export enum Subject {
  // Job Queue Subjects
  JobEmail = 'jobs.email',
  JobNotification = 'jobs.notification',
  JobPayment = 'jobs.payment',
  JobCleanup = 'jobs.cleanup',

  // Event Subjects
  EventUserCreated = 'events.user.created',
  EventUserUpdated = 'events.user.updated',
  EventUserDeleted = 'events.user.deleted',

  EventTransactionCreated = 'events.transaction.created',
  EventTransactionCompleted = 'events.transaction.completed',
  EventTransactionFailed = 'events.transaction.failed',

  // Message Subjects
  MessageBroadcast = 'messages.broadcast',
  MessageDirect = 'messages.direct',

  // System Subjects
  SystemHealthCheck = 'system.health.check',
  SystemMetrics = 'system.metrics',
}
/* eslint-enable no-restricted-syntax */
