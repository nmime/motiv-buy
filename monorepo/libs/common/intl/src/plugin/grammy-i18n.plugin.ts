/**
 * Grammy I18n Plugin
 *
 * Provides internationalization support for Grammy bot contexts.
 * Automatically adds `t()` function and `language` property to context.
 * Language is determined from session or Telegram user language_code.
 */

import { Context, MiddlewareFn } from 'grammy';
import { I18nService } from 'nestjs-i18n';
import { defaultLanguage, Language } from '@app/common-shared';

/**
 * Session interface with language support
 */
export interface I18nSessionFlavor {
  session?: {
    language?: string;
    [key: string]: any;
  };
}

/**
 * Context with i18n support
 */
export interface I18nContextFlavor {
  /**
   * Current user's language code
   */
  language: string;

  /**
   * Translate a key using user's language
   * @param key - Translation key (e.g., 'order.main_menu.title')
   * @param options - Optional parameters for interpolation
   */
  t(key: string, options?: Record<string, any>): string;
}

/**
 * Create Grammy i18n middleware
 *
 * This middleware:
 * 1. Detects user language from session or Telegram profile
 * 2. Stores language in session for persistence
 * 3. Adds `t()` translation function to context
 * 4. Adds `language` property to context
 *
 * @param i18nService - NestJS I18nService instance
 * @returns Grammy middleware function
 *
 * @example
 * ```typescript
 * // In BotService
 * const i18nMiddleware = createGrammyI18nMiddleware(this.i18nService);
 * bot.use(i18nMiddleware);
 *
 * // In handlers
 * bot.command('start', (ctx) => {
 *   const message = ctx.t('order.main_menu.title');
 *   ctx.reply(message);
 * });
 * ```
 */
export function createGrammyI18nMiddleware<C extends Context & I18nSessionFlavor>(
  i18nService: I18nService,
): MiddlewareFn<C & I18nContextFlavor> {
  return async (ctx: C & I18nContextFlavor, next) => {
    // Detect user language
    const userLanguage = detectUserLanguage(ctx);

    // Store in session if session is available
    if (ctx.session) {
      ctx.session.language = userLanguage;
    }

    // Add language property to context
    ctx.language = userLanguage;

    // Add translation function to context
    ctx.t = (key: string, options?: Record<string, any>) => {
      return i18nService.t(key, {
        lang: ctx.language,
        args: options,
      });
    };

    // Continue to next middleware
    await next();
  };
}

/**
 * Detect user language from context
 *
 * Priority:
 * 1. Session language (if user explicitly set it)
 * 2. Telegram user language_code
 * 3. Default language (from config)
 *
 * @param ctx - Grammy context
 * @returns Language code (e.g., 'ru', 'en')
 */
function detectUserLanguage<C extends Context & I18nSessionFlavor>(ctx: C): string {
  // 1. Check session language
  if (ctx.session?.language) {
    return normalizeLanguageCode(ctx.session.language);
  }

  // 2. Check Telegram user language
  if (ctx.from?.language_code) {
    const lang = normalizeLanguageCode(ctx.from.language_code);

    return lang;
  }

  // 3. Return default language
  return defaultLanguage;
}

/**
 * Normalize language code to supported language
 *
 * Maps language codes to supported languages:
 * - ru, ru-RU -> ru
 * - en, en-US, en-GB -> en
 * - etc.
 *
 * @param langCode - Raw language code
 * @returns Normalized language code
 */
function normalizeLanguageCode(langCode: string): string {
  if (!langCode) {
    return defaultLanguage;
  }

  // Extract primary language code (before dash)
  const primaryLang = langCode.toLowerCase().split('-')[0];

  // Check if supported
  const supportedLanguages = Object.values(Language) as string[];
  if (supportedLanguages.includes(primaryLang)) {
    return primaryLang;
  }

  // Return default if not supported
  return defaultLanguage;
}

/**
 * Helper: Change user language
 *
 * Updates session language and returns confirmation message
 *
 * @param ctx - Grammy context with session
 * @param newLanguage - New language code
 * @returns Success boolean
 *
 * @example
 * ```typescript
 * bot.command('lang_ru', (ctx) => {
 *   const success = changeUserLanguage(ctx, 'ru');
 *   ctx.reply(success ? '✅ Язык изменён на русский' : '❌ Ошибка');
 * });
 * ```
 */
export function changeUserLanguage<C extends Context & I18nSessionFlavor>(ctx: C, newLanguage: string): boolean {
  const normalizedLang = normalizeLanguageCode(newLanguage);

  if (!ctx.session) {
    return false;
  }

  ctx.session.language = normalizedLang;

  // Update context language if available
  if ('language' in ctx) {
    (ctx as any).language = normalizedLang;
  }

  return true;
}

/**
 * Helper: Get supported languages list
 *
 * @returns Array of supported language codes
 */
export function getSupportedLanguages(): string[] {
  return Object.values(Language) as string[];
}

/**
 * Helper: Check if language is supported
 *
 * @param langCode - Language code to check
 * @returns True if language is supported
 */
export function isLanguageSupported(langCode: string): boolean {
  const normalized = normalizeLanguageCode(langCode);

  return getSupportedLanguages().includes(normalized);
}
