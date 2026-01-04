/**
 * Session Interface
 *
 * Defines the structure for user session data in bot interactions.
 * Manages temporary state, user preferences, and session lifecycle.
 *
 * @interface SessionInterface
 */
export interface SessionInterface {
  /** Unique user identifier */
  userId: string;

  /** Session data payload */
  data: SessionData;

  /** Session creation timestamp */
  createdAt: Date;

  /** Session last update timestamp */
  updatedAt: Date;

  /** Session expiration timestamp */
  expiresAt: Date;

  /** Session metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Session Data Interface
 *
 * Contains the actual session data stored for users.
 */
export interface SessionData {
  /** Current conversation state */
  conversationState?: ConversationState;

  /** User preferences (allows partial updates) */
  preferences?: Partial<UserPreferences>;

  /** Temporary form data */
  formData?: Record<string, unknown>;

  /** Navigation state */
  navigationState?: NavigationState;

  /** Cache data */
  cache?: Record<string, unknown>;

  /** Custom session data */
  custom?: Record<string, unknown>;
}

/**
 * Conversation State Interface
 *
 * Tracks the current state of user conversation.
 */
export interface ConversationState {
  /** Current conversation step */
  currentStep: string;

  /** Available next steps */
  availableSteps?: string[];

  /** Conversation context */
  context: Record<string, unknown>;

  /** Whether conversation is active */
  isActive: boolean;

  /** Conversation start time */
  startedAt?: Date | string;
}

/**
 * User Preferences Interface
 *
 * User-specific preferences and settings.
 */
export interface UserPreferences {
  /** Preferred language */
  language: string;

  /** Notification settings */
  notifications: NotificationPreferences;

  /** Display preferences */
  display: DisplayPreferences;

  /** Privacy preferences */
  privacy: PrivacyPreferences;
}

/**
 * Notification Preferences Interface
 */
export interface NotificationPreferences {
  /** Enable push notifications */
  enablePush: boolean;

  /** Enable email notifications */
  enableEmail: boolean;

  /** Enable SMS notifications */
  enableSms: boolean;

  /** Notification categories */
  categories: Record<string, boolean>;
}

/**
 * Display Preferences Interface
 */
export interface DisplayPreferences {
  /** Theme preference */
  theme: 'light' | 'dark' | 'auto';

  /** Timezone */
  timezone: string;

  /** Date format */
  dateFormat: string;

  /** Number format */
  numberFormat: string;
}

/**
 * Privacy Preferences Interface
 */
export interface PrivacyPreferences {
  /** Share analytics data */
  shareAnalytics: boolean;

  /** Share usage data */
  shareUsageData: boolean;

  /** Allow data export */
  allowDataExport: boolean;
}

/**
 * Navigation State Interface
 *
 * Tracks user navigation within bot menus.
 */
export interface NavigationState {
  /** Current menu location */
  currentLocation: string;

  /** Navigation breadcrumb */
  breadcrumb: string[];

  /** Last visited locations */
  history: string[];

  /** Navigation metadata */
  metadata: Record<string, unknown>;
}
