/**
 * API I18n Decorator
 *
 * Provides internationalization support for NestJS controllers.
 * Automatically injects I18nService with user's language from Accept-Language header.
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { FastifyRequest } from 'fastify';
import { defaultLanguage, Language } from '@app/common-shared';

/**
 * Check if language is supported
 *
 * @param langCode - Language code to check
 * @returns True if supported
 */
function isLanguageSupported(langCode: string): boolean {
  const supportedLanguages = Object.values(Language) as string[];

  return supportedLanguages.includes(langCode);
}

/**
 * Normalize language code to supported language
 *
 * @param langCode - Raw language code
 * @returns Normalized language code
 */
function normalizeLanguageCode(langCode: string): string {
  if (!langCode) {
    return defaultLanguage;
  }

  // Extract primary language code (before dash)
  const [primaryLang] = langCode.toLowerCase().split('-');

  // Check if supported
  if (isLanguageSupported(primaryLang)) {
    return primaryLang;
  }

  return defaultLanguage;
}

/**
 * Detect language from Accept-Language header
 *
 * Priority:
 * 1. Accept-Language header
 * 2. Default language
 *
 * @param request - Fastify request object
 * @returns Language code
 */
function detectLanguageFromRequest(request: FastifyRequest): string {
  const acceptLanguage = request.headers['accept-language'];

  if (!acceptLanguage) {
    return defaultLanguage;
  }

  // Parse Accept-Language header
  // Format: "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7"
  const languages = acceptLanguage
    .split(',')
    .map((lang) => {
      const [code, quality] = lang.trim().split(';');
      const q = quality ? parseFloat(quality.replace('q=', '')) : 1.0;

      return { code: code.trim(), quality: q };
    })
    .sort((a, b) => b.quality - a.quality);

  // Try each language until we find a supported one
  for (const { code } of languages) {
    const normalized = normalizeLanguageCode(code);
    if (isLanguageSupported(normalized)) {
      return normalized;
    }
  }

  return defaultLanguage;
}

/**
 * Extract I18nService from request
 *
 * NestJS injects services into the request context
 * We retrieve I18nService from there
 *
 * @param request - Fastify request object with i18nService
 * @returns I18nService instance
 */
function getI18nServiceFromRequest(request: FastifyRequest & { i18nService?: I18nService }): I18nService {
  // I18nService is available through nestjs-i18n resolver
  // It's injected into the request by AcceptLanguageResolver
  const { i18nService } = request;

  if (!i18nService) {
    throw new Error('I18nService not found in request. Ensure AppCommonIntlModule is imported.');
  }

  return i18nService;
}

/**
 * I18n Context for API routes
 *
 * Provides translation function that automatically uses
 * language from Accept-Language header
 */
export class ApiI18nContext {
  constructor(
    private readonly i18nService: I18nService,
    readonly language: string,
  ) {}

  /**
   * Translate a key using detected language
   *
   * @param key - Translation key (e.g., 'order.errors.invalid_link')
   * @param options - Optional parameters for interpolation
   * @returns Translated string
   *
   * @example
   * ```typescript
   * const message = i18n.t('order.success.order_created');
   * const error = i18n.t('order.errors.moderation_rejected', { reason: 'spam' });
   * ```
   */
  t(key: string, options?: Record<string, unknown>): string {
    return this.i18nService.t(key, {
      lang: this.language,
      args: options,
    });
  }

  /**
   * Translate with specific language (override detected language)
   *
   * @param key - Translation key
   * @param lang - Language code to use
   * @param options - Optional parameters
   * @returns Translated string
   */
  tWithLang(key: string, lang: string, options?: Record<string, unknown>): string {
    return this.i18nService.t(key, {
      lang: normalizeLanguageCode(lang),
      args: options,
    });
  }

  /**
   * Check if a translation key exists
   *
   * @param key - Translation key to check
   * @returns True if key exists
   */
  exists(key: string): boolean {
    try {
      const result = this.i18nService.t(key, { lang: this.language });

      return typeof result === 'string' && result !== key;
    } catch {
      return false;
    }
  }
}

/**
 * @I18n() - Parameter decorator for API routes
 *
 * Injects ApiI18nContext with translation function
 * Language is automatically detected from Accept-Language header
 *
 * @example
 * ```typescript
 * @Controller('orders')
 * export class OrderController {
 *   @Post()
 *   async createOrder(
 *     @I18n() i18n: ApiI18nContext,
 *     @Body() dto: CreateOrderDto,
 *   ) {
 *     // Use i18n.t() for translations
 *     const successMessage = i18n.t('order.success.order_created');
 *
 *     // Access user's language
 *     console.log('User language:', i18n.language);
 *
 *     return { message: successMessage };
 *   }
 *
 *   @Get(':id')
 *   async getOrder(
 *     @I18n() i18n: ApiI18nContext,
 *     @Param('id') id: string,
 *   ) {
 *     if (!order) {
 *       throw new NotFoundException(
 *         i18n.t('order.errors.channel_not_found')
 *       );
 *     }
 *     return order;
 *   }
 * }
 * ```
 */
export const I18n = createParamDecorator((_data: unknown, ctx: ExecutionContext): ApiI18nContext => {
  const request = ctx.switchToHttp().getRequest<FastifyRequest>();
  const i18nService = getI18nServiceFromRequest(request);

  // Detect language from Accept-Language header
  const language = detectLanguageFromRequest(request);

  return new ApiI18nContext(i18nService, language);
});

/**
 * @Lang() - Parameter decorator to get just the language code
 *
 * Simpler alternative to @I18n() when you only need the language
 *
 * @example
 * ```typescript
 * @Get('status')
 * async getStatus(@Lang() lang: string) {
 *   console.log('User language:', lang); // 'ru' or 'en'
 *   return { language: lang };
 * }
 * ```
 */
export const Lang = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<FastifyRequest>();

  return detectLanguageFromRequest(request);
});
