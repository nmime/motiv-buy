import { MenuType } from '../enum';

/**
 * Menu Configuration Metadata Interface
 *
 * Defines metadata properties for menu configuration.
 */
export interface MenuConfigMetadata {
  /** Custom back button text */
  backText?: string;

  /** Custom home button text */
  homeText?: string;

  /** Custom breadcrumb/path button text */
  pathText?: string;

  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * Menu Button Metadata Interface
 *
 * Defines metadata properties for menu buttons.
 */
export interface MenuButtonMetadata {
  /** Navigation action type */
  action?: string;

  /** Navigation type */
  type?: string;

  /** Feature flag for permission checks */
  feature?: string;

  /** Premium tier requirement */
  tier?: string;

  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * Menu Configuration Interface
 *
 * Defines the structure for bot menu configurations including
 * buttons, layout, and menu metadata.
 *
 * @interface MenuConfig
 */
export interface MenuConfig {
  /** Menu type identifier */
  type: MenuType;

  /** Menu title/header */
  title: string;

  /** Menu button configuration */
  buttons: MenuButton[][];

  /** Whether menu uses inline keyboard */
  isInline: boolean;

  /** Optional menu description */
  description?: string;

  /** Menu metadata */
  metadata?: MenuConfigMetadata;
}

/**
 * Menu Button Interface
 *
 * Defines individual button configuration within menus.
 */
export interface MenuButton {
  /** Button display text */
  text: string;

  /** Callback data sent when button is pressed */
  callbackData: string;

  /** Optional URL for URL buttons */
  url?: string;

  /** Whether button is disabled */
  disabled?: boolean;

  /** Button metadata */
  metadata?: MenuButtonMetadata;
}

/**
 * Menu Navigation Interface
 *
 * Defines navigation state and history for menu systems.
 */
export interface MenuNavigation {
  /** Current active menu */
  currentMenu: MenuType;

  /** Menu navigation history */
  history: MenuType[];

  /** Maximum history length */
  maxHistoryLength: number;

  /** Whether back navigation is available */
  canGoBack: boolean;
}

/**
 * Menu Action Result Interface
 *
 * Result of menu action processing.
 */
export interface MenuActionResult {
  /** Whether action was successful */
  success: boolean;

  /** Action result message */
  message?: string;

  /** Next menu to navigate to */
  nextMenu?: MenuType;

  /** Whether to close current menu */
  closeMenu?: boolean;

  /** Additional result data */
  data?: Record<string, unknown>;
}
