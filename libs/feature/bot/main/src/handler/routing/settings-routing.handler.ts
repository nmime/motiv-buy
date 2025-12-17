/**
 * Settings Routing Handler
 *
 * Handles routing for settings-related callback queries.
 * Extracted from CallbackRouterHandler to reduce file size.
 */

import { Injectable } from '@nestjs/common';
import { BotContext, AuthenticatedBotContext, isAuthenticated } from '@app/feature-bot-shared';
import { SettingsActionHandler } from '../settings-action.handler';
import { MiscMenuHandler } from '../menu';
import { MessageService } from '../../service/message.service';

type SettingsParamsHandler = (ctx: BotContext, params: string[]) => Promise<void>;

@Injectable()
export class SettingsRoutingHandler {
  private settingsActionHandlers!: Map<string, SettingsParamsHandler>;

  constructor(
    private readonly settingsHandler: SettingsActionHandler,
    private readonly menuHandler2: MiscMenuHandler,
    private readonly messageService: MessageService,
  ) {
    this.initializeHandlers();
  }

  private initializeHandlers(): void {
    this.settingsActionHandlers = new Map([
      [
        'language',
        this.withAuthParams(async (ctx, params) => {
          if (params.length > 0) {
            await this.settingsHandler.handleLanguageChange(ctx, params[0]);
          } else {
            await this.settingsHandler.handleLanguageSettings(ctx);
          }
        }),
      ],
      [
        'lang',
        this.withAuthParams(async (ctx, params) => {
          if (params.length > 0) {
            await this.settingsHandler.handleLanguageChange(ctx, params[0]);
          }
        }),
      ],
      ['notifications', this.withAuthParams((ctx) => this.settingsHandler.handleNotificationSettings(ctx))],
      [
        'notify',
        this.withAuthParams(async (ctx, params) => {
          if (params.length > 0) {
            await this.settingsHandler.handleNotificationToggle(ctx, params[0]);
          }
        }),
      ],
      ['preferences', this.withAuthParams((ctx) => this.settingsHandler.handlePreferencesSettings(ctx))],
      [
        'privacy',
        this.withAuthParams(async (ctx, params) => {
          if (params.length > 0 && params[0]) {
            await this.settingsHandler.handlePrivacyToggle(ctx, params[0]);
          } else {
            await this.settingsHandler.handlePrivacySettings(ctx);
          }
        }),
      ],
      ['theme', this.withAuthParams((ctx) => this.settingsHandler.handleThemeSettings(ctx))],
      ['export', this.withAuthParams((ctx) => this.menuHandler2.handleExportMenu(ctx))],
      ['reset', this.withAuthParams((ctx) => this.menuHandler2.handleResetMenu(ctx))],
    ]);
  }

  /**
   * Route settings actions
   */
  async routeSettingsAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    const handler = this.settingsActionHandlers.get(action);

    if (handler) {
      await handler(ctx, params);
    } else if (isAuthenticated(ctx)) {
      await this.settingsHandler.handleSettingsView(ctx);
    } else {
      await this.sendAuthRequired(ctx);
    }
  }

  private withAuthParams(
    handler: (ctx: AuthenticatedBotContext, params: string[]) => Promise<void>,
  ): (ctx: BotContext, params: string[]) => Promise<void> {
    return async (ctx: BotContext, params: string[]) => {
      if (!isAuthenticated(ctx)) {
        await this.sendAuthRequired(ctx);

        return;
      }

      await handler(ctx, params);
    };
  }

  private async sendAuthRequired(ctx: BotContext): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('common.errors.authentication_required'),
    });
  }
}
