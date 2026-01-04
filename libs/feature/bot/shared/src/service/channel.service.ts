/**
 * Channel Service
 *
 * Service for channel-related operations using the configured Telegram bot.
 * Encapsulates bot token management and provides high-level channel APIs.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';
import { BotSubscriptionService } from './bot-subscription.service';
import { ChatInformation } from './bot-subscription.types';

/**
 * Channel information with additional metadata
 */
export interface ChannelInfo {
  id: string;
  title: string;
  username: string;
  subscriberCount: number;
  description?: string;
  category?: string;
  botIsAdmin: boolean;
}

@Injectable()
export class ChannelService {
  private readonly logger = new Logger(ChannelService.name);

  constructor(
    private readonly botSubscriptionService: BotSubscriptionService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get the configured bot token
   *
   * @returns Bot token
   * @throws Error if token is not configured
   */
  private getBotToken(): string {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
    }

    return token;
  }

  /**
   * Get channel info from a Telegram link
   *
   * @param link - Telegram channel link (e.g., https://t.me/channel_name)
   * @returns Channel information or null if not found
   */
  async getChannelInfoFromLink(link: string): Promise<ChannelInfo | null> {
    // Extract username from link
    const match = link.match(/t\.me\/(\w+)/i);
    if (!match) {
      this.logger.warn(`Invalid channel link format: ${link}`);

      return null;
    }

    const [, username] = match;

    return this.getChannelInfo(`@${username}`);
  }

  /**
   * Get channel info by chat ID or username
   *
   * @param chatId - Chat ID (e.g., @channel_name or numeric ID)
   * @returns Channel information or null if not found
   */
  async getChannelInfo(chatId: string | number): Promise<ChannelInfo | null> {
    try {
      const botToken = this.getBotToken();

      // Get chat information from Telegram API
      const chatInfo = await this.botSubscriptionService.getChatInfo(botToken, chatId);

      // Get member count
      const memberCount = await this.botSubscriptionService.getChatMemberCount(botToken, chatId);

      // Get bot's admin status
      const botIsAdmin = await this.checkBotIsAdmin(chatId);

      const channelInfo: ChannelInfo = {
        id: chatInfo.id.toString(),
        title: chatInfo.title ?? (typeof chatId === 'string' ? chatId.replace('@', '') : chatId.toString()),
        username: chatInfo.username ?? (typeof chatId === 'string' ? chatId.replace('@', '') : ''),
        subscriberCount: memberCount,
        description: undefined, // Telegram API doesn't provide description via getChat
        category: undefined, // Category must be manually set
        botIsAdmin,
      };

      this.logger.log(
        `Channel info retrieved: ${channelInfo.username} (${memberCount} members, bot admin: ${botIsAdmin})`,
      );

      return channelInfo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get channel info for ${chatId}: ${errorMessage}`);

      return null;
    }
  }

  /**
   * Check if the configured bot is an admin in a channel
   *
   * @param chatId - Chat ID (e.g., @channel_name or numeric ID)
   * @returns True if bot is admin
   */
  async checkBotIsAdmin(chatId: string | number): Promise<boolean> {
    try {
      const botToken = this.getBotToken();

      // Get bot's own user ID
      const botId = await this.getBotUserId();
      if (!botId) {
        return false;
      }

      // Check if bot is admin using Telegram API
      const isAdmin = await this.botSubscriptionService.isUserAdmin(botToken, chatId, botId);

      this.logger.log(`Bot admin status for channel ${chatId}: ${isAdmin}`);

      return isAdmin;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to check bot admin status for ${chatId}: ${errorMessage}`);

      return false;
    }
  }

  /**
   * Get the chat information
   *
   * @param chatId - Chat ID
   * @returns Chat information
   */
  async getChatInfo(chatId: string | number): Promise<ChatInformation> {
    const botToken = this.getBotToken();

    return this.botSubscriptionService.getChatInfo(botToken, chatId);
  }

  /**
   * Get the member count of a chat
   *
   * @param chatId - Chat ID
   * @returns Member count
   */
  async getChatMemberCount(chatId: string | number): Promise<number> {
    const botToken = this.getBotToken();

    return this.botSubscriptionService.getChatMemberCount(botToken, chatId);
  }

  /**
   * Check if a user is subscribed to a chat
   *
   * @param chatId - Chat ID
   * @param userId - User ID to check
   * @returns True if user is subscribed
   */
  async isUserSubscribed(chatId: string | number, userId: string | number): Promise<boolean> {
    const botToken = this.getBotToken();
    const result = await this.botSubscriptionService.checkSubscription(botToken, chatId, userId);

    return result.isSubscribed;
  }

  /**
   * Check if a user is an admin in a chat
   *
   * @param chatId - Chat ID
   * @param userId - User ID to check
   * @returns True if user is admin
   */
  async isUserAdmin(chatId: string | number, userId: string | number): Promise<boolean> {
    const botToken = this.getBotToken();

    return this.botSubscriptionService.isUserAdmin(botToken, chatId, userId);
  }

  /**
   * Get the bot's user ID
   *
   * @returns Bot user ID or null if failed
   */
  private async getBotUserId(): Promise<number | null> {
    try {
      const botToken = this.getBotToken();
      const bot = new Bot(botToken);
      const me = await bot.api.getMe();

      return me.id;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get bot user ID: ${errorMessage}`);

      return null;
    }
  }
}
