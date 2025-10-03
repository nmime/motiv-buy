import {
  BotContext,
  BotUser,
  BotChat,
  BotChatType,
  BotMessage,
  BotCallbackQuery,
  BotSessionData,
  BotStateData,
  BotUserData,
  BotMenuContext,
  BotContextMetadata,
} from '../type/bot-context.interface';

/**
 * Mock Telegram User Factory
 *
 * Factory for creating mock Telegram user objects for testing.
 */
export const MockTelegramUserFactory = {
  /**
   * Create a basic mock user
   */
  createBasic(overrides: Partial<BotUser> = {}): BotUser {
    return {
      id: 123456789,
      is_bot: false,
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser',
      language_code: 'en',
      ...overrides,
    };
  },

  /**
   * Create a premium user
   */
  createPremium(overrides: Partial<BotUser> = {}): BotUser {
    return this.createBasic({
      is_premium: true,
      added_to_attachment_menu: true,
      username: 'premiumuser',
      ...overrides,
    });
  },

  /**
   * Create a bot user
   */
  createBot(overrides: Partial<BotUser> = {}): BotUser {
    return this.createBasic({
      is_bot: true,
      username: 'testbot',
      first_name: 'Test',
      last_name: 'Bot',
      ...overrides,
    });
  },

  /**
   * Create user without username
   */
  createAnonymous(overrides: Partial<BotUser> = {}): BotUser {
    return this.createBasic({
      username: undefined,
      ...overrides,
    });
  },
};

/**
 * Mock Telegram Chat Factory
 *
 * Factory for creating mock Telegram chat objects for testing.
 */
export const MockTelegramChatFactory = {
  /**
   * Create a private chat
   */
  createPrivate(overrides: Partial<BotChat> = {}): BotChat {
    return {
      id: -987654321,
      type: BotChatType.Private,
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser',
      ...overrides,
    };
  },

  /**
   * Create a group chat
   */
  createGroup(overrides: Partial<BotChat> = {}): BotChat {
    return {
      id: -123456789,
      type: BotChatType.Group,
      title: 'Test Group',
      ...overrides,
    };
  },

  /**
   * Create a supergroup chat
   */
  createSupergroup(overrides: Partial<BotChat> = {}): BotChat {
    return {
      id: -999999999,
      type: BotChatType.Supergroup,
      title: 'Test Supergroup',
      username: 'testsupergroup',
      ...overrides,
    };
  },

  /**
   * Create a channel chat
   */
  createChannel(overrides: Partial<BotChat> = {}): BotChat {
    return {
      id: -111111111,
      type: BotChatType.Channel,
      title: 'Test Channel',
      username: 'testchannel',
      description: 'A test channel for unit testing',
      ...overrides,
    };
  },

  /**
   * Create a forum chat
   */
  createForum(overrides: Partial<BotChat> = {}): BotChat {
    return {
      id: -222222222,
      type: BotChatType.Supergroup,
      title: 'Test Forum',
      is_forum: true,
      ...overrides,
    };
  },
};

/**
 * Mock Telegram Message Factory
 *
 * Factory for creating mock Telegram message objects for testing.
 */
export const MockTelegramMessageFactory = {
  /**
   * Create a basic text message
   */
  createText(overrides: Partial<BotMessage> = {}): BotMessage {
    return {
      message_id: 12345,
      date: Math.floor(Date.now() / 1000),
      chat: MockTelegramChatFactory.createPrivate(),
      from: MockTelegramUserFactory.createBasic(),
      text: 'Test message',
      ...overrides,
    };
  },

  /**
   * Create a reply message
   */
  createReply(originalMessage: BotMessage, overrides: Partial<BotMessage> = {}): BotMessage {
    return this.createText({
      reply_to_message: originalMessage,
      text: 'Reply to test message',
      ...overrides,
    });
  },

  /**
   * Create a channel message
   */
  createChannelMessage(overrides: Partial<BotMessage> = {}): BotMessage {
    return this.createText({
      chat: MockTelegramChatFactory.createChannel(),
      from: undefined, // Channel messages might not have a from field
      author_signature: 'Test Author',
      ...overrides,
    });
  },

  /**
   * Create an edited message
   */
  createEdited(overrides: Partial<BotMessage> = {}): BotMessage {
    return this.createText({
      edit_date: Math.floor(Date.now() / 1000),
      text: 'Edited test message',
      ...overrides,
    });
  },

  /**
   * Create a forum topic message
   */
  createForumMessage(overrides: Partial<BotMessage> = {}): BotMessage {
    return this.createText({
      chat: MockTelegramChatFactory.createForum(),
      is_topic_message: true,
      message_thread_id: 42,
      ...overrides,
    });
  },
};

/**
 * Mock Callback Query Factory
 *
 * Factory for creating mock callback query objects for testing.
 */
export const MockCallbackQueryFactory = {
  /**
   * Create a basic callback query
   */
  createBasic(overrides: Partial<BotCallbackQuery> = {}): BotCallbackQuery {
    return {
      id: 'callback_123',
      from: MockTelegramUserFactory.createBasic(),
      chat_instance: 'chat_instance_123',
      data: 'test_callback_data',
      message: MockTelegramMessageFactory.createText(),
      ...overrides,
    };
  },

  /**
   * Create a callback query without message
   */
  createInline(overrides: Partial<BotCallbackQuery> = {}): BotCallbackQuery {
    return this.createBasic({
      message: undefined,
      inline_message_id: 'inline_msg_123',
      ...overrides,
    });
  },

  /**
   * Create a game callback query
   */
  createGame(overrides: Partial<BotCallbackQuery> = {}): BotCallbackQuery {
    return this.createBasic({
      data: undefined,
      game_short_name: 'test_game',
      ...overrides,
    });
  },
};

/**
 * Mock Bot Context Factory
 *
 * Factory for creating mock bot context objects for testing.
 */
export const MockBotContextFactory = {
  /**
   * Create a basic bot context
   */
  createBasic(overrides: Partial<BotContext> = {}): Partial<BotContext> {
    const mockUser = MockTelegramUserFactory.createBasic();
    const mockChat = MockTelegramChatFactory.createPrivate();

    return {
      from: mockUser,
      chat: mockChat,
      message: MockTelegramMessageFactory.createText({ from: mockUser, chat: mockChat }),
      isAuthenticated: false,
      userId: mockUser.id.toString(),
      session: {
        sessionId: 'session_123',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        conversationState: 'main_menu',
        menuHistory: [],
        formData: {},
        preferences: {},
        temp: {},
      } as BotSessionData,
      state: {
        currentMenu: 'main',
        isLoading: false,
        hasError: false,
        authStatus: 'guest',
        permissions: [],
        features: {},
        experiments: {},
      } as BotStateData,
      userData: {
        dbUserId: 'db_user_123',
        displayName: 'Test User',
        locale: 'en',
        timezone: 'UTC',
        isVerified: false,
        isPremium: false,
        role: 'user',
        balance: 0,
        createdAt: new Date(),
      } as BotUserData,
      menuContext: {
        currentMenu: 'main',
        menuParams: {},
        breadcrumb: ['main'],
        menuTimestamp: Date.now(),
        isModal: false,
      } as BotMenuContext,
      metadata: {
        requestId: 'req_123',
        timestamp: Date.now(),
        client: {
          platform: 'telegram',
          version: '1.0.0',
          language: 'en',
        },
        performance: {
          startTime: Date.now(),
          processingTime: 0,
          memoryUsage: 0,
        },
        debug: {},
        botVersion: '1.0.0',
        activeFeatures: [],
      } as BotContextMetadata,
      ...overrides,
    } as Partial<BotContext>;
  },

  /**
   * Create an authenticated bot context
   */
  createAuthenticated(overrides: Partial<BotContext> = {}): Partial<BotContext> {
    return this.createBasic({
      isAuthenticated: true,
      state: {
        authStatus: 'authenticated',
        permissions: ['read', 'write'],
        features: { premium: true },
      } as BotStateData,
      userData: {
        isVerified: true,
        isPremium: true,
        role: 'premium_user',
        balance: 1000,
      } as BotUserData,
      ...overrides,
    });
  },

  /**
   * Create a callback query context
   */
  createCallbackQuery(overrides: Partial<BotContext> = {}): Partial<BotContext> {
    return this.createBasic({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      callbackQuery: MockCallbackQueryFactory.createBasic() as any,
      ...overrides,
    });
  },

  /**
   * Create an admin context
   */
  createAdmin(overrides: Partial<BotContext> = {}): Partial<BotContext> {
    return this.createAuthenticated({
      state: {
        authStatus: 'authenticated',
        permissions: ['read', 'write', 'admin'],
        features: { admin: true, premium: true },
      } as BotStateData,
      userData: {
        isVerified: true,
        isPremium: true,
        role: 'admin',
        balance: 10000,
      } as BotUserData,
      ...overrides,
    });
  },
};

/**
 * Bot Test Utilities
 *
 * Collection of utility functions for bot testing.
 */
export const BotTestUtils = {
  /**
   * Create a mock reply function
   */
  createMockReply() {
    return jest.fn().mockResolvedValue({ message_id: 123 });
  },

  /**
   * Create a mock edit function
   */
  createMockEdit() {
    return jest.fn().mockResolvedValue({ message_id: 123 });
  },

  /**
   * Create a mock delete function
   */
  createMockDelete() {
    return jest.fn().mockResolvedValue(true);
  },

  /**
   * Create a mock answer callback query function
   */
  createMockAnswerCallbackQuery() {
    return jest.fn().mockResolvedValue(true);
  },

  /**
   * Create a complete mock context with all methods
   */
  createFullMockContext(overrides: Partial<BotContext> = {}): jest.Mocked<BotContext> {
    const context = MockBotContextFactory.createBasic(overrides) as jest.Mocked<BotContext>;

    context.reply = this.createMockReply();
    context.editMessageText = this.createMockEdit();
    context.deleteMessage = this.createMockDelete();
    context.answerCallbackQuery = this.createMockAnswerCallbackQuery();

    return context;
  },

  /**
   * Validate context structure
   */
  validateContext(context: Partial<BotContext>): boolean {
    return !!(context.from && context.chat && typeof context.userId === 'string');
  },

  /**
   * Create session data for testing
   */
  createSessionData(overrides: Partial<BotSessionData> = {}): BotSessionData {
    return {
      sessionId: 'test_session',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      conversationState: 'idle',
      menuHistory: [],
      formData: {},
      preferences: {},
      temp: {},
      ...overrides,
    };
  },
};
