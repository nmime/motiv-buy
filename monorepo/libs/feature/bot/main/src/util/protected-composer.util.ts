/**
 * Protected Composer Utility
 *
 * Provides utility functions to create Grammy composers with authentication
 * protection. Handlers registered through these utilities will automatically
 * block unauthenticated users.
 */

import { Composer } from 'grammy';
import { BotContext } from '@app/feature-bot-shared';

/**
 * Create a protected composer that requires authentication
 *
 * All handlers registered to this composer will automatically check
 * if ctx.user exists before execution. Unauthenticated requests are
 * blocked with an error message.
 *
 * @param errorMessage - Message to send to unauthenticated users
 * @returns Composer with auth protection
 *
 * @example
 * ```typescript
 * const profileComposer = createProtectedComposer();
 *
 * // These handlers will only run if user is authenticated
 * profileComposer.callbackQuery('profile:view', async (ctx) => {
 *   // ctx.user is guaranteed to exist here
 *   await showProfile(ctx.user);
 * });
 * ```
 */
export function createProtectedComposer(
  errorMessage = '🔐 Authentication required. Please use /start to register.',
): Composer<BotContext> {
  const composer = new Composer<BotContext>();

  // Add authentication guard middleware
  composer.use(async (ctx, next) => {
    if (!ctx.user || !ctx.isAuthenticated) {
      await ctx.reply(errorMessage);
      return;
    }

    await next();
  });

  return composer;
}

/**
 * Wrap a handler function with authentication check
 *
 * Use this to protect individual handlers without creating a protected composer.
 * Works with any Grammy context type.
 *
 * @param handler - The handler function to protect
 * @param errorMessage - Message to send to unauthenticated users
 * @returns Protected handler function
 *
 * @example
 * ```typescript
 * bot.callbackQuery('profile:view', protectHandler(async (ctx) => {
 *   // ctx.user is guaranteed to exist here
 *   await showProfile(ctx.user);
 * }));
 * ```
 */
export function protectHandler<T>(
  handler: (ctx: T) => Promise<void>,
  errorMessage = '🔐 Authentication required. Please use /start to register.',
): (ctx: T) => Promise<void> {
  return async (ctx: T) => {
    // Type guard to check if context has user property
    const botCtx = ctx as unknown as BotContext;

    if (!botCtx.user || !botCtx.isAuthenticated) {
      await botCtx.reply(errorMessage);
      return;
    }

    await handler(ctx);
  };
}
