import { CallbackData } from '../type';

/**
 * Callback Utility
 *
 * Utility functions for handling callback query data.
 * Provides parsing, building, and validation of callback data strings.
 *
 * @class CallbackUtil
 */
export class CallbackUtil {
  /** Maximum callback data length (Telegram limit) */
  private static readonly MAX_CALLBACK_DATA_LENGTH = 64;

  /** Separator for callback data parts */
  private static readonly SEPARATOR = ':';

  /**
   * Build callback data string from object
   *
   * @param data - Callback data object
   * @returns Callback data string
   */
  static buildCallbackData(data: CallbackData): string {
    try {
      const { action, params = [], metadata } = data;
      let callbackString = action;

      // Add parameters
      if (params.length > 0) {
        callbackString += this.SEPARATOR + params.join(this.SEPARATOR);
      }

      // Add metadata if present and fits
      if (metadata && Object.keys(metadata).length > 0) {
        const metadataString = JSON.stringify(metadata);
        const testString = callbackString + this.SEPARATOR + metadataString;

        if (testString.length <= this.MAX_CALLBACK_DATA_LENGTH) {
          callbackString = testString;
        }
      }

      // Truncate if too long
      if (callbackString.length > this.MAX_CALLBACK_DATA_LENGTH) {
        callbackString = callbackString.substring(0, this.MAX_CALLBACK_DATA_LENGTH);
        // Ensure we don't cut in the middle of a parameter
        const lastSeparator = callbackString.lastIndexOf(this.SEPARATOR);
        if (lastSeparator > action.length) {
          callbackString = callbackString.substring(0, lastSeparator);
        }
      }

      return callbackString;
    } catch (error) {
      // Fallback to simple action if building fails
      return data.action;
    }
  }

  /**
   * Parse callback data string to object
   *
   * @param callbackString - Callback data string
   * @returns Parsed callback data object
   */
  static parseCallbackData(callbackString: string): CallbackData {
    try {
      // Handle JSON format
      if (callbackString.startsWith('{') && callbackString.endsWith('}')) {
        const parsed = JSON.parse(callbackString);

        return {
          action: parsed.action || 'unknown',
          params: parsed.params || [],
          metadata: parsed.metadata,
          timestamp: parsed.timestamp || Date.now(),
        };
      }

      // Handle delimited format
      const parts = callbackString.split(this.SEPARATOR);
      const action = parts[0] || 'unknown';
      const params = parts.slice(1);

      // Check if last parameter is JSON metadata
      let metadata: Record<string, unknown> | undefined;
      let actualParams = params;

      if (params.length > 0) {
        const lastParam = params[params.length - 1];
        try {
          if (lastParam.startsWith('{') && lastParam.endsWith('}')) {
            metadata = JSON.parse(lastParam);
            actualParams = params.slice(0, -1);
          }
        } catch {
          // Not JSON, keep as parameter
        }
      }

      return {
        action,
        params: actualParams,
        metadata,
        timestamp: Date.now(),
      };
    } catch (error) {
      // Return minimal valid object on error
      return {
        action: 'error',
        params: [],
        metadata: { originalData: callbackString, error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Validate callback data structure
   *
   * @param data - Callback data to validate
   * @returns Whether callback data is valid
   */
  static validateCallbackData(data: CallbackData): boolean {
    try {
      // Check required fields
      if (!data.action || typeof data.action !== 'string') {
        return false;
      }

      // Check action length
      if (data.action.length === 0 || data.action.length > 32) {
        return false;
      }

      // Check parameters
      if (data.params && !Array.isArray(data.params)) {
        return false;
      }

      // Check that parameters are strings
      if (data.params && !data.params.every((param) => typeof param === 'string')) {
        return false;
      }

      // Check metadata
      if (data.metadata && (typeof data.metadata !== 'object' || Array.isArray(data.metadata))) {
        return false;
      }

      // Check overall length when built
      const builtString = this.buildCallbackData(data);
      if (builtString.length > this.MAX_CALLBACK_DATA_LENGTH) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create action callback data
   *
   * @param action - Action identifier
   * @param params - Optional parameters
   * @returns Callback data string
   */
  static createActionCallback(action: string, ...params: string[]): string {
    return this.buildCallbackData({
      action,
      params,
      timestamp: Date.now(),
    });
  }

  /**
   * Create menu callback data
   *
   * @param menuId - Menu identifier
   * @param action - Menu action
   * @returns Callback data string
   */
  static createMenuCallback(menuId: string, action = 'navigate'): string {
    return this.buildCallbackData({
      action: 'menu',
      params: [menuId, action],
      timestamp: Date.now(),
    });
  }

  /**
   * Create pagination callback data
   *
   * @param page - Page number
   * @param action - Pagination action
   * @param context - Additional context
   * @returns Callback data string
   */
  static createPaginationCallback(page: number, action = 'goto', context?: string): string {
    const params = ['pagination', action, page.toString()];
    if (context) {
      params.push(context);
    }

    return this.buildCallbackData({
      action: 'page',
      params,
      timestamp: Date.now(),
    });
  }

  /**
   * Extract action from callback data string
   *
   * @param callbackString - Callback data string
   * @returns Action identifier
   */
  static extractAction(callbackString: string): string {
    const parsed = this.parseCallbackData(callbackString);

    return parsed.action;
  }

  /**
   * Extract parameters from callback data string
   *
   * @param callbackString - Callback data string
   * @returns Parameters array
   */
  static extractParams(callbackString: string): string[] {
    const parsed = this.parseCallbackData(callbackString);

    return parsed.params || [];
  }

  /**
   * Check if callback data represents a specific action
   *
   * @param callbackString - Callback data string
   * @param expectedAction - Expected action
   * @returns Whether callback matches action
   */
  static isAction(callbackString: string, expectedAction: string): boolean {
    const action = this.extractAction(callbackString);

    return action === expectedAction;
  }
}
