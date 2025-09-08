/**
 * Menu Type Enum
 * 
 * Defines all available menu types in the bot system.
 * Used for menu identification, navigation, and routing.
 * 
 * @enum MenuType
 */
export enum MenuType {
  /** Main menu - primary bot interface */
  Main = 'main',
  
  /** User profile management menu */
  Profile = 'profile',
  
  /** Settings and configuration menu */
  Settings = 'settings',
  
  /** Authentication and login menu */
  Auth = 'auth',
  
  /** Balance and financial operations menu */
  Balance = 'balance',
  
  /** Traffic statistics and analytics menu */
  Traffic = 'traffic',
  
  /** Statistics and reports menu */
  Statistics = 'statistics',
  
  /** Help and support menu */
  Help = 'help',
  
  /** Admin panel menu (restricted access) */
  Admin = 'admin',
  
  /** Campaign management menu */
  Campaign = 'campaign',
  
  /** Withdrawal and payout menu */
  Withdrawal = 'withdrawal',
  
  /** Referral system menu */
  Referral = 'referral',
  
  /** Notification preferences menu */
  Notifications = 'notifications',
  
  /** Account verification menu */
  Verification = 'verification',
  
  /** Error or fallback menu */
  Error = 'error',
}