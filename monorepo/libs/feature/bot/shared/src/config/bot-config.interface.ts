/**
 * Bot Configuration Interface
 *
 * Defines the structure for bot configuration including connection settings,
 * middleware configuration, webhook settings, and feature flags.
 * This interface ensures type safety for bot initialization and deployment.
 *
 * @interface BotConfig
 */
export interface BotConfig {
  /** Bot token for Telegram API authentication */
  token: string;

  /** Bot username (without @) */
  username?: string;

  /** Bot display name */
  displayName?: string;

  /** Bot description */
  description?: string;

  /** Environment configuration */
  environment: BotEnvironment;

  /** Webhook configuration for production deployment */
  webhook?: BotWebhookConfig;

  /** Polling configuration for development */
  polling?: BotPollingConfig;

  /** Session management configuration */
  session?: BotSessionConfig;

  /** Rate limiting configuration */
  rateLimit?: BotRateLimitConfig;

  /** Logging configuration */
  logging?: BotLoggingConfig;

  /** Redis configuration for caching */
  redis?: BotRedisConfig;

  /** Database configuration for persistence */
  database?: BotDatabaseConfig;

  /** Feature flags for bot functionality */
  features?: BotFeatureFlags;

  /** Middleware configuration */
  middleware?: BotMiddlewareConfig;

  /** Security configuration */
  security?: BotSecurityConfig;

  /** Performance configuration */
  performance?: BotPerformanceConfig;

  /** Internationalization configuration */
  i18n?: BotI18nConfig;

  /** Analytics and tracking configuration */
  analytics?: BotAnalyticsConfig;
}

/**
 * Bot Environment Configuration
 *
 * Defines the deployment environment and related settings.
 */
export interface BotEnvironment {
  /** Environment name */
  name?: 'development' | 'staging' | 'production';

  /** Debug mode flag */
  debug?: boolean;

  /** Verbose logging flag */
  verbose?: boolean;

  /** API base URL */
  apiUrl?: string;

  /** Frontend base URL */
  frontendUrl?: string;

  /** Admin chat IDs for notifications */
  adminChatIds?: number[];

  /** Bot version */
  version?: string;
}

/**
 * Bot Webhook Configuration
 *
 * Configuration for webhook mode deployment.
 */
export interface BotWebhookConfig {
  /** Webhook URL endpoint */
  url: string;

  /** Secret token for webhook validation */
  secretToken?: string;

  /** Allowed IP addresses for webhook requests */
  allowedIps?: string[];

  /** Maximum number of connections */
  maxConnections?: number;

  /** Certificate for HTTPS */
  certificate?: string;

  /** Port for webhook server */
  port?: number;

  /** Path for webhook endpoint */
  path?: string;
}

/**
 * Bot Polling Configuration
 *
 * Configuration for polling mode development.
 */
export interface BotPollingConfig {
  /** Polling timeout in seconds */
  timeout?: number;

  /** Polling limit */
  limit?: number;

  /** Allowed updates */
  allowedUpdates?: string[];

  /** Drop pending updates */
  dropPendingUpdates?: boolean;
}

/**
 * Bot Session Configuration
 *
 * Configuration for session management.
 */
export interface BotSessionConfig {
  /** Session storage type */
  storage: 'memory' | 'redis' | 'database';

  /** Session timeout in seconds */
  timeout?: number;

  /** Session cleanup interval in seconds */
  cleanupInterval?: number;

  /** Maximum sessions per user */
  maxSessionsPerUser?: number;

  /** Session key prefix */
  keyPrefix?: string;

  /** Session encryption settings */
  encryption?: BotSessionEncryption;
}

/**
 * Bot Session Encryption Configuration
 */
export interface BotSessionEncryption {
  /** Encryption algorithm */
  algorithm: string;

  /** Encryption key */
  key: string;

  /** Initialization vector */
  iv?: string;
}

/**
 * Bot Rate Limiting Configuration
 *
 * Configuration for request rate limiting.
 */
export interface BotRateLimitConfig {
  /** Enable rate limiting */
  enabled: boolean;

  /** Requests per minute per user */
  requestsPerMinute: number;

  /** Burst capacity */
  burstCapacity?: number;

  /** Rate limit window in seconds */
  windowSize?: number;

  /** Storage for rate limit data */
  storage: 'memory' | 'redis';

  /** Skip rate limiting for admin users */
  skipAdmins?: boolean;

  /** Custom rate limits by command */
  customLimits?: Record<string, number>;
}

/**
 * Bot Logging Configuration
 *
 * Configuration for bot logging and monitoring.
 */
export interface BotLoggingConfig {
  /** Log level */
  level: 'debug' | 'info' | 'warn' | 'error';

  /** Log format */
  format: 'json' | 'text';

  /** Log to console */
  console: boolean;

  /** Log to file */
  file?: BotFileLoggingConfig;

  /** Log to external service */
  external?: BotExternalLoggingConfig;

  /** Include sensitive data in logs */
  includeSensitive?: boolean;

  /** Request correlation ID */
  correlation?: boolean;
}

/**
 * Bot File Logging Configuration
 */
export interface BotFileLoggingConfig {
  /** Log file path */
  path: string;

  /** Maximum file size in MB */
  maxSize?: number;

  /** Maximum number of log files */
  maxFiles?: number;

  /** Rotate logs daily */
  rotateDaily?: boolean;
}

/**
 * Bot External Logging Configuration
 */
export interface BotExternalLoggingConfig {
  /** Service type */
  type: 'elasticsearch' | 'datadog' | 'splunk' | 'custom';

  /** Service endpoint */
  endpoint: string;

  /** API key */
  apiKey?: string;

  /** Additional configuration */
  config?: Record<string, unknown>;
}

/**
 * Bot Redis Configuration
 *
 * Redis connection and caching configuration.
 */
export interface BotRedisConfig {
  /** Redis host */
  host: string;

  /** Redis port */
  port: number;

  /** Redis password */
  password?: string;

  /** Redis database number */
  database?: number;

  /** Connection timeout */
  connectTimeout?: number;

  /** Command timeout */
  commandTimeout?: number;

  /** Max retry attempts */
  maxRetries?: number;

  /** Key prefix for bot data */
  keyPrefix?: string;

  /** Enable cluster mode */
  cluster?: boolean;

  /** Cluster configuration */
  clusterConfig?: BotRedisClusterConfig;
}

/**
 * Bot Redis Cluster Configuration
 */
export interface BotRedisClusterConfig {
  /** Cluster nodes */
  nodes: Array<{ host: string; port: number }>;

  /** Enable readonly mode */
  enableReadyCheck?: boolean;

  /** Max redirections */
  maxRedirections?: number;
}

/**
 * Bot Database Configuration
 *
 * Database connection configuration for persistence.
 */
export interface BotDatabaseConfig {
  /** Database type */
  type: 'postgresql' | 'mysql' | 'sqlite' | 'mongodb';

  /** Connection URL */
  url?: string;

  /** Database host */
  host?: string;

  /** Database port */
  port?: number;

  /** Database name */
  database?: string;

  /** Database username */
  username?: string;

  /** Database password */
  password?: string;

  /** Enable SSL */
  ssl?: boolean;

  /** Connection pool configuration */
  pool?: BotDatabasePoolConfig;

  /** Migration settings */
  migrations?: BotDatabaseMigrationConfig;
}

/**
 * Bot Database Pool Configuration
 */
export interface BotDatabasePoolConfig {
  /** Minimum pool size */
  min: number;

  /** Maximum pool size */
  max: number;

  /** Connection timeout */
  timeout?: number;

  /** Idle timeout */
  idleTimeout?: number;
}

/**
 * Bot Database Migration Configuration
 */
export interface BotDatabaseMigrationConfig {
  /** Auto-run migrations */
  auto: boolean;

  /** Migration directory */
  directory?: string;

  /** Migration table name */
  tableName?: string;
}

/**
 * Bot Feature Flags
 *
 * Toggle features and experimental functionality.
 */
export interface BotFeatureFlags {
  /** Enable user registration */
  userRegistration?: boolean;

  /** Enable premium features */
  premiumFeatures?: boolean;

  /** Enable analytics tracking */
  analytics?: boolean;

  /** Enable A/B testing */
  abTesting?: boolean;

  /** Enable admin commands */
  adminCommands?: boolean;

  /** Enable inline queries */
  inlineQueries?: boolean;

  /** Enable web app features */
  webApp?: boolean;

  /** Enable payment processing */
  payments?: boolean;

  /** Enable file uploads */
  fileUploads?: boolean;

  /** Enable voice messages */
  voiceMessages?: boolean;

  /** Enable location sharing */
  locationSharing?: boolean;

  /** Enable group features */
  groupFeatures?: boolean;

  /** Enable channel features */
  channelFeatures?: boolean;

  /** Custom feature flags */
  custom?: Record<string, boolean>;
}

/**
 * Bot Middleware Configuration
 *
 * Configuration for bot middleware chain.
 */
export interface BotMiddlewareConfig {
  /** Enable authentication middleware */
  auth?: boolean;

  /** Enable rate limiting middleware */
  rateLimit?: boolean;

  /** Enable logging middleware */
  logging?: boolean;

  /** Enable error handling middleware */
  errorHandling?: boolean;

  /** Enable session middleware */
  session?: boolean;

  /** Enable analytics middleware */
  analytics?: boolean;

  /** Enable security middleware */
  security?: boolean;

  /** Enable performance monitoring middleware */
  performance?: boolean;

  /** Custom middleware configuration */
  custom?: Record<string, unknown>;
}

/**
 * Bot Security Configuration
 *
 * Security settings and validation rules.
 */
export interface BotSecurityConfig {
  /** Enable CSRF protection */
  csrf?: boolean;

  /** Enable XSS protection */
  xss?: boolean;

  /** Enable input validation */
  inputValidation?: boolean;

  /** Maximum message length */
  maxMessageLength?: number;

  /** Maximum file size in MB */
  maxFileSize?: number;

  /** Allowed file types */
  allowedFileTypes?: string[];

  /** Blocked words filter */
  wordFilter?: string[];

  /** Spam protection settings */
  spamProtection?: BotSpamProtectionConfig;

  /** Admin verification settings */
  adminVerification?: BotAdminVerificationConfig;
}

/**
 * Bot Spam Protection Configuration
 */
export interface BotSpamProtectionConfig {
  /** Enable spam detection */
  enabled: boolean;

  /** Maximum messages per minute */
  maxMessagesPerMinute: number;

  /** Duplicate message threshold */
  duplicateThreshold: number;

  /** Auto-ban for spam */
  autoBan?: boolean;

  /** Ban duration in minutes */
  banDuration?: number;
}

/**
 * Bot Admin Verification Configuration
 */
export interface BotAdminVerificationConfig {
  /** Require admin verification */
  required: boolean;

  /** Admin user IDs */
  adminIds: number[];

  /** Admin verification token */
  verificationToken?: string;

  /** Admin session timeout */
  sessionTimeout?: number;
}

/**
 * Bot Performance Configuration
 *
 * Performance optimization settings.
 */
export interface BotPerformanceConfig {
  /** Enable response caching */
  caching?: boolean;

  /** Cache TTL in seconds */
  cacheTtl?: number;

  /** Enable request batching */
  batching?: boolean;

  /** Batch size */
  batchSize?: number;

  /** Enable lazy loading */
  lazyLoading?: boolean;

  /** Memory usage limit in MB */
  memoryLimit?: number;

  /** CPU usage limit in percentage */
  cpuLimit?: number;

  /** Response timeout in seconds */
  responseTimeout?: number;
}

/**
 * Bot Internationalization Configuration
 *
 * Multi-language support settings.
 */
export interface BotI18nConfig {
  /** Default language */
  defaultLanguage: string;

  /** Supported languages */
  supportedLanguages: string[];

  /** Translation file directory */
  translationDirectory?: string;

  /** Enable auto-detection */
  autoDetect?: boolean;

  /** Fallback language */
  fallbackLanguage?: string;

  /** Translation cache settings */
  cache?: BotI18nCacheConfig;
}

/**
 * Bot I18n Cache Configuration
 */
export interface BotI18nCacheConfig {
  /** Enable translation caching */
  enabled: boolean;

  /** Cache TTL in seconds */
  ttl: number;

  /** Cache storage type */
  storage: 'memory' | 'redis';
}

/**
 * Bot Analytics Configuration
 *
 * Analytics and tracking settings.
 */
export interface BotAnalyticsConfig {
  /** Enable analytics */
  enabled: boolean;

  /** Analytics provider */
  provider: 'google' | 'mixpanel' | 'amplitude' | 'custom';

  /** Tracking ID */
  trackingId?: string;

  /** API key */
  apiKey?: string;

  /** Track user interactions */
  trackInteractions?: boolean;

  /** Track errors */
  trackErrors?: boolean;

  /** Track performance metrics */
  trackPerformance?: boolean;

  /** Custom event tracking */
  customEvents?: Record<string, boolean>;

  /** Data retention period in days */
  retentionPeriod?: number;

  /** Privacy settings */
  privacy?: BotAnalyticsPrivacyConfig;
}

/**
 * Bot Analytics Privacy Configuration
 */
export interface BotAnalyticsPrivacyConfig {
  /** Anonymize user data */
  anonymizeUsers: boolean;

  /** Anonymize IP addresses */
  anonymizeIps: boolean;

  /** Respect Do Not Track */
  respectDoNotTrack: boolean;

  /** Data export options */
  dataExport?: boolean;

  /** Data deletion options */
  dataDeletion?: boolean;
}

/**
 * Bot Configuration Validation Result
 *
 * Result of bot configuration validation.
 */
export interface BotConfigValidationResult {
  /** Validation success flag */
  isValid: boolean;

  /** Validation errors */
  errors: BotConfigValidationError[];

  /** Validation warnings */
  warnings: BotConfigValidationWarning[];
}

/**
 * Bot Configuration Validation Error
 */
export interface BotConfigValidationError {
  /** Error field path */
  field: string;

  /** Error message */
  message: string;

  /** Error code */
  code: string;

  /** Error severity */
  severity: 'error' | 'warning';
}

/**
 * Bot Configuration Validation Warning
 */
export interface BotConfigValidationWarning {
  /** Warning field path */
  field: string;

  /** Warning message */
  message: string;

  /** Warning code */
  code: string;

  /** Suggested value */
  suggestedValue?: unknown;
}
