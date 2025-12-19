/**
 * Traffic Action Handler
 *
 * Handles all traffic-related actions including:
 * - Buy Traffic menu (for customers)
 * - Sell Traffic menu (for traffic source owners)
 * - Traffic management menu
 * - Traffic Sources (CRUD operations)
 * - Traffic Targets (CRUD operations)
 * - Traffic Analytics
 */

import { Injectable, Logger } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/core';
import { InlineKeyboard } from 'grammy';
import { BotContext, AuthenticatedBotContext } from '@app/feature-bot-shared';
import {
  UserBalanceEntity,
  TrafficSourceEntity,
  TrafficSourceStatus,
  TrafficSourceType,
  TrafficTargetEntity,
  TrafficTargetStatus,
  TrafficTargetType,
  TrafficOrderEntity,
  TrafficOrderStatus,
} from '@app/database';
import { decimal, sum, toDisplayString } from '@app/common-shared';
import { MessageService } from '../../service/message.service';
import { MenuActionHandler } from '../menu-action.handler';

@Injectable()
export class TrafficHandler {
  private readonly logger = new Logger(TrafficHandler.name);

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
   * Handle Buy Traffic menu - for users who want to purchase subscribers
   */
  async handleBuyTrafficMenu(ctx: AuthenticatedBotContext): Promise<void> {
    const [balance, activeOrdersCount] = await Promise.all([
      this.em.findOne(UserBalanceEntity, { user: ctx.user.id }),
      this.em.count(TrafficOrderEntity, {
        creator: ctx.user.id,
        status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress] },
      }),
    ]);

    const availableBalance = balance ? toDisplayString(balance.balance, 2) : '0.00';

    const text = `<b>🛒 ${ctx.t('buy_traffic.title')}</b>

${ctx.t('buy_traffic.description')}

<b>💰 ${ctx.t('buy_traffic.your_balance')}:</b> $${availableBalance}
<b>📦 ${ctx.t('buy_traffic.active_orders')}:</b> ${activeOrdersCount}

<b>📋 ${ctx.t('buy_traffic.how_it_works')}:</b>
1. ${ctx.t('buy_traffic.step1')}
2. ${ctx.t('buy_traffic.step2')}
3. ${ctx.t('buy_traffic.step3')}
4. ${ctx.t('buy_traffic.step4')}
5. ${ctx.t('buy_traffic.step5')}

<i>${ctx.t('buy_traffic.select_action')} 👇</i>`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('buy_traffic.btn_new_order'), 'order:create:start:traffic')
      .text(ctx.t('buy_traffic.btn_my_orders'), 'orders:list')
      .row()
      .text(ctx.t('common.back'), 'menu:main');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle Sell Traffic menu - for users who want to monetize their bot/channel
   */
  async handleSellTrafficMenu(ctx: AuthenticatedBotContext): Promise<void> {
    const [sourcesCount, activeSourcesCount, balance] = await Promise.all([
      this.em.count(TrafficSourceEntity, { managedBy: ctx.user.id }),
      this.em.count(TrafficSourceEntity, { managedBy: ctx.user.id, status: TrafficSourceStatus.Active }),
      this.em.findOne(UserBalanceEntity, { user: ctx.user.id }),
    ]);

    const pendingEarnings = balance ? toDisplayString(balance.lockedBalance, 2) : '0.00';
    const availableBalance = balance ? toDisplayString(balance.balance, 2) : '0.00';

    const text = `<b>💰 ${ctx.t('sell_traffic.title')}</b>

${ctx.t('sell_traffic.description')}

<b>📊 ${ctx.t('sell_traffic.your_stats')}:</b>
• ${ctx.t('sell_traffic.total_sources')}: ${sourcesCount}
• ${ctx.t('sell_traffic.active_sources')}: ${activeSourcesCount}
• ${ctx.t('sell_traffic.pending_earnings')}: $${pendingEarnings}
• ${ctx.t('sell_traffic.available_balance')}: $${availableBalance}

<b>💡 ${ctx.t('sell_traffic.how_to_earn')}:</b>
1. ${ctx.t('sell_traffic.step1')}
2. ${ctx.t('sell_traffic.step2')}
3. ${ctx.t('sell_traffic.step3')}
4. ${ctx.t('sell_traffic.step4')}

<i>${ctx.t('sell_traffic.select_action')} 👇</i>`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('sell_traffic.btn_my_sources'), 'traffic:sources')
      .text(ctx.t('sell_traffic.btn_add_source'), 'traffic:sources:add')
      .row()
      .text(ctx.t('common.back'), 'menu:main');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle Traffic menu - main traffic management overview
   */
  async handleTrafficMenu(ctx: AuthenticatedBotContext): Promise<void> {
    const sources = await this.em.find(TrafficSourceEntity, { managedBy: ctx.user.id }, { populate: ['orders'] });

    const activeOrders = await this.em.count(TrafficOrderEntity, {
      creator: ctx.user.id,
      status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress] },
    });

    const totalOrders = await this.em.count(TrafficOrderEntity, { creator: ctx.user.id });

    let text = `<b>${ctx.t('traffic.management_title')}</b>\n\n`;
    text += `<b>${ctx.t('common.overview')}:</b>\n`;
    text += `• ${ctx.t('traffic.sources')}: ${sources.length}\n`;
    text += `• ${ctx.t('orders.active')}: ${activeOrders}\n`;
    text += `• ${ctx.t('orders.total')}: ${totalOrders}\n\n`;

    if (sources.length > 0) {
      text += `<b>${ctx.t('traffic.your_sources')}:</b>\n`;
      sources.slice(0, 5).forEach((source) => {
        const statusEmoji = source.status === TrafficSourceStatus.Active ? '✅' : '❌';
        text += `${statusEmoji} ${source.name} (${source.type})\n`;
      });

      if (sources.length > 5) {
        text += `... ${ctx.t('common.and_more')} ${sources.length - 5} ${ctx.t('common.more')}\n`;
      }
    } else {
      text += `<i>${ctx.t('traffic.no_sources')}</i>`;
    }

    const keyboard = this.menuHandler.createTrafficMenuKeyboard(ctx);
    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Traffic Source CRUD Operations
   */

  async handleTrafficSourcesList(ctx: AuthenticatedBotContext): Promise<void> {
    const sources = await this.em.find(
      TrafficSourceEntity,
      { managedBy: ctx.user.id },
      { orderBy: { createdAt: 'DESC' }, limit: 10 },
    );

    let text = ctx.t('traffic.sources_list_title');

    if (sources.length === 0) {
      text += ctx.t('traffic.no_sources', {
        default: '<i>No traffic sources yet. Click "Add New Source" to create one!</i>',
      });
    } else {
      text += ctx.t('traffic.sources_count', {
        default: `Total: ${sources.length} source(s)\n\n`,
        count: sources.length,
      });

      sources.forEach((source) => {
        const statusEmoji = source.status === TrafficSourceStatus.Active ? '✅' : '❌';
        const typeLabel =
          source.type === TrafficSourceType.Bot ? ctx.t('traffic.type_bot') : ctx.t('traffic.type_bot_with_token');

        const statusLabel = ctx.t(`traffic.status.${source.status}`);

        text += `${statusEmoji} <b>${source.name}</b>\n`;
        text += `   ${ctx.t('traffic.source_type')}: ${typeLabel}\n`;
        text += `   ${ctx.t('traffic.source_status')}: ${statusLabel}\n\n`;
      });
    }

    const sourcesList = sources.map((s) => ({ id: s.id, name: s.name, status: s.status }));
    const keyboard = this.menuHandler.createTrafficSourcesKeyboard(ctx, sourcesList);

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  async handleTrafficSourceAdd(ctx: AuthenticatedBotContext): Promise<void> {
    if (ctx.session) {
      ctx.session.conversationState = 'trafficSourceCreate';
      ctx.session.formData = { step: 'select_type' };
    }

    const text = ctx.t('traffic.select_source_type');
    const keyboard = new InlineKeyboard()
      .text(ctx.t('traffic.type_bot'), 'traffic:source:type:bot')
      .row()
      .text(ctx.t('traffic.type_bot_with_token'), 'traffic:source:type:bot_with_token')
      .row()
      .text(ctx.t('common.back'), 'traffic:sources');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  async handleTrafficSourceTypeSelect(ctx: AuthenticatedBotContext, type: 'bot' | 'bot_with_token'): Promise<void> {
    if (ctx.session) {
      ctx.session.conversationState = 'trafficSourceCreate';
      ctx.session.formData = {
        step: type === 'bot' ? 'enter_username' : 'enter_token',
        type: type === 'bot' ? TrafficSourceType.Bot : TrafficSourceType.BotWithToken,
      };
    }

    const text = type === 'bot' ? ctx.t('traffic.enter_bot_username') : ctx.t('traffic.enter_bot_token');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: this.createBackButton(ctx, 'traffic:sources:add'),
    });
  }

  async handleTrafficSourceView(ctx: AuthenticatedBotContext, sourceId: string): Promise<void> {
    const source = await this.em.findOne(TrafficSourceEntity, { id: sourceId, managedBy: ctx.user.id });

    if (!source) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.source_not_found'),
      });

      return;
    }

    const ordersCount = await this.em.count(TrafficOrderEntity, { trafficSource: source.id });
    const statusEmoji = source.status === TrafficSourceStatus.Active ? '✅' : '❌';
    const typeLabel =
      source.type === TrafficSourceType.Bot ? ctx.t('traffic.type_bot') : ctx.t('traffic.type_bot_with_token');

    const statusLabel = ctx.t(`traffic.status.${source.status}`);

    let text = ctx.t('traffic.source_details_title');
    text += `<b>${ctx.t('traffic.source_name')}:</b> ${source.name}\n`;
    text += `<b>${ctx.t('traffic.source_type')}:</b> ${typeLabel}\n`;
    text += `<b>${ctx.t('traffic.source_status')}:</b> ${statusEmoji} ${statusLabel}\n`;

    if (source.botUsername) {
      text += `<b>${ctx.t('traffic.bot_username')}:</b> @${source.botUsername}\n`;
    }

    if (source.description) {
      text += `<b>${ctx.t('traffic.source_description')}:</b> ${source.description}\n`;
    }

    text += `\n<b>${ctx.t('common.statistics')}:</b>\n`;
    text += `• ${ctx.t('traffic.total_orders_label')}: ${ordersCount}\n`;
    text += `• ${ctx.t('traffic.created_at')}: ${this.messageService.formatDate(ctx, source.createdAt)}\n`;

    const keyboard = this.menuHandler.createTrafficSourceDetailKeyboard(ctx, sourceId);

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  async handleTrafficSourceEdit(ctx: BotContext, sourceId: string): Promise<void> {
    if (ctx.session) {
      ctx.session.conversationState = 'trafficSourceEdit';
      ctx.session.formData = { sourceId, step: 'select_field' };
    }

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('traffic.edit_source'),
      replyMarkup: this.createBackButton(ctx, `traffic:source:view:${sourceId}`),
    });
  }

  async handleTrafficSourceToggle(ctx: AuthenticatedBotContext, sourceId: string): Promise<void> {
    const source = await this.em.findOne(TrafficSourceEntity, { id: sourceId, managedBy: ctx.user.id });

    if (!source) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.source_not_found'),
      });

      return;
    }

    // Only allow toggling for approved sources (Active/Inactive)
    // Pending and Declined sources require moderation
    if (source.status === TrafficSourceStatus.Pending || source.status === TrafficSourceStatus.Declined) {
      await this.safeAnswerCallback(ctx, ctx.t('traffic.source_toggle_not_allowed'));

      return;
    }

    source.status =
      source.status === TrafficSourceStatus.Active ? TrafficSourceStatus.Inactive : TrafficSourceStatus.Active;

    await this.em.flush();

    await this.safeAnswerCallback(ctx, ctx.t('traffic.source_status_toggled'));

    await this.handleTrafficSourceView(ctx, sourceId);
  }

  async handleTrafficSourceDelete(ctx: BotContext, sourceId: string): Promise<void> {
    // Use shorter callback format to stay within Telegram's 64-byte limit
    // Format: traf:src:del:Y:<id> (confirm) or traf:src:del:N:<id> (cancel)
    const keyboard = new InlineKeyboard()
      .text(ctx.t('common.buttons.confirm'), `traf:src:del:Y:${sourceId}`)
      .text(ctx.t('common.buttons.cancel'), `traf:src:del:N:${sourceId}`);

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('traffic.delete_source_confirm', {
        default:
          '<b>⚠️ Delete Traffic Source</b>\n\nAre you sure you want to delete this traffic source?\n\n<b>This action cannot be undone!</b>',
      }),
      replyMarkup: keyboard,
    });
  }

  async handleTrafficSourceDeleteConfirm(ctx: AuthenticatedBotContext, sourceId: string): Promise<void> {
    const source = await this.em.findOne(TrafficSourceEntity, { id: sourceId, managedBy: ctx.user.id });

    if (!source) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.source_not_found'),
      });

      return;
    }

    const sourceName = source.name;
    await this.em.removeAndFlush(source);

    await this.safeAnswerCallback(ctx, ctx.t('traffic.source_deleted'));

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('traffic.source_deleted_success', {
        default: `<b>✅ Traffic Source Deleted</b>\n\nSource "${sourceName}" has been successfully deleted.`,
        name: sourceName,
      }),
      replyMarkup: this.createBackButton(ctx, 'traffic:sources'),
    });
  }

  async handleTrafficSourceStats(ctx: AuthenticatedBotContext, sourceId: string): Promise<void> {
    const source = await this.em.findOne(TrafficSourceEntity, { id: sourceId, managedBy: ctx.user.id });

    if (!source) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.source_not_found'),
      });

      return;
    }

    const [totalOrders, activeOrders, completedOrders] = await Promise.all([
      this.em.count(TrafficOrderEntity, { trafficSource: source.id }),
      this.em.count(TrafficOrderEntity, {
        trafficSource: source.id,
        status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress] },
      }),
      this.em.count(TrafficOrderEntity, { trafficSource: source.id, status: TrafficOrderStatus.Completed }),
    ]);

    const text =
      ctx.t('traffic.source_stats_title', { name: source.name }) +
      ctx.t('traffic.source_stats_orders', {
        total: totalOrders,
        active: activeOrders,
        completed: completedOrders,
      }) +
      ctx.t('traffic.source_stats_dates', {
        created: this.messageService.formatDate(ctx, source.createdAt),
        updated: this.messageService.formatDate(ctx, source.updatedAt),
      });

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: this.createBackButton(ctx, `traffic:source:view:${sourceId}`),
    });
  }

  /**
   * Traffic Target CRUD Operations
   */

  async handleTrafficTargetsList(ctx: AuthenticatedBotContext): Promise<void> {
    const targets = await this.em.find(
      TrafficTargetEntity,
      { managedBy: ctx.user.id },
      { orderBy: { createdAt: 'DESC' }, limit: 10 },
    );

    let text = ctx.t('traffic.targets_list_title');

    if (targets.length === 0) {
      text += ctx.t('traffic.no_targets', {
        default: '<i>No traffic targets yet. Click "Add New Target" to create one!</i>',
      });
    } else {
      text += ctx.t('traffic.targets_count', {
        default: `Total: ${targets.length} target(s)\n\n`,
        count: targets.length,
      });

      targets.forEach((target) => {
        const statusEmoji = target.status === TrafficTargetStatus.Active ? '✅' : '❌';
        const typeLabel = this.getTargetTypeLabel(target.type);
        text += `${statusEmoji} <b>${target.name}</b>\n`;
        text += `   Type: ${typeLabel}\n`;
        text += `   Status: ${target.status}\n\n`;
      });
    }

    const targetsList = targets.map((t) => ({ id: t.id, name: t.name, status: t.status }));
    const keyboard = this.menuHandler.createTrafficTargetsKeyboard(ctx, targetsList);

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  async handleTrafficTargetAdd(ctx: AuthenticatedBotContext): Promise<void> {
    if (ctx.session) {
      ctx.session.conversationState = 'trafficTargetCreate';
      ctx.session.formData = { step: 'enter_name' };
    }

    const text = ctx.t('traffic.add_target_title') + ctx.t('traffic.add_target_instructions');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: this.createBackButton(ctx, 'traffic:targets'),
    });
  }

  async handleTrafficTargetView(ctx: AuthenticatedBotContext, targetId: string): Promise<void> {
    const target = await this.em.findOne(TrafficTargetEntity, { id: targetId, managedBy: ctx.user.id });

    if (!target) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.target_not_found'),
      });

      return;
    }

    const ordersCount = await this.em.count(TrafficOrderEntity, { trafficTarget: target.id });
    const statusEmoji = target.status === TrafficTargetStatus.Active ? '✅' : '❌';
    const typeLabel = this.getTargetTypeLabel(target.type);

    let text = ctx.t('traffic.target_details_title');
    text += `<b>Name:</b> ${target.name}\n`;
    text += `<b>Type:</b> ${typeLabel}\n`;
    text += `<b>Status:</b> ${statusEmoji} ${target.status}\n`;

    if (target.username) {
      text += `<b>Username:</b> @${target.username}\n`;
    }

    if (target.inviteLink) {
      text += `<b>Invite Link:</b> ${target.inviteLink}\n`;
    }

    if (target.description) {
      text += `<b>Description:</b> ${target.description}\n`;
    }

    if (target.pricePerMember) {
      text += `<b>Price per Member:</b> $${toDisplayString(target.pricePerMember, 2)}\n`;
    }

    text += `\n<b>${ctx.t('common.statistics')}:</b>\n`;
    text += `• ${ctx.t('traffic.total_orders_label')}: ${ordersCount}\n`;
    text += `• ${ctx.t('traffic.created_at')}: ${this.messageService.formatDate(ctx, target.createdAt)}\n`;

    const keyboard = this.menuHandler.createTrafficTargetDetailKeyboard(ctx, targetId);

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  async handleTrafficTargetEdit(ctx: BotContext, targetId: string): Promise<void> {
    if (ctx.session) {
      ctx.session.conversationState = 'trafficTargetEdit';
      ctx.session.formData = { targetId, step: 'select_field' };
    }

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('traffic.edit_target'),
      replyMarkup: this.createBackButton(ctx, `traffic:target:view:${targetId}`),
    });
  }

  async handleTrafficTargetToggle(ctx: AuthenticatedBotContext, targetId: string): Promise<void> {
    const target = await this.em.findOne(TrafficTargetEntity, { id: targetId, managedBy: ctx.user.id });

    if (!target) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.target_not_found'),
      });

      return;
    }

    target.status =
      target.status === TrafficTargetStatus.Active ? TrafficTargetStatus.Inactive : TrafficTargetStatus.Active;

    await this.em.flush();

    await this.safeAnswerCallback(ctx, ctx.t('traffic.target_status_toggled'));

    await this.handleTrafficTargetView(ctx, targetId);
  }

  async handleTrafficTargetDelete(ctx: BotContext, targetId: string): Promise<void> {
    // Use shorter callback format to stay within Telegram's 64-byte limit
    // Format: traf:tgt:del:Y:<id> (confirm) or traf:tgt:del:N:<id> (cancel)
    const keyboard = new InlineKeyboard()
      .text(ctx.t('common.buttons.confirm'), `traf:tgt:del:Y:${targetId}`)
      .text(ctx.t('common.buttons.cancel'), `traf:tgt:del:N:${targetId}`);

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('traffic.delete_target_confirm', {
        default:
          '<b>⚠️ Delete Traffic Target</b>\n\nAre you sure you want to delete this traffic target?\n\n<b>This action cannot be undone!</b>',
      }),
      replyMarkup: keyboard,
    });
  }

  async handleTrafficTargetDeleteConfirm(ctx: AuthenticatedBotContext, targetId: string): Promise<void> {
    const target = await this.em.findOne(TrafficTargetEntity, { id: targetId, managedBy: ctx.user.id });

    if (!target) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.target_not_found'),
      });

      return;
    }

    const targetName = target.name;
    await this.em.removeAndFlush(target);

    await this.safeAnswerCallback(ctx, ctx.t('traffic.target_deleted'));

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('traffic.target_deleted_success', {
        default: `<b>✅ Traffic Target Deleted</b>\n\nTarget "${targetName}" has been successfully deleted.`,
        name: targetName,
      }),
      replyMarkup: this.createBackButton(ctx, 'traffic:targets'),
    });
  }

  async handleTrafficTargetStats(ctx: AuthenticatedBotContext, targetId: string): Promise<void> {
    const target = await this.em.findOne(TrafficTargetEntity, { id: targetId, managedBy: ctx.user.id });

    if (!target) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.target_not_found'),
      });

      return;
    }

    const [totalOrders, activeOrders, completedOrders] = await Promise.all([
      this.em.count(TrafficOrderEntity, { trafficTarget: target.id }),
      this.em.count(TrafficOrderEntity, {
        trafficTarget: target.id,
        status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress] },
      }),
      this.em.count(TrafficOrderEntity, { trafficTarget: target.id, status: TrafficOrderStatus.Completed }),
    ]);

    let text = ctx.t('traffic.target_stats_title', {
      default: `<b>📊 Target Statistics: ${target.name}</b>\n\n`,
      name: target.name,
    });

    text += `<b>${ctx.t('traffic.orders')}:</b>\n`;
    text += `• ${ctx.t('orders.total')}: ${totalOrders}\n`;
    text += `• ${ctx.t('orders.active')}: ${activeOrders}\n`;
    text += `• ${ctx.t('orders.completed')}: ${completedOrders}\n\n`;
    text += `<b>${ctx.t('traffic.created_at')}:</b> ${this.messageService.formatDate(ctx, target.createdAt)}\n`;
    text += `<b>${ctx.t('traffic.last_updated')}:</b> ${this.messageService.formatDate(ctx, target.updatedAt)}`;

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: this.createBackButton(ctx, `traffic:target:view:${targetId}`),
    });
  }

  /**
   * Traffic Analytics
   */
  async handleTrafficAnalytics(ctx: AuthenticatedBotContext): Promise<void> {
    const [sourcesCount, targetsCount, totalOrders, activeOrders, completedOrders] = await Promise.all([
      this.em.count(TrafficSourceEntity, { managedBy: ctx.user.id }),
      this.em.count(TrafficTargetEntity, { managedBy: ctx.user.id }),
      this.em.count(TrafficOrderEntity, { creator: ctx.user.id }),
      this.em.count(TrafficOrderEntity, {
        creator: ctx.user.id,
        status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress] },
      }),
      this.em.count(TrafficOrderEntity, { creator: ctx.user.id, status: TrafficOrderStatus.Completed }),
    ]);

    const orders = await this.em.find(TrafficOrderEntity, { creator: ctx.user.id });
    const totalSpent = sum(orders.map((o) => decimal(o.spentAmount || '0')));
    const totalBudget = sum(orders.map((o) => decimal(o.totalBudget || '0')));

    let text = ctx.t('traffic.analytics_title');
    text += `<b>Resources:</b>\n`;
    text += `• Traffic Sources: ${sourcesCount}\n`;
    text += `• Traffic Targets: ${targetsCount}\n\n`;
    text += `<b>Orders:</b>\n`;
    text += `• Total: ${totalOrders}\n`;
    text += `• Active: ${activeOrders}\n`;
    text += `• Completed: ${completedOrders}\n\n`;
    text += `<b>Financial:</b>\n`;
    text += `• Total Budget: $${toDisplayString(totalBudget, 2)}\n`;
    text += `• Total Spent: $${toDisplayString(totalSpent, 2)}`;

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: this.createBackButton(ctx, 'menu:traffic'),
    });
  }

  /**
   * Input handlers for conversation flows
   */

  async handleTrafficSourceCreateInput(ctx: AuthenticatedBotContext, input: string): Promise<void> {
    const formData = ctx.session?.formData;
    if (!formData || typeof formData !== 'object') {
      return;
    }

    const step = 'step' in formData ? String(formData.step) : '';

    if (step === 'enter_username') {
      const newSource = new TrafficSourceEntity({
        name: input,
        botUsername: input,
        managedById: ctx.user.id,
        type: TrafficSourceType.Bot,
        status: TrafficSourceStatus.Pending,
      });

      await this.em.persistAndFlush(newSource);

      if (ctx.session) {
        ctx.session.conversationState = undefined;
        ctx.session.formData = undefined;
      }

      const text = ctx.t('traffic.source_created', { name: input });

      const keyboard = new InlineKeyboard()
        .text(ctx.t('traffic.view_source'), `traffic:source:view:${newSource.id}`)
        .row()
        .text(ctx.t('sell_traffic.btn_my_sources'), 'traffic:sources')
        .text(ctx.t('common.back'), 'menu:sell_traffic');

      await this.messageService.sendOrEditMessage(ctx, {
        text,
        replyMarkup: keyboard,
      });
    } else if (step === 'enter_token') {
      try {
        const response = await fetch(`https://api.telegram.org/bot${input}/getMe`);
        const data = await response.json();

        if (!data.ok || !data.result) {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('traffic.invalid_bot_token'),
          });

          return;
        }

        const botInfo = data.result;
        const botUsername = botInfo.username;
        const botName = botInfo.first_name;

        const newSource = new TrafficSourceEntity({
          name: botName,
          botUsername,
          botToken: input,
          managedById: ctx.user.id,
          type: TrafficSourceType.BotWithToken,
          status: TrafficSourceStatus.Pending,
        });

        await this.em.persistAndFlush(newSource);

        if (ctx.session) {
          ctx.session.conversationState = undefined;
          ctx.session.formData = undefined;
        }

        const text = ctx.t('traffic.source_created', { name: botUsername });

        const keyboard = new InlineKeyboard()
          .text(ctx.t('traffic.view_source'), `traffic:source:view:${newSource.id}`)
          .row()
          .text(ctx.t('sell_traffic.btn_my_sources'), 'traffic:sources')
          .text(ctx.t('common.back'), 'menu:sell_traffic');

        await this.messageService.sendOrEditMessage(ctx, {
          text,
          replyMarkup: keyboard,
        });
      } catch (error) {
        this.logger.error('Failed to get bot info from token', { error });
        await this.messageService.sendOrEditMessage(ctx, {
          text: ctx.t('traffic.invalid_bot_token'),
        });
      }
    }
  }

  async handleTrafficSourceEditInput(ctx: AuthenticatedBotContext, input: string): Promise<void> {
    const formData = ctx.session?.formData;
    if (!formData || typeof formData !== 'object') {
      return;
    }

    const sourceId = 'sourceId' in formData ? String(formData.sourceId) : '';

    if (!sourceId) {
      return;
    }

    const source = await this.em.findOne(TrafficSourceEntity, { id: sourceId, managedBy: ctx.user.id });
    if (!source) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.source_not_found'),
      });

      return;
    }

    source.name = input;
    await this.em.flush();

    if (ctx.session) {
      ctx.session.conversationState = undefined;
      ctx.session.formData = undefined;
    }

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('traffic.source_updated', { name: input }),
    });

    await this.handleTrafficSourceView(ctx, sourceId);
  }

  async handleTrafficTargetCreateInput(ctx: AuthenticatedBotContext, input: string): Promise<void> {
    const formData = ctx.session?.formData;
    if (!formData || typeof formData !== 'object') {
      return;
    }

    const step = 'step' in formData ? String(formData.step) : '';

    if (step === 'enter_name') {
      const newTarget = new TrafficTargetEntity({
        name: input,
        managedById: ctx.user.id,
        type: TrafficTargetType.Channel,
        status: TrafficTargetStatus.Active,
        requiresApproval: false,
      });

      await this.em.persistAndFlush(newTarget);

      if (ctx.session) {
        ctx.session.conversationState = undefined;
        ctx.session.formData = undefined;
      }

      const text = ctx.t('traffic.target_created', { name: input });

      const keyboard = new InlineKeyboard()
        .text(ctx.t('traffic.view_target'), `traffic:target:view:${newTarget.id}`)
        .row()
        .text(ctx.t('traffic.targets'), 'traffic:targets')
        .text(ctx.t('common.back'), 'menu:sell_traffic');

      await this.messageService.sendOrEditMessage(ctx, {
        text,
        replyMarkup: keyboard,
      });
    }
  }

  async handleTrafficTargetEditInput(ctx: AuthenticatedBotContext, input: string): Promise<void> {
    const formData = ctx.session?.formData;
    if (!formData || typeof formData !== 'object') {
      return;
    }

    const targetId = 'targetId' in formData ? String(formData.targetId) : '';

    if (!targetId) {
      return;
    }

    const target = await this.em.findOne(TrafficTargetEntity, { id: targetId, managedBy: ctx.user.id });
    if (!target) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.target_not_found'),
      });

      return;
    }

    target.name = input;
    await this.em.flush();

    if (ctx.session) {
      ctx.session.conversationState = undefined;
      ctx.session.formData = undefined;
    }

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('traffic.target_updated', { name: input }),
    });

    await this.handleTrafficTargetView(ctx, targetId);
  }

  /**
   * Helper Methods
   */

  private getTargetTypeLabel(type: TrafficTargetType): string {
    const typeLabels: Record<TrafficTargetType, string> = {
      [TrafficTargetType.Channel]: '📢 Channel',
      [TrafficTargetType.Group]: '👥 Group',
      [TrafficTargetType.Bot]: '🤖 Bot',
      [TrafficTargetType.WithChecking]: '✅ With Checking',
    };

    return typeLabels[type] || type;
  }
}
