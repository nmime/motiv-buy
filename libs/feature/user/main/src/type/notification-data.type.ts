/**
 * Notification settings data types
 */

export interface NotificationSettingsData {
  limitNotificationsEnabled: boolean;
  inactivityNotificationsEnabled: boolean;
}

export interface UpdateNotificationSettingsData {
  limitNotificationsEnabled?: boolean;
  inactivityNotificationsEnabled?: boolean;
}
