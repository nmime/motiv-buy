import { MenuConfig } from '../type';

interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

/**
 * Keyboard Utility
 *
 * Utility functions for creating and manipulating bot keyboards.
 * Provides helpers for inline keyboards, reply keyboards, and button layouts.
 *
 * @class KeyboardUtil
 */
export class KeyboardUtil {
  /**
   * Create inline keyboard from menu configuration
   *
   * @param menuConfig - Menu configuration object
   * @returns Inline keyboard markup
   */
  static createInlineKeyboard(menuConfig: MenuConfig): { inline_keyboard: InlineKeyboardButton[][] } {
    const inlineKeyboard = menuConfig.buttons.map((row) =>
      row.map((button) => ({
        text: button.text,
        callback_data: button.callbackData,
        url: button.url,
      })),
    );

    return {
      inline_keyboard: inlineKeyboard,
    };
  }

  /**
   * Create reply keyboard from buttons
   *
   * @param buttons - Array of button rows
   * @param options - Keyboard options
   * @returns Reply keyboard markup
   */
  static createReplyKeyboard(
    buttons: string[][],
    options: {
      resizeKeyboard?: boolean;
      oneTimeKeyboard?: boolean;
      selective?: boolean;
    } = {},
  ): { keyboard: { text: string }[][]; resize_keyboard: boolean; one_time_keyboard: boolean; selective: boolean } {
    const keyboard = buttons.map((row) => row.map((text) => ({ text })));

    return {
      keyboard,
      resize_keyboard: options.resizeKeyboard ?? true,
      one_time_keyboard: options.oneTimeKeyboard ?? false,
      selective: options.selective ?? false,
    };
  }

  /**
   * Create pagination keyboard
   *
   * @param currentPage - Current page number
   * @param totalPages - Total number of pages
   * @param baseCallbackData - Base callback data for pagination
   * @returns Inline keyboard with pagination controls
   */
  static createPaginationKeyboard(
    currentPage: number,
    totalPages: number,
    baseCallbackData: string,
  ): { inline_keyboard: InlineKeyboardButton[][] } {
    const buttons: InlineKeyboardButton[] = [];

    // Previous page button
    if (currentPage > 1) {
      buttons.push({
        text: '◀️ Previous',
        callback_data: `${baseCallbackData}:previous:${currentPage - 1}`,
      });
    }

    // Page indicator
    buttons.push({
      text: `${currentPage}/${totalPages}`,
      callback_data: 'page_info',
    });

    // Next page button
    if (currentPage < totalPages) {
      buttons.push({
        text: 'Next ▶️',
        callback_data: `${baseCallbackData}:next:${currentPage + 1}`,
      });
    }

    return {
      inline_keyboard: [buttons],
    };
  }

  /**
   * Create confirmation keyboard
   *
   * @param confirmCallback - Callback for confirm action
   * @param cancelCallback - Callback for cancel action
   * @param confirmText - Text for confirm button
   * @param cancelText - Text for cancel button
   * @returns Confirmation keyboard markup
   */
  static createConfirmationKeyboard(
    confirmCallback: string,
    cancelCallback: string,
    confirmText = '✅ Confirm',
    cancelText = '❌ Cancel',
  ): { inline_keyboard: InlineKeyboardButton[][] } {
    return {
      inline_keyboard: [
        [
          { text: confirmText, callback_data: confirmCallback },
          { text: cancelText, callback_data: cancelCallback },
        ],
      ],
    };
  }

  /**
   * Create numbered list keyboard
   *
   * @param items - Array of items
   * @param baseCallback - Base callback data
   * @param itemsPerRow - Number of items per row
   * @returns Keyboard with numbered items
   */
  static createNumberedListKeyboard(
    items: string[],
    baseCallback: string,
    itemsPerRow = 3,
  ): { inline_keyboard: InlineKeyboardButton[][] } {
    const buttons: InlineKeyboardButton[][] = [];
    let currentRow: InlineKeyboardButton[] = [];

    items.forEach((item, index) => {
      const number = index + 1;
      currentRow.push({
        text: `${number}. ${item}`,
        callback_data: `${baseCallback}:${index}`,
      });

      if (currentRow.length === itemsPerRow || index === items.length - 1) {
        buttons.push([...currentRow]);
        currentRow = [];
      }
    });

    return {
      inline_keyboard: buttons,
    };
  }

  /**
   * Remove keyboard markup
   *
   * @param selective - Whether removal is selective
   * @returns Remove keyboard markup
   */
  static removeKeyboard(selective = false): { remove_keyboard: boolean; selective: boolean } {
    return {
      remove_keyboard: true,
      selective,
    };
  }

  /**
   * Create back and home navigation keyboard
   *
   * @param backCallback - Back button callback
   * @param homeCallback - Home button callback
   * @param includeBack - Whether to include back button
   * @param includeHome - Whether to include home button
   * @returns Navigation keyboard
   */
  static createNavigationKeyboard(
    backCallback = 'back',
    homeCallback = 'menu:main',
    includeBack = true,
    includeHome = true,
  ): { inline_keyboard: InlineKeyboardButton[][] } {
    const buttons: InlineKeyboardButton[] = [];

    if (includeBack) {
      buttons.push({
        text: '◀️ Back',
        callback_data: backCallback,
      });
    }

    if (includeHome) {
      buttons.push({
        text: '🏠 Home',
        callback_data: homeCallback,
      });
    }

    return {
      inline_keyboard: buttons.length > 0 ? [buttons] : [],
    };
  }

  /**
   * Merge multiple keyboard markups
   *
   * @param keyboards - Array of keyboard markups to merge
   * @returns Merged keyboard markup
   */
  static mergeKeyboards(...keyboards: { inline_keyboard?: InlineKeyboardButton[][] }[]): {
    inline_keyboard: InlineKeyboardButton[][];
  } {
    const mergedButtons: InlineKeyboardButton[][] = [];

    keyboards.forEach((keyboard) => {
      if (keyboard?.inline_keyboard) {
        mergedButtons.push(...keyboard.inline_keyboard);
      }
    });

    return {
      inline_keyboard: mergedButtons,
    };
  }
}
