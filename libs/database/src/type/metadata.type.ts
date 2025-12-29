// Metadata types to replace Record<string, any>

export interface TrafficActionData {
  parameters?: unknown[];
  result?: unknown;
  errorMessage?: string;
  duration?: number;
  [key: string]: unknown;
}

export interface UserBalanceMetadata {
  transactionId?: string;
  source?: string;
  reason?: string;
  originalAmount?: number;
  exchangeRate?: number;
  [key: string]: unknown;
}

export interface TrafficOrderRequirements {
  minAge?: number;
  maxAge?: number;
  countries?: string[];
  languages?: string[];
  devices?: string[];
  targetAudience?: string;
  restrictions?: string[];
  /** Allowed traffic source categories (empty = all categories allowed) */
  allowedCategories?: string[];
  [key: string]: unknown;
}

export interface TrafficTargetConfig {
  apiKey?: string;
  webhookUrl?: string;
  maxConcurrentOrders?: number;
  paymentMethods?: string[];
  autoApproval?: boolean;
  [key: string]: unknown;
}

export interface TrafficSourceConfig {
  apiEndpoint?: string;
  authToken?: string;
  rateLimits?: {
    perMinute?: number;
    perHour?: number;
    perDay?: number;
  };
  categories?: string[];
  [key: string]: unknown;
}

export interface TrafficSourceCategoryMetadata {
  displayName?: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
  isActive?: boolean;
  [key: string]: unknown;
}

export interface UserTrafficPermissions {
  canCreateOrders?: boolean;
  canModifyOrders?: boolean;
  canViewAnalytics?: boolean;
  canAccessAdmin?: boolean;
  maxOrderValue?: number;
  allowedCategories?: string[];
  [key: string]: unknown;
}

export interface UserTrafficTargetPermissions {
  canCreateCampaigns?: boolean;
  canViewReports?: boolean;
  canManagePayments?: boolean;
  maxBudget?: number;
  allowedRegions?: string[];
  [key: string]: unknown;
}

export interface TrafficTargetSourceContract {
  commissionRate?: number;
  paymentTerms?: string;
  minimumVolume?: number;
  exclusivity?: boolean;
  startDate?: string;
  endDate?: string;
  [key: string]: unknown;
}

export interface GenericMetadata {
  [key: string]: unknown;
}
