/**
 * Bot Status Enum
 *
 * Defines all possible bot operational states.
 * Used for bot lifecycle management and monitoring.
 *
 * @enum BotStatus
 */
export enum BotStatus {
  /** Bot is active and processing messages */
  Active = 'active',

  /** Bot is paused and not processing messages */
  Paused = 'paused',

  /** Bot is inactive or disabled */
  Inactive = 'inactive',
}
