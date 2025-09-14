import { MenuType } from '../enum';

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
  metadata?: Record<string, any>;
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
  metadata?: Record<string, any>;
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
  data?: Record<string, any>;
}
