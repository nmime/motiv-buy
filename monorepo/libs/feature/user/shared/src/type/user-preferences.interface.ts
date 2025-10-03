/**
 * User Preferences Interface
 *
 * Defines user-specific preferences and settings across the application.
 * This interface is used for consistent user preference management.
 *
 * @interface UserPreferences
 */
export interface UserPreferences {
  /** Preferred language code (e.g., 'en', 'ru', 'es') */
  language: string;

  /** Notification preferences */
  notifications: NotificationPreferences;

  /** Display preferences */
  display: DisplayPreferences;

  /** Privacy preferences */
  privacy: PrivacyPreferences;
}

/**
 * Notification Preferences
 *
 * Controls user notification settings across different channels.
 */
export interface NotificationPreferences {
  /** Enable push notifications */
  enablePush: boolean;

  /** Enable email notifications */
  enableEmail: boolean;

  /** Enable SMS notifications */
  enableSms: boolean;

  /** Notification categories and their enabled status */
  categories: Record<string, boolean>;
}

/**
 * Display Preferences
 *
 * Controls UI/UX display settings.
 */
export interface DisplayPreferences {
  /** Theme preference (light, dark, or system) */
  theme?: 'light' | 'dark' | 'auto';

  /** Preferred currency code */
  currency?: string;

  /** Timezone (IANA timezone identifier) */
  timezone?: string;

  /** Date format preference */
  dateFormat?: string;
}

/**
 * Privacy Preferences
 *
 * Controls user privacy and data sharing settings.
 */
export interface PrivacyPreferences {
  /** Allow profile to be shared publicly */
  shareProfile?: boolean;

  /** Show user activity to others */
  showActivity?: boolean;

  /** Allow analytics tracking */
  shareAnalytics?: boolean;

  /** Allow usage data collection */
  shareUsageData?: boolean;
}
