import { Context, InlineKeyboard, SessionFlavor } from 'grammy';

/**
 * Bot Context Interface
 *
 * Extended Grammy context interface that defines the structure of the bot context object
 * containing message information, user data, session management, and bot interaction methods.
 * Fully compatible with Grammy framework's Context interface with additional bot-specific features.
 *
 * @interface BotContext
 * @extends Context
 */
export interface BotContext extends Context, SessionFlavor<BotSessionData> {
  /** Additional bot state information */
  state?: BotStateData;

  /** Authentication status */
  isAuthenticated?: boolean;

  /** User ID for quick access */
  userId?: string;

  /** User profile data */
  userData?: BotUserData;

  /** Current menu context */
  menuContext?: BotMenuContext;

  /** Request metadata */
  metadata?: BotContextMetadata;

  /** Reply with HTML formatted text */
  replyWithHTML(text: string, extra?: BotReplyExtra): Promise<BotMessage>;

  /** Reply with Markdown formatted text */
  replyWithMarkdown(text: string, extra?: BotReplyExtra): Promise<BotMessage>;
}

/**
 * Bot User Interface
 *
 * Represents a Telegram user in bot context with comprehensive user information.
 * Compatible with Grammy's User type.
 *
 * @interface BotUser
 */
export interface BotUser {
  /** Unique user identifier */
  id: number;

  /** Whether the user is a bot */
  is_bot: boolean;

  /** User's first name */
  first_name: string;

  /** User's last name (optional) */
  last_name?: string;

  /** User's username (optional) */
  username?: string;

  /** User's language code (optional) */
  language_code?: string;

  /** Whether the user is premium (optional) */
  is_premium?: true;

  /** Whether the user has been added to attachment menu (optional) */
  added_to_attachment_menu?: true;
}

/**
 * Bot Chat Interface
 *
 * Represents a Telegram chat in bot context with comprehensive chat information.
 * Compatible with Grammy's Chat type.
 *
 * @interface BotChat
 */
export interface BotChat {
  /** Unique chat identifier */
  id: number;

  /** Type of chat */
  type: BotChatType;

  /** Chat title (for groups, supergroups, and channels) */
  title?: string;

  /** Chat username (optional) */
  username?: string;

  /** First name of the other party in a private chat */
  first_name?: string;

  /** Last name of the other party in a private chat */
  last_name?: string;

  /** True if the chat is a forum (optional) */
  is_forum?: boolean;

  /** Chat photo (optional) */
  photo?: BotChatPhoto;

  /** True if privacy settings of the other party restrict sending voice/video notes (optional) */
  has_private_forwards?: boolean;

  /** True if the privacy settings of the other party restrict sending voice/video notes (optional) */
  has_restricted_voice_and_video_messages?: boolean;

  /** Description for groups, supergroups and channel chats (optional) */
  description?: string;

  /** Chat invite link (optional) */
  invite_link?: string;

  /** Pinned message (optional) */
  pinned_message?: BotMessage;
}

/**
 * Bot Chat Type Enum
 *
 * Represents different types of Telegram chats.
 */
export enum BotChatType {
  Private = 'private',
  Group = 'group',
  Supergroup = 'supergroup',
  Channel = 'channel',
}

/**
 * Bot Message Interface
 *
 * Represents a Telegram message in bot context.
 *
 * @interface BotMessage
 */
export interface BotMessage {
  /** Unique message identifier inside this chat */
  message_id: number;

  /** Date the message was sent in Unix time */
  date: number;

  /** Chat the message belongs to */
  chat: BotChat;

  /** Sender of the message (optional for channel messages) */
  from?: BotUser;

  /** Text content of the message (optional) */
  text?: string;

  /** Message entities like URLs, mentions, etc. (optional) */
  entities?: BotMessageEntity[];

  /** Information about the original message for replies (optional) */
  reply_to_message?: BotMessage;

  /** Signature of the post author for channel messages (optional) */
  author_signature?: string;

  /** Message edit date in Unix time (optional) */
  edit_date?: number;

  /** True if the message is sent to a forum topic */
  is_topic_message?: boolean;

  /** Unique identifier of a message thread to which the message belongs (optional) */
  message_thread_id?: number;

  /** Bot-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Bot Message Entity Interface
 *
 * Represents one special entity in a text message.
 */
export interface BotMessageEntity {
  /** Type of the entity */
  type: string;

  /** Offset in UTF-16 code units to the start of the entity */
  offset: number;

  /** Length of the entity in UTF-16 code units */
  length: number;

  /** URL for "text_link" type or user for "text_mention" type (optional) */
  url?: string;

  /** User for "text_mention" type (optional) */
  user?: BotUser;

  /** Programming language for "pre" type (optional) */
  language?: string;
}

/**
 * Bot Callback Query Interface
 *
 * Represents an incoming callback query from a callback button in an inline keyboard.
 *
 * @interface BotCallbackQuery
 */
export interface BotCallbackQuery {
  /** Unique identifier for this query */
  id: string;

  /** Sender */
  from: BotUser;

  /** Message with the callback button that originated the query (optional) */
  message?: BotMessage;

  /** Identifier of the message sent via the bot in inline mode (optional) */
  inline_message_id?: string;

  /** Global identifier, uniquely corresponding to the chat */
  chat_instance: string;

  /** Data associated with the callback button (optional) */
  data?: string;

  /** Short name of a Game to be returned (optional) */
  game_short_name?: string;
}

/**
 * Bot Chat Photo Interface
 *
 * Represents a chat photo.
 */
export interface BotChatPhoto {
  /** File identifier of small (160x160) chat photo */
  small_file_id: string;

  /** Unique file identifier of small (160x160) chat photo */
  small_file_unique_id: string;

  /** File identifier of big (640x640) chat photo */
  big_file_id: string;

  /** Unique file identifier of big (640x640) chat photo */
  big_file_unique_id: string;
}

/**
 * Bot Reply Extra Interface
 *
 * Additional options for reply methods.
 */
export interface BotReplyExtra {
  /** Send message silently */
  disable_notification?: boolean;

  /** Protects the contents of the sent message from forwarding and saving */
  protect_content?: boolean;

  /** If the message is a reply, ID of the original message */
  reply_to_message_id?: number;

  /** Pass True if the message should be sent even if the specified replied-to message is not found */
  allow_sending_without_reply?: boolean;

  /** Additional interface options */
  reply_markup?: InlineKeyboard | BotReplyMarkup;

  /** Message parse mode */
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';

  /** List of special entities that appear in message text */
  entities?: BotMessageEntity[];

  /** Disables link previews for links in this message */
  disable_web_page_preview?: boolean;
}

/**
 * Bot Edit Extra Interface
 *
 * Additional options for edit methods.
 */
export interface BotEditExtra {
  /** A JSON-serialized object for an inline keyboard */
  reply_markup?: InlineKeyboard | BotReplyMarkup;

  /** Message parse mode */
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';

  /** List of special entities that appear in message text */
  entities?: BotMessageEntity[];

  /** Disables link previews for links in this message */
  disable_web_page_preview?: boolean;
}

/**
 * Bot Callback Extra Interface
 *
 * Additional options for callback query answers.
 */
export interface BotCallbackExtra {
  /** If True, an alert will be shown by the client instead of a notification */
  show_alert?: boolean;

  /** URL that will be opened by the user's client */
  url?: string;

  /** The maximum amount of time in seconds that the result may be cached */
  cache_time?: number;
}

/**
 * Bot Reply Markup Interface
 *
 * Custom reply markup interface for keyboards.
 */
export interface BotReplyMarkup {
  /** Array of button rows, each represented by an Array of InlineKeyboardButton objects */
  inline_keyboard?: BotInlineKeyboardButton[][];

  /** Array of button rows, each represented by an Array of KeyboardButton objects */
  keyboard?: BotKeyboardButton[][];

  /** Requests clients to resize the keyboard vertically for optimal fit */
  resize_keyboard?: boolean;

  /** Requests clients to hide the keyboard as soon as it's been used */
  one_time_keyboard?: boolean;

  /** The placeholder to be shown in the input field when the keyboard is active */
  input_field_placeholder?: string;

  /** Use this parameter if you want to show the keyboard to specific users only */
  selective?: boolean;

  /** Requests clients to remove the custom keyboard */
  remove_keyboard?: boolean;
}

/**
 * Bot Inline Keyboard Button Interface
 */
export interface BotInlineKeyboardButton {
  /** Label text on the button */
  text: string;

  /** HTTP or tg:// URL to be opened when the button is pressed */
  url?: string;

  /** Data to be sent in a callback query to the bot when button is pressed */
  callback_data?: string;

  /** Description of the Web App that will be launched when the user presses the button */
  web_app?: BotWebApp;

  /** An HTTPS URL used to automatically authorize the user */
  login_url?: BotLoginUrl;

  /** If set, pressing the button will prompt the user to select one of their chats */
  switch_inline_query?: string;

  /** If set, pressing the button will insert the bot's username and the specified inline query */
  switch_inline_query_current_chat?: string;

  /** Description of the game that will be launched when the user presses the button */
  // eslint-disable-next-line @typescript-eslint/no-restricted-types
  callback_game?: object;

  /** Specify True, to send a Pay button */
  pay?: boolean;
}

/**
 * Bot Keyboard Button Interface
 */
export interface BotKeyboardButton {
  /** Text of the button */
  text: string;

  /** If True, the user's phone number will be sent as a contact when the button is pressed */
  request_contact?: boolean;

  /** If True, the user's current location will be sent when the button is pressed */
  request_location?: boolean;

  /** If specified, the user will be asked to create a poll and send it to the bot */
  request_poll?: BotKeyboardButtonPollType;

  /** If specified, the described Web App will be launched when the button is pressed */
  web_app?: BotWebApp;
}

/**
 * Bot Web App Interface
 */
export interface BotWebApp {
  /** An HTTPS URL of a Web App to be opened */
  url: string;
}

/**
 * Bot Login URL Interface
 */
export interface BotLoginUrl {
  /** An HTTPS URL to be opened */
  url: string;

  /** New text of the button in forwarded messages */
  forward_text?: string;

  /** Username of a bot, which will be used for user authorization */
  bot_username?: string;

  /** Pass True to request the permission for your bot to send messages to the user */
  request_write_access?: boolean;
}

/**
 * Bot Keyboard Button Poll Type Interface
 */
export interface BotKeyboardButtonPollType {
  /** If quiz is passed, the user will be allowed to create only polls in the quiz mode */
  type?: string;
}

/**
 * Bot Session Data Interface
 *
 * Extended session data structure for bot interactions.
 */
export interface BotSessionData extends Record<string, unknown> {
  /** User session ID */
  sessionId?: string;

  /** Session creation timestamp */
  createdAt?: number;

  /** Last activity timestamp */
  lastActivity?: number;

  /** Current conversation state */
  conversationState?: string;

  /** Menu navigation history */
  menuHistory?: string[];

  /** Form data in progress */
  formData?: Record<string, unknown>;

  /** Cached user preferences */
  preferences?: Record<string, unknown>;

  /** Temporary data */
  temp?: Record<string, unknown>;
}

/**
 * Bot State Data Interface
 *
 * Additional state information for bot context.
 */
export interface BotStateData {
  /** Telegram user ID */
  id?: string;

  /** User's first name */
  firstName?: string;

  /** User's last name */
  lastName?: string;

  /** User's username */
  username?: string;

  /** User's language code */
  languageCode?: string;

  /** Current menu state */
  currentMenu?: string;

  /** Loading states */
  isLoading?: boolean;

  /** Error states */
  hasError?: boolean;
  errorMessage?: string;

  /** Authentication state */
  authStatus?: 'authenticated' | 'pending' | 'failed' | 'guest';

  /** User permissions */
  permissions?: string[];

  /** Feature flags */
  features?: Record<string, boolean>;

  /** A/B test variants */
  experiments?: Record<string, string>;
}

/**
 * Bot User Data Interface
 *
 * Extended user profile information.
 */
export interface BotUserData {
  /** Database user ID */
  dbUserId?: string;

  /** User display name */
  displayName?: string;

  /** User email */
  email?: string;

  /** User phone number */
  phone?: string;

  /** User locale */
  locale?: string;

  /** User timezone */
  timezone?: string;

  /** Account verification status */
  isVerified?: boolean;

  /** Premium status */
  isPremium?: boolean;

  /** User role */
  role?: string;

  /** User balance */
  balance?: number;

  /** Last login timestamp */
  lastLogin?: Date;

  /** Account creation timestamp */
  createdAt?: Date;
}

/**
 * Bot Menu Context Interface
 *
 * Current menu context information.
 */
export interface BotMenuContext {
  /** Current menu type */
  currentMenu?: string;

  /** Menu parameters */
  menuParams?: Record<string, unknown>;

  /** Menu breadcrumb */
  breadcrumb?: string[];

  /** Previous menu for back navigation */
  previousMenu?: string;

  /** Menu timestamp */
  menuTimestamp?: number;

  /** Whether menu is modal */
  isModal?: boolean;
}

/**
 * Bot Context Metadata Interface
 *
 * Request and context metadata.
 */
export interface BotContextMetadata {
  /** Request ID for tracking */
  requestId?: string;

  /** Request timestamp */
  timestamp?: number;

  /** Client information */
  client?: {
    platform?: string;
    version?: string;
    language?: string;
  };

  /** Performance metrics */
  performance?: {
    startTime?: number;
    processingTime?: number;
    memoryUsage?: number;
  };

  /** Debug information */
  debug?: Record<string, unknown>;

  /** Bot version */
  botVersion?: string;

  /** Feature flags active for this request */
  activeFeatures?: string[];
}
