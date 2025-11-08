import { Injectable, Logger } from '@nestjs/common';
import { Bot } from 'grammy';
import {
  BulkSubscriptionCheckResult,
  ChatInformation,
  ChatMemberStatus,
  ChatType,
  IBotSubscriptionService,
  SubscriptionCheckResult,
} from './bot-subscription.interface';

/**
 * Bot Subscription Service
 *
 * Service for checking user subscriptions to Telegram groups, supergroups, and channels.
 * Uses Telegram Bot API to verify if users are members of specific chats.
 *
 * @class BotSubscriptionService
 * @implements {IBotSubscriptionService}
 */
@Injectable()
export class BotSubscriptionService implements IBotSubscriptionService {
  private readonly logger = new Logger(BotSubscriptionService.name);

  /**
   * Check if a user is subscribed to a chat
   *
   * @param botToken - Bot token (bot must be a member of the chat)
   * @param chatId - Chat ID (can be @username for public chats or numeric ID)
   * @param userId - User ID to check
   * @returns Subscription check result
   *
   * @example
   * const result = await subscriptionService.checkSubscription(
   *   botToken,
   *   '@mychannel',
   *   123456789
   * );
   * if (result.isSubscribed) {
   *   console.log('User is subscribed!');
   * }
   */
  async checkSubscription(
    botToken: string,
    chatId: string | number,
    userId: string | number,
  ): Promise<SubscriptionCheckResult> {
    this.logger.log(`Checking subscription for user ${userId} in chat ${chatId}`);

    try {
      const bot = new Bot(botToken);
      const chatMember = await bot.api.getChatMember(chatId, Number(userId));

      const status = this.mapChatMemberStatus(chatMember.status);
      const isSubscribed = this.isSubscribedStatus(status);
      const isAdmin = status === ChatMemberStatus.Administrator || status === ChatMemberStatus.Creator;
      const isCreator = status === ChatMemberStatus.Creator;

      this.logger.log(`User ${userId} in chat ${chatId}: ${status} (subscribed: ${isSubscribed})`);

      return {
        isSubscribed,
        status,
        isAdmin,
        isCreator,
        chatId,
        userId,
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to check subscription for user ${userId} in chat ${chatId}: ${errorMessage}`);

      return {
        isSubscribed: false,
        status: ChatMemberStatus.Left,
        isAdmin: false,
        isCreator: false,
        chatId,
        userId,
        timestamp: new Date(),
        error: errorMessage,
      };
    }
  }

  /**
   * Check if a user is subscribed to multiple chats
   *
   * @param botToken - Bot token
   * @param chatIds - Array of chat IDs to check
   * @param userId - User ID to check
   * @returns Bulk subscription check result
   *
   * @example
   * const result = await subscriptionService.checkMultipleSubscriptions(
   *   botToken,
   *   ['@channel1', '@channel2', -1001234567890],
   *   123456789
   * );
   * console.log('Subscribed to all:', result.isSubscribedToAll);
   */
  async checkMultipleSubscriptions(
    botToken: string,
    chatIds: (string | number)[],
    userId: string | number,
  ): Promise<BulkSubscriptionCheckResult> {
    this.logger.log(`Checking subscription for user ${userId} in ${chatIds.length} chats`);

    const results = new Map<string | number, SubscriptionCheckResult>();
    const subscribedChats: (string | number)[] = [];
    const unsubscribedChats: (string | number)[] = [];

    // Check all chats in parallel
    const checks = chatIds.map(async (chatId) => {
      const result = await this.checkSubscription(botToken, chatId, userId);
      results.set(chatId, result);

      if (result.isSubscribed) {
        subscribedChats.push(chatId);
      } else {
        unsubscribedChats.push(chatId);
      }
    });

    await Promise.all(checks);

    const isSubscribedToAll = subscribedChats.length === chatIds.length;
    const isSubscribedToAny = subscribedChats.length > 0;

    this.logger.log(`User ${userId} subscribed to ${subscribedChats.length}/${chatIds.length} chats`);

    return {
      userId,
      results,
      isSubscribedToAll,
      isSubscribedToAny,
      subscribedChats,
      unsubscribedChats,
      timestamp: new Date(),
    };
  }

  /**
   * Check if a user is an administrator in a chat
   *
   * @param botToken - Bot token
   * @param chatId - Chat ID
   * @param userId - User ID to check
   * @returns Whether the user is an administrator
   *
   * @example
   * const isAdmin = await subscriptionService.isUserAdmin(
   *   botToken,
   *   '@mychannel',
   *   123456789
   * );
   */
  async isUserAdmin(botToken: string, chatId: string | number, userId: string | number): Promise<boolean> {
    this.logger.log(`Checking admin status for user ${userId} in chat ${chatId}`);

    try {
      const result = await this.checkSubscription(botToken, chatId, userId);

      return result.isAdmin;
    } catch (error) {
      this.logger.error(`Failed to check admin status for user ${userId} in chat ${chatId}`, error);

      return false;
    }
  }

  /**
   * Get chat information
   *
   * @param botToken - Bot token
   * @param chatId - Chat ID
   * @returns Chat information
   *
   * @example
   * const chatInfo = await subscriptionService.getChatInfo(
   *   botToken,
   *   '@mychannel'
   * );
   * console.log('Chat title:', chatInfo.title);
   */
  async getChatInfo(botToken: string, chatId: string | number): Promise<ChatInformation> {
    this.logger.log(`Retrieving chat information for chat ${chatId}`);

    try {
      const bot = new Bot(botToken);
      const chat = await bot.api.getChat(chatId);

      const chatInfo: ChatInformation = {
        id: chat.id,
        type: this.mapChatType(chat.type),
        title: 'title' in chat ? chat.title : undefined,
        username: 'username' in chat ? chat.username : undefined,
        isForum: 'is_forum' in chat ? chat.is_forum : undefined,
      };

      this.logger.log(`Chat info retrieved: ${chatInfo.title || chatInfo.username || chatInfo.id}`);

      return chatInfo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get chat info for ${chatId}: ${errorMessage}`);
      throw new Error(`Failed to retrieve chat information: ${errorMessage}`);
    }
  }

  /**
   * Get chat member count
   *
   * @param botToken - Bot token
   * @param chatId - Chat ID
   * @returns Number of members in the chat
   *
   * @example
   * const memberCount = await subscriptionService.getChatMemberCount(
   *   botToken,
   *   '@mychannel'
   * );
   * console.log('Members:', memberCount);
   */
  async getChatMemberCount(botToken: string, chatId: string | number): Promise<number> {
    this.logger.log(`Retrieving member count for chat ${chatId}`);

    try {
      const bot = new Bot(botToken);
      const count = await bot.api.getChatMemberCount(chatId);

      this.logger.log(`Chat ${chatId} has ${count} members`);

      return count;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get member count for chat ${chatId}: ${errorMessage}`);

      throw new Error(`Failed to retrieve chat member count: ${errorMessage}`);
    }
  }

  /**
   * Map Telegram chat member status to enum
   *
   * @private
   * @param status - Telegram chat member status string
   * @returns ChatMemberStatus enum value
   */
  private mapChatMemberStatus(status: string): ChatMemberStatus {
    switch (status) {
      case 'creator':
        return ChatMemberStatus.Creator;
      case 'administrator':
        return ChatMemberStatus.Administrator;
      case 'member':
        return ChatMemberStatus.Member;
      case 'restricted':
        return ChatMemberStatus.Restricted;
      case 'left':
        return ChatMemberStatus.Left;
      case 'kicked':
        return ChatMemberStatus.Kicked;
      default:
        this.logger.warn(`Unknown chat member status: ${status}`);

        return ChatMemberStatus.Left;
    }
  }

  /**
   * Map Telegram chat type to enum
   *
   * @private
   * @param type - Telegram chat type string
   * @returns ChatType enum value
   */
  private mapChatType(type: string): ChatType {
    switch (type) {
      case 'private':
        return ChatType.Private;
      case 'group':
        return ChatType.Group;
      case 'supergroup':
        return ChatType.Supergroup;
      case 'channel':
        return ChatType.Channel;
      default:
        this.logger.warn(`Unknown chat type: ${type}`);

        return ChatType.Private;
    }
  }

  /**
   * Check if a status indicates subscription (member or admin)
   *
   * @private
   * @param status - Chat member status
   * @returns Whether the status indicates subscription
   */
  private isSubscribedStatus(status: ChatMemberStatus): boolean {
    return (
      status === ChatMemberStatus.Creator ||
      status === ChatMemberStatus.Administrator ||
      status === ChatMemberStatus.Member
    );
  }
}
