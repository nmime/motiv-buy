import { Context, SessionFlavor } from 'grammy';

/**
 * Bot Instance Options
 *
 * Configuration options for creating bot instances
 */
export interface BotInstanceOptions {
  /** Bot token (optional - if not provided, creates unauthenticated bot) */
  token?: string;

  /** Enable session support */
  enableSession?: boolean;

  /** Session storage type */
  sessionStorage?: 'memory' | 'redis' | 'database';

  /** Enable automatic retry on API errors */
  enableRetry?: boolean;

  /** API timeout in milliseconds */
  apiTimeout?: number;

  /** Custom bot API endpoint (for local bot API server) */
  apiRoot?: string;

  /** Enable webhooks mode */
  webhookMode?: boolean;

  /** Allowed updates (null for all updates) */
  allowedUpdates?: string[] | null;
}

/**
 * Bot Instance Info
 *
 * Information about a bot retrieved from getMe
 */
export interface BotInstanceInfo {
  /** Bot ID */
  id: number;

  /** Bot username */
  username: string;

  /** Bot first name */
  firstName: string;

  /** Whether this is a bot account */
  isBot: boolean;

  /** Whether the bot can be added to groups */
  canJoinGroups?: boolean;

  /** Whether the bot can read all group messages */
  canReadAllGroupMessages?: boolean;

  /** Whether the bot supports inline queries */
  supportsInlineQueries?: boolean;

  /** Whether the bot can be connected to a Telegram Business account */
  canConnectToBusiness?: boolean;
}

/**
 * Bot Validation Result
 *
 * Result of bot token validation
 */
export interface BotValidationResult {
  /** Whether the token is valid */
  isValid: boolean;

  /** Bot information (if valid) */
  botInfo?: BotInstanceInfo;

  /** Error message (if invalid) */
  error?: string;

  /** Error code */
  errorCode?: string;

  /** Timestamp of validation */
  timestamp: Date;
}

/**
 * Extended Grammy Context with session support
 */
export interface BotSessionContext extends Context, SessionFlavor<Record<string, unknown>> {
  userId?: string;
  isAuthenticated?: boolean;
  userData?: {
    id: string;
    firstName: string;
    lastName?: string;
    username?: string;
    languageCode?: string;
  };
}
