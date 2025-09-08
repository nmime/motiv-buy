/**
 * Bot Command Enum
 * 
 * Defines all available bot commands that users can execute.
 * Maps to specific handlers and functionalities within the bot.
 * 
 * @enum BotCommand
 */
export enum BotCommand {
  /** Start command - initializes bot interaction */
  Start = 'start',
  
  /** Help command - displays help information */
  Help = 'help',
  
  /** Profile command - shows user profile */
  Profile = 'profile',
  
  /** Settings command - opens settings menu */
  Settings = 'settings',
  
  /** Balance command - displays user balance */
  Balance = 'balance',
  
  /** Stats command - shows user statistics */
  Stats = 'stats',
  
  /** Campaign command - campaign management */
  Campaign = 'campaign',
  
  /** Withdraw command - withdrawal operations */
  Withdraw = 'withdraw',
  
  /** Referral command - referral system */
  Referral = 'referral',
  
  /** Traffic command - traffic analytics */
  Traffic = 'traffic',
  
  /** Admin command - admin panel access */
  Admin = 'admin',
  
  /** Cancel command - cancels current operation */
  Cancel = 'cancel',
  
  /** Menu command - returns to main menu */
  Menu = 'menu',
  
  /** Support command - contact support */
  Support = 'support',
  
  /** Language command - change language */
  Language = 'language',
  
  /** Verify command - account verification */
  Verify = 'verify',
  
  /** Export command - data export */
  Export = 'export',
  
  /** Reset command - reset account data */
  Reset = 'reset',
  
  /** Status command - show account status */
  Status = 'status',
}