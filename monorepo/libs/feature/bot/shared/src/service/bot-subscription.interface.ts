/**
 * Chat Member Status
 *
 * Status of a user in a chat (based on Telegram API)
 */
export enum ChatMemberStatus {
  Creator = 'creator',
  Administrator = 'administrator',
  Member = 'member',
  Restricted = 'restricted',
  Left = 'left',
  Kicked = 'kicked',
}

/**
 * Chat Type
 *
 * Type of Telegram chat
 */
export enum ChatType {
  Private = 'private',
  Group = 'group',
  Supergroup = 'supergroup',
  Channel = 'channel',
}

/**
 * Subscription Check Result
 *
 * Result of checking user subscription to a chat
 */
export interface SubscriptionCheckResult {
  /** Whether the user is subscribed (member or admin) */
  isSubscribed: boolean;

  /** User's status in the chat */
  status: ChatMemberStatus;

  /** Whether the user is an administrator */
  isAdmin: boolean;

  /** Whether the user is the chat creator */
  isCreator: boolean;

  /** Chat ID that was checked */
  chatId: string | number;

  /** User ID that was checked */
  userId: string | number;

  /** Timestamp of check */
  timestamp: Date;

  /** Error message if check failed */
  error?: string;
}

/**
 * Bulk Subscription Check Result
 *
 * Result of checking user subscription to multiple chats
 */
export interface BulkSubscriptionCheckResult {
  /** User ID that was checked */
  userId: string | number;

  /** Results for each chat */
  results: Map<string | number, SubscriptionCheckResult>;

  /** Whether user is subscribed to all required chats */
  isSubscribedToAll: boolean;

  /** Whether user is subscribed to at least one chat */
  isSubscribedToAny: boolean;

  /** List of chat IDs where user is subscribed */
  subscribedChats: (string | number)[];

  /** List of chat IDs where user is not subscribed */
  unsubscribedChats: (string | number)[];

  /** Timestamp of check */
  timestamp: Date;
}

/**
 * Chat Information
 *
 * Basic information about a chat
 */
export interface ChatInformation {
  /** Chat ID */
  id: number;

  /** Chat type */
  type: ChatType;

  /** Chat title (for groups/channels) */
  title?: string;

  /** Chat username (for public chats) */
  username?: string;

  /** Whether this is a forum */
  isForum?: boolean;

  /** Number of members (if available) */
  memberCount?: number;
}

/**
 * Bot Subscription Service Interface
 *
 * Service for checking user subscriptions to groups, supergroups, and channels
 */
export interface IBotSubscriptionService {
  /**
   * Check if a user is subscribed to a chat
   *
   * @param botToken - Bot token (bot must be a member of the chat)
   * @param chatId - Chat ID (can be @username for public chats or numeric ID)
   * @param userId - User ID to check
   * @returns Subscription check result
   */
  checkSubscription(
    botToken: string,
    chatId: string | number,
    userId: string | number,
  ): Promise<SubscriptionCheckResult>;

  /**
   * Check if a user is subscribed to multiple chats
   *
   * @param botToken - Bot token
   * @param chatIds - Array of chat IDs to check
   * @param userId - User ID to check
   * @returns Bulk subscription check result
   */
  checkMultipleSubscriptions(
    botToken: string,
    chatIds: (string | number)[],
    userId: string | number,
  ): Promise<BulkSubscriptionCheckResult>;

  /**
   * Check if a user is an administrator in a chat
   *
   * @param botToken - Bot token
   * @param chatId - Chat ID
   * @param userId - User ID to check
   * @returns Whether the user is an administrator
   */
  isUserAdmin(botToken: string, chatId: string | number, userId: string | number): Promise<boolean>;

  /**
   * Get chat information
   *
   * @param botToken - Bot token
   * @param chatId - Chat ID
   * @returns Chat information
   */
  getChatInfo(botToken: string, chatId: string | number): Promise<ChatInformation>;

  /**
   * Get chat member count
   *
   * @param botToken - Bot token
   * @param chatId - Chat ID
   * @returns Number of members in the chat
   */
  getChatMemberCount(botToken: string, chatId: string | number): Promise<number>;
}
