import {
  NotificationButton,
  NotificationContentType,
  NotificationMedia,
  PollConfig,
  LocationConfig,
  ContactConfig,
  VenueConfig,
  ForwardConfig,
} from '@app/database';

export interface NotificationContent {
  contentType: NotificationContentType;
  text?: string;
  media?: NotificationMedia | NotificationMedia[];
  buttons?: NotificationButton[][];
  pollConfig?: PollConfig;
  locationConfig?: LocationConfig;
  contactConfig?: ContactConfig;
  venueConfig?: VenueConfig;
  forwardConfig?: ForwardConfig;
  extra?: Record<string, unknown>;
}

export interface BuildNotificationOptions {
  templateCode: string;
  locale: string;
  variables?: Record<string, string | number>;
  userContext?: {
    name?: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    [key: string]: unknown;
  };
}

export interface NotificationResult extends NotificationContent {
  isPersonal: boolean;
}
