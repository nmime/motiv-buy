/**
 * Order Feature Types
 *
 * Type definitions for the order creation and management feature
 */

/**
 * Order Creation Flow Steps
 */
export enum OrderFlowStep {
  /** A1: List of orders */
  OrderList = 'order_list',
  /** A2: Enter channel link */
  EnterChannelLink = 'enter_channel_link',
  /** A3: Add bot as admin */
  AddBotAdmin = 'add_bot_admin',
  /** A4: Moderation status */
  Moderation = 'moderation',
  /** A5: Detailed configuration */
  Configuration = 'configuration',
  /** A6: View created order */
  ViewOrder = 'view_order',
}

/**
 * Order Status
 */
export enum OrderStatus {
  /** Order is active and running */
  Active = 'active',
  /** Order is paused */
  Paused = 'paused',
  /** Order is on moderation */
  Moderation = 'moderation',
  /** Order is rejected by moderation */
  Rejected = 'rejected',
  /** Order is completed */
  Completed = 'completed',
  /** Order is deleted */
  Deleted = 'deleted',
}

/**
 * Order Display Location
 */
export enum OrderDisplayLocation {
  /** Show only in user's own bots */
  MyBotsOnly = 'my_bots_only',
  /** Show only in other bots */
  OtherBotsOnly = 'other_bots_only',
  /** Show in both own and other bots */
  Both = 'both',
}

/**
 * User Gender Filter
 */
export enum UserGender {
  Any = 'any',
  Male = 'male',
  Female = 'female',
}

/**
 * Age Range Filter
 */
export interface AgeRange {
  min: number;
  max: number;
}

/**
 * Target Audience Configuration
 */
export interface TargetAudience {
  /** Gender filter */
  gender: UserGender;
  /** Countries/regions */
  regions: string[];
  /** Preferred languages */
  languages: string[];
  /** Age range */
  ageRange?: AgeRange;
  /** Only active users (online in last 7 days) */
  activeOnly: boolean;
}

/**
 * Order Configuration
 */
export interface OrderConfiguration {
  /** Order name */
  name: string;
  /** Channel link */
  channelLink: string;
  /** Users per day */
  usersPerDay: number;
  /** Total users needed */
  totalUsers: number;
  /** Distribute throughout the day */
  distributeDaily: boolean;
  /** Account for unsubscribes */
  accountUnsubscribes: boolean;
  /** Target audience */
  targetAudience: TargetAudience;
  /** Price per subscriber (RUB) */
  pricePerSubscriber: number;
  /** Excluded topics/categories */
  excludedTopics: string[];
  /** Allowed traffic source categories (empty = all categories) */
  allowedCategories: string[];
  /** Start time (null = start now) */
  startTime: Date | null;
  /** Schedule (null = no schedule) */
  schedule: OrderSchedule | null;
  /** Display locations */
  displayLocation: OrderDisplayLocation;
}

/**
 * Order Schedule Configuration
 */
export interface OrderSchedule {
  /** Schedule type */
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  /** Days of week (for weekly, custom) */
  daysOfWeek?: number[];
  /** Time to run */
  time: string;
  /** End condition */
  endCondition: {
    /** Never end */
    never?: boolean;
    /** End after N repetitions */
    afterRepetitions?: number;
    /** End at specific date */
    endDate?: Date;
  };
}

/**
 * Channel Information
 */
export interface ChannelInfo {
  /** Channel ID */
  id: string;
  /** Channel title */
  title: string;
  /** Channel username */
  username?: string;
  /** Subscriber count */
  subscriberCount: number;
  /** Channel description */
  description?: string;
  /** Channel category */
  category?: string;
  /** Is bot admin in channel */
  botIsAdmin: boolean;
}

/**
 * Order Entity (Database model representation)
 */
export interface Order {
  /** Order ID */
  id: string;
  /** User ID who created the order */
  userId: string;
  /** Order configuration */
  config: OrderConfiguration;
  /** Channel information */
  channel: ChannelInfo;
  /** Order status */
  status: OrderStatus;
  /** Statistics */
  stats: OrderStatistics;
  /** Created at timestamp */
  createdAt: Date;
  /** Updated at timestamp */
  updatedAt: Date;
  /** Moderation timestamp */
  moderatedAt?: Date;
  /** Started at timestamp */
  startedAt?: Date;
  /** Completed at timestamp */
  completedAt?: Date;
}

/**
 * Order Statistics
 */
export interface OrderStatistics {
  /** Total subscribers gained */
  totalSubscribers: number;
  /** Subscribers gained today */
  subscribersToday: number;
  /** Conversion rate (percentage of subscribers that stayed) */
  conversionRate: number;
  /** Average price per subscriber */
  avgPrice: number;
  /** Total spent (RUB) */
  totalSpent: number;
  /** Unsubscribes count */
  unsubscribes: number;
  /** Daily statistics */
  dailyStats: DailyStats[];
}

/**
 * Daily Statistics
 */
export interface DailyStats {
  /** Date */
  date: string;
  /** Subscribers gained */
  subscribers: number;
  /** Unsubscribes */
  unsubscribes: number;
  /** Amount spent */
  spent: number;
  /** Conversion rate */
  conversionRate: number;
}

/**
 * Order Creation Origin - tracks where the order creation flow was initiated from
 */
export type OrderCreationOrigin = 'buy_traffic' | 'orders_list';

/**
 * Order Session State (temporary data during order creation)
 */
export interface OrderSessionState {
  /** Current step in the flow */
  currentStep: OrderFlowStep;
  /** Partial order configuration */
  config: Partial<OrderConfiguration>;
  /** Channel information (if validated) */
  channel?: ChannelInfo;
  /** Bot admin check status */
  botAdminCheckStatus?: 'pending' | 'confirmed' | 'skipped';
  /** Validation errors */
  errors?: string[];
  /** Timestamp when flow started */
  startedAt: Date;
  /** Where order creation was initiated from */
  origin?: OrderCreationOrigin;
}

/**
 * Available Topics/Categories for Exclusion
 */
export const availableTopics = [
  { id: 'games', name: '🎮 Игры', emoji: '🎮' },
  { id: 'casino', name: '💰 Казино и ставки', emoji: '💰' },
  { id: 'adult', name: '🔞 18+', emoji: '🔞' },
  { id: 'health', name: '💊 Здоровье и медицина', emoji: '💊' },
  { id: 'news', name: '📰 Новости и политика', emoji: '📰' },
  { id: 'ecommerce', name: '🛍️ Товары и услуги', emoji: '🛍️' },
  { id: 'education', name: '📚 Образование', emoji: '📚' },
  { id: 'business', name: '💼 Бизнес и финансы', emoji: '💼' },
] as const;

/**
 * Default Order Configuration
 */
export const defaultOrderConfig: Partial<OrderConfiguration> = {
  name: 'Без названия',
  usersPerDay: 100,
  totalUsers: 100,
  pricePerSubscriber: 2.5,
  distributeDaily: false,
  accountUnsubscribes: true,
  targetAudience: {
    gender: UserGender.Any,
    regions: [],
    languages: [],
    activeOnly: false,
  },
  excludedTopics: [],
  allowedCategories: [],
  startTime: null,
  schedule: null,
  displayLocation: OrderDisplayLocation.Both,
};
