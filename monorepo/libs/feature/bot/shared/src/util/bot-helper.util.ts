/**
 * Bot Helper Utilities
 *
 * Collection of utility functions for common bot operations including
 * message formatting, user data extraction, context manipulation,
 * and response generation.
 */

import { BotUser, BotMessage } from '../type';

/**
 * Message Format Options
 */
export interface MessageFormatOptions {
  /** Parse mode for message formatting */
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';

  /** Disable web page preview */
  disableWebPagePreview?: boolean;

  /** Disable notification */
  disableNotification?: boolean;

  /** Protect content from forwarding */
  protectContent?: boolean;

  /** Maximum message length */
  maxLength?: number;

  /** Truncate message if too long */
  truncate?: boolean;

  /** Truncate suffix */
  truncateSuffix?: string;
}

/**
 * User Data Extract Options
 */
export interface UserDataExtractOptions {
  /** Include user ID */
  includeId?: boolean;

  /** Include username */
  includeUsername?: boolean;

  /** Include language code */
  includeLanguageCode?: boolean;

  /** Include premium status */
  includePremiumStatus?: boolean;

  /** Custom display name format */
  displayNameFormat?: 'first' | 'first_last' | 'username' | 'custom';

  /** Custom display name template */
  customTemplate?: string;
}

/**
 * Bot Helper Utilities Class
 */
export class BotHelperUtil {
  /**
   * Format message with options
   *
   * @param text - Message text
   * @param options - Formatting options
   * @returns Formatted message
   */
  static formatMessage(text: string, options: MessageFormatOptions = {}): string {
    const { maxLength = 4096, truncate = true, truncateSuffix = '...' } = options;

    let formattedText = text;

    // Handle message length
    if (formattedText.length > maxLength) {
      if (truncate) {
        formattedText = formattedText.substring(0, maxLength - truncateSuffix.length) + truncateSuffix;
      } else {
        throw new Error(`Message exceeds maximum length of ${maxLength} characters`);
      }
    }

    return formattedText;
  }

  /**
   * Format message with HTML
   *
   * @param text - Message text
   * @param options - Formatting options
   * @returns HTML formatted message
   */
  static formatHTML(text: string, options: MessageFormatOptions = {}): string {
    const formattedText = this.formatMessage(text, options);

    return this.escapeHTML(formattedText);
  }

  /**
   * Format message with Markdown
   *
   * @param text - Message text
   * @param options - Formatting options
   * @returns Markdown formatted message
   */
  static formatMarkdown(text: string, options: MessageFormatOptions = {}): string {
    const formattedText = this.formatMessage(text, options);

    return this.escapeMarkdown(formattedText);
  }

  /**
   * Extract user display name
   *
   * @param user - Bot user object
   * @param options - Extract options
   * @returns User display name
   */
  static extractUserDisplayName(user: BotUser, options: UserDataExtractOptions = {}): string {
    const { displayNameFormat = 'first_last', customTemplate } = options;

    if (customTemplate) {
      return this.applyCustomTemplate(user, customTemplate);
    }

    switch (displayNameFormat) {
      case 'first':
        return user.first_name;

      case 'first_last':
        return user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name;

      case 'username':
        return user.username ? `@${user.username}` : user.first_name;

      default:
        return user.first_name;
    }
  }

  /**
   * Extract user data
   *
   * @param user - Bot user object
   * @param options - Extract options
   * @returns Extracted user data
   */
  static extractUserData(user: BotUser, options: UserDataExtractOptions = {}): Record<string, unknown> {
    const {
      includeId = true,
      includeUsername = true,
      includeLanguageCode = true,
      includePremiumStatus = false,
    } = options;

    const userData: Record<string, unknown> = {
      displayName: this.extractUserDisplayName(user, options),
      firstName: user.first_name,
      lastName: user.last_name || null,
    };

    if (includeId) {
      userData.id = user.id;
    }

    if (includeUsername) {
      userData.username = user.username || null;
    }

    if (includeLanguageCode) {
      userData.languageCode = user.language_code || null;
    }

    if (includePremiumStatus) {
      userData.isPremium = user.is_premium || false;
    }

    return userData;
  }

  /**
   * Get chat type description
   *
   * @param chatType - Chat type string
   * @returns Chat type description
   */
  static getChatTypeDescription(chatType: string): string {
    switch (chatType) {
      case 'private':
        return 'private chat';
      case 'group':
        return 'group chat';
      case 'supergroup':
        return 'supergroup';
      case 'channel':
        return 'channel';
      default:
        return 'unknown chat type';
    }
  }

  /**
   * Check if chat is private
   *
   * @param chatType - Chat type string
   * @returns True if private chat
   */
  static isPrivateChat(chatType: string): boolean {
    return chatType === 'private';
  }

  /**
   * Check if chat is group
   *
   * @param chatType - Chat type string
   * @returns True if group chat
   */
  static isGroupChat(chatType: string): boolean {
    return chatType === 'group' || chatType === 'supergroup';
  }

  /**
   * Generate unique request ID
   *
   * @returns Unique request ID
   */
  static generateRequestId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);

    return `req_${timestamp}_${random}`;
  }

  /**
   * Generate correlation ID
   *
   * @param prefix - Prefix for correlation ID
   * @returns Correlation ID
   */
  static generateCorrelationId(prefix = 'corr'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);

    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Parse callback data
   *
   * @param data - Callback data string
   * @returns Parsed callback data
   */
  static parseCallbackData(data: string): Record<string, unknown> {
    try {
      return JSON.parse(data);
    } catch {
      // If not JSON, treat as simple string
      const parts = data.split(':');
      if (parts.length === 2) {
        return { action: parts[0], value: parts[1] };
      }

      return { action: data };
    }
  }

  /**
   * Create callback data
   *
   * @param data - Data object to encode
   * @returns Encoded callback data string
   */
  static createCallbackData(data: Record<string, unknown>): string {
    // Simple format for basic data
    if (Object.keys(data).length === 1 && data.action) {
      return String(data.action);
    }

    if (Object.keys(data).length === 2 && data.action && data.value) {
      return `${data.action}:${data.value}`;
    }

    // JSON format for complex data
    return JSON.stringify(data);
  }

  /**
   * Format timestamp
   *
   * @param timestamp - Unix timestamp
   * @param format - Format type
   * @returns Formatted timestamp string
   */
  static formatTimestamp(timestamp: number, format: 'short' | 'long' | 'relative' | 'iso' = 'short'): string {
    const date = new Date(timestamp * 1000);

    switch (format) {
      case 'short':
        return (
          date.toLocaleDateString() +
          ' ' +
          date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })
        );

      case 'long':
        return date.toLocaleDateString([], {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

      case 'relative':
        return this.getRelativeTime(timestamp);

      case 'iso':
        return date.toISOString();

      default:
        return date.toString();
    }
  }

  /**
   * Get relative time description
   *
   * @param timestamp - Unix timestamp
   * @returns Relative time string
   */
  static getRelativeTime(timestamp: number): string {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;

    if (diff < 60) {
      return 'just now';
    }

    if (diff < 3600) {
      const minutes = Math.floor(diff / 60);

      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    }

    if (diff < 86400) {
      const hours = Math.floor(diff / 3600);

      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }

    if (diff < 2592000) {
      const days = Math.floor(diff / 86400);

      return `${days} day${days !== 1 ? 's' : ''} ago`;
    }

    const months = Math.floor(diff / 2592000);

    return `${months} month${months !== 1 ? 's' : ''} ago`;
  }

  /**
   * Escape HTML characters
   *
   * @param text - Text to escape
   * @returns HTML escaped text
   */
  static escapeHTML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Escape Markdown characters
   *
   * @param text - Text to escape
   * @returns Markdown escaped text
   */
  static escapeMarkdown(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\*/g, '\\*')
      .replace(/_/g, '\\_')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/~/g, '\\~')
      .replace(/`/g, '\\`')
      .replace(/>/g, '\\>')
      .replace(/#/g, '\\#')
      .replace(/\+/g, '\\+')
      .replace(/-/g, '\\-')
      .replace(/=/g, '\\=')
      .replace(/\|/g, '\\|')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\./g, '\\.')
      .replace(/!/g, '\\!');
  }

  /**
   * Create mention link
   *
   * @param user - Bot user
   * @param displayName - Optional display name
   * @returns Mention link string
   */
  static createMentionLink(user: BotUser, displayName?: string): string {
    const name = displayName || this.extractUserDisplayName(user);

    return `[${name}](tg://user?id=${user.id})`;
  }

  /**
   * Create user profile link
   *
   * @param user - Bot user
   * @returns Profile link or null if no username
   */
  static createProfileLink(user: BotUser): string | null {
    if (!user.username) {
      return null;
    }

    return `https://t.me/${user.username}`;
  }

  /**
   * Apply custom template to user data
   *
   * @param user - Bot user
   * @param template - Template string with placeholders
   * @returns Formatted string
   */
  private static applyCustomTemplate(user: BotUser, template: string): string {
    return template
      .replace(/\{id\}/g, user.id.toString())
      .replace(/\{first_name\}/g, user.first_name)
      .replace(/\{last_name\}/g, user.last_name || '')
      .replace(/\{username\}/g, user.username || '')
      .replace(/\{language_code\}/g, user.language_code || '')
      .replace(/\{is_premium\}/g, user.is_premium ? 'premium' : 'regular');
  }

  /**
   * Get message type
   *
   * @param message - Bot message
   * @returns Message type
   */
  static getMessageType(message: BotMessage): string {
    if (message.text) {
      return 'text';
    }

    // Use type-safe property checking for extended message properties
    const extendedMessage = message as unknown as Record<string, unknown>;

    if (extendedMessage.photo) {
      return 'photo';
    }

    if (extendedMessage.video) {
      return 'video';
    }

    if (extendedMessage.audio) {
      return 'audio';
    }

    if (extendedMessage.voice) {
      return 'voice';
    }

    if (extendedMessage.document) {
      return 'document';
    }

    if (extendedMessage.sticker) {
      return 'sticker';
    }

    if (extendedMessage.location) {
      return 'location';
    }

    if (extendedMessage.contact) {
      return 'contact';
    }

    if (extendedMessage.poll) {
      return 'poll';
    }

    if (extendedMessage.dice) {
      return 'dice';
    }

    return 'unknown';
  }

  /**
   * Extract text from message
   *
   * @param message - Bot message
   * @returns Text content or null
   */
  static extractMessageText(message: BotMessage): string | null {
    if (message.text) {
      return message.text;
    }

    // Use type-safe property checking for caption
    const extendedMessage = message as unknown as Record<string, unknown>;
    if (typeof extendedMessage.caption === 'string') {
      return extendedMessage.caption;
    }

    return null;
  }

  /**
   * Check if message is command
   *
   * @param message - Bot message
   * @returns True if message is a command
   */
  static isCommand(message: BotMessage): boolean {
    return !!(message.text && message.text.startsWith('/'));
  }

  /**
   * Extract command from message
   *
   * @param message - Bot message
   * @returns Command name without / prefix
   */
  static extractCommand(message: BotMessage): string | null {
    if (!this.isCommand(message) || !message.text) {
      return null;
    }

    const parts = message.text.split(' ');

    return parts[0].substring(1).toLowerCase();
  }

  /**
   * Extract command arguments
   *
   * @param message - Bot message
   * @returns Array of command arguments
   */
  static extractCommandArgs(message: BotMessage): string[] {
    if (!this.isCommand(message) || !message.text) {
      return [];
    }

    const parts = message.text.split(' ');

    return parts.slice(1);
  }
}
