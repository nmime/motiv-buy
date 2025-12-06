/**
 * Admin Action Handler
 *
 * Handles admin-related actions including admin menu and system management.
 */

import { Injectable, Logger } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/core';
import { InlineKeyboard } from 'grammy';
import { BotContext, AuthenticatedBotContext } from '@app/feature-bot-shared';
import {
  UserEntity,
  UserRole,
  UserStatus,
  TrafficSourceEntity,
  TrafficOrderEntity,
  TrafficOrderStatus,
} from '@app/database';
import { MessageService } from '../../service/message.service';
import { MenuActionHandler } from '../menu-action.handler';

@Injectable()
export class AdminHandler {
  private readonly logger = new Logger(AdminHandler.name);

  constructor(
    private readonly orm: MikroORM,
    private readonly messageService: MessageService,
    private readonly menuHandler: MenuActionHandler,
  ) {}

  /**
   * Get a forked EntityManager for context-safe database operations
   */
  private get em() {
    return this.orm.em.fork();
  }

  /**
   * Create back button with translated text
   */
  private createBackButton(ctx: BotContext, returnTo: string): InlineKeyboard {
    return this.menuHandler.createBackButton(returnTo, ctx.t('common.back'));
  }

  /**
   * Safely answer callback query (skips for simulated callbacks from commands)
   */
  private async safeAnswerCallback(ctx: BotContext, text?: string): Promise<void> {
    const callbackId = ctx.callbackQuery?.id;

    if (!callbackId || callbackId.startsWith('cmd_')) {
      return;
    }

    try {
      await ctx.answerCallbackQuery(text);
    } catch {
      // Silently ignore errors
    }
  }

  /**
   * Handle Admin Menu
   */
  async handleAdminMenu(ctx: AuthenticatedBotContext): Promise<void> {
    if (ctx.user.role !== UserRole.Admin && ctx.user.role !== UserRole.SuperAdmin) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('common.errors.no_permission'),
      });

      return;
    }

    const [totalUsers, activeUsers] = await Promise.all([
      this.em.count(UserEntity),
      this.em.count(UserEntity, { status: UserStatus.Active }),
    ]);

    const [totalOrders, activeOrders] = await Promise.all([
      this.em.count(TrafficOrderEntity),
      this.em.count(TrafficOrderEntity, {
        status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress] },
      }),
    ]);

    const totalSources = await this.em.count(TrafficSourceEntity);

    let text = '<b>🔧 Admin Panel</b>\n\n';
    text += '<b>👥 Users:</b>\n';
    text += `• Total: ${totalUsers}\n`;
    text += `• Active: ${activeUsers}\n\n`;
    text += '<b>📋 Orders:</b>\n';
    text += `• Total: ${totalOrders}\n`;
    text += `• Active: ${activeOrders}\n\n`;
    text += '<b>🎯 Traffic Sources:</b>\n';
    text += `• Total: ${totalSources}\n\n`;
    text += '<i>Select an action below to manage the system.</i>';

    const keyboard = this.menuHandler.createAdminMenuKeyboard(ctx);
    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }
}
