/**
 * Menu Handler
 *
 * Handles various menu displays including orders, campaign, referrals,
 * payments, admin, export, and other miscellaneous menus.
 */

import { Injectable, Logger } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/core';
import { InlineKeyboard } from 'grammy';
import { BotContext, AuthenticatedBotContext } from '@app/feature-bot-shared';
import {
  UserEntity,
  UserStatus,
  UserRole,
  TrafficOrderEntity,
  TrafficOrderStatus,
  TrafficSourceEntity,
  UserBalanceHistoryEntity,
} from '@app/database';
import { decimal, toDisplayString } from '@app/common-shared';
import { MessageService } from '../../service/message.service';
import { MenuActionHandler } from '../menu-action.handler';

@Injectable()
export class MiscMenuHandler {
  private readonly logger = new Logger(MiscMenuHandler.name);

  constructor(
    private readonly orm: MikroORM,
    private readonly messageService: MessageService,
    private readonly menuActionHandler: MenuActionHandler,
  ) {}

  private get em() {
    return this.orm.em.fork();
  }

  private createBackButton(ctx: BotContext, returnTo: string): InlineKeyboard {
    return this.menuActionHandler.createBackButton(returnTo, ctx.t('common.back'));
  }

  async handleCampaignMenu(ctx: AuthenticatedBotContext): Promise<void> {
    // Get campaign statistics (campaigns are TrafficOrders)
    const [active, completed, total] = await Promise.all([
      this.em.count(TrafficOrderEntity, {
        creator: ctx.user.id,
        status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress] },
      }),
      this.em.count(TrafficOrderEntity, {
        creator: ctx.user.id,
        status: TrafficOrderStatus.Completed,
      }),
      this.em.count(TrafficOrderEntity, { creator: ctx.user.id }),
    ]);

    // Get recent campaigns
    const recentCampaigns = await this.em.find(
      TrafficOrderEntity,
      { creator: ctx.user.id },
      { orderBy: { createdAt: 'DESC' }, limit: 5, populate: ['trafficTarget'] },
    );

    const totalSpent = recentCampaigns.reduce((acc, order) => {
      return acc.plus(decimal(order.spentAmount || '0'));
    }, decimal(0));

    let text = `<b>${ctx.t('campaign.management_title')}</b>\n\n`;
    text += `<b>${ctx.t('common.statistics')}:</b>\n`;
    text += `• ${ctx.t('campaign.active')}: ${active}\n`;
    text += `• ${ctx.t('common.completed')}: ${completed}\n`;
    text += `• ${ctx.t('common.total')}: ${total}\n`;
    text += `• ${ctx.t('common.total_spent')}: $${toDisplayString(totalSpent, 2)}\n\n`;

    if (recentCampaigns.length > 0) {
      text += `<b>${ctx.t('campaign.recent')}:</b>\n`;
      for (const campaign of recentCampaigns) {
        const statusEmoji =
          {
            [TrafficOrderStatus.Active]: '✅',
            [TrafficOrderStatus.InProgress]: '🔄',
            [TrafficOrderStatus.Completed]: '✔️',
            [TrafficOrderStatus.Pending]: '⏳',
            [TrafficOrderStatus.Cancelled]: '❌',
            [TrafficOrderStatus.Failed]: '⚠️',
          }[campaign.status] || '❓';

        text += `${statusEmoji} ${campaign.orderId.substring(0, 8)}... (${campaign.type})\n`;
        text += `   ${ctx.t('common.progress')}: ${campaign.currentCount}/${campaign.targetCount}\n`;
      }
    } else {
      text += `<i>${ctx.t('campaign.no_campaigns')}</i>`;
    }

    const keyboard = this.menuActionHandler.createCampaignMenuKeyboard(ctx);
    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  async handleReferralsMenu(ctx: AuthenticatedBotContext): Promise<void> {
    const botUsername = ctx.me.username;
    const referralCode = ctx.user.id.substring(0, 8);
    const referralLink = `https://t.me/${botUsername}?start=ref_${referralCode}`;

    const text = `<b>🎁 ${ctx.t('referral.title')}</b>

${ctx.t('referral.description')}

<b>💰 ${ctx.t('referral.rewards_title')}:</b>
• ${ctx.t('referral.reward_percent')}
• ${ctx.t('referral.reward_lifetime')}
• ${ctx.t('referral.reward_unlimited')}

<b>🔗 ${ctx.t('referral.link_title')}:</b>
<code>${referralLink}</code>

<b>📊 ${ctx.t('referral.stats_title')}:</b>
• ${ctx.t('referral.invited')}: 0
• ${ctx.t('referral.earned')}: $0.00

<i>${ctx.t('referral.share_hint')}</i>`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('referral.btn_copy'), 'referral:copy')
      .row()
      .text(ctx.t('referral.btn_list'), 'referral:list')
      .text(ctx.t('referral.btn_stats'), 'referral:stats')
      .row()
      .text(ctx.t('referral.btn_share'), 'referral:share')
      .row()
      .text(ctx.t('common.back'), 'menu:main');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  async handlePaymentsMenu(ctx: AuthenticatedBotContext): Promise<void> {
    const transactionCount = await this.em.count(UserBalanceHistoryEntity, { user: ctx.user.id });

    const text = `<b>💳 ${ctx.t('payment.title')}</b>

${ctx.t('payment.description')}

<b>📊 ${ctx.t('payment.stats_title')}:</b>
• ${ctx.t('payment.total_transactions')}: ${transactionCount}

<b>💰 ${ctx.t('payment.deposit_methods')}:</b>
• ${ctx.t('payment.method_cards')}
• ${ctx.t('payment.method_crypto')}
• ${ctx.t('payment.method_wallets')}

<b>💸 ${ctx.t('payment.withdraw_methods')}:</b>
• ${ctx.t('payment.withdraw_crypto')}
• ${ctx.t('payment.withdraw_wallets')}
• ${ctx.t('payment.withdraw_min')}

<i>${ctx.t('common.select_action')}:</i>`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('payment.btn_deposit'), 'balance:deposit')
      .text(ctx.t('payment.btn_withdraw'), 'balance:withdraw')
      .row()
      .text(ctx.t('payment.btn_history'), 'payment:history')
      .row()
      .text(ctx.t('payment.btn_methods'), 'payment:methods')
      .row()
      .text(ctx.t('common.back'), 'menu:main');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  async handleAdminMenu(ctx: AuthenticatedBotContext): Promise<void> {
    // Check if user has admin or super admin role
    if (ctx.user.role !== UserRole.Admin && ctx.user.role !== UserRole.SuperAdmin) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('common.errors.no_permission'),
      });

      return;
    }

    // Get admin statistics
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

    const keyboard = this.menuActionHandler.createAdminMenuKeyboard(ctx);
    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  async handleExportMenu(ctx: AuthenticatedBotContext): Promise<void> {
    // Get data counts for export preview
    const [ordersCount, transactionsCount] = await Promise.all([
      this.em.count(TrafficOrderEntity, { creator: ctx.user.id }),
      this.em.count(UserBalanceHistoryEntity, { user: ctx.user.id }),
    ]);

    let text = '<b>📥 Data Export</b>\n\n';
    text += '<b>Available Data:</b>\n';
    text += `• Profile Information\n`;
    text += `• Orders: ${ordersCount} records\n`;
    text += `• Transactions: ${transactionsCount} records\n`;
    text += `• Statistics & Analytics\n\n`;
    text += '<b>Export Formats:</b>\n';
    text += '• JSON (raw data)\n';
    text += '• CSV (spreadsheet)\n';
    text += '• PDF (formatted report)\n\n';
    text += '<i>Select what you want to export below.</i>\n\n';
    text += '⚠️ Export may take a few moments for large datasets.';

    const keyboard = this.menuActionHandler.createExportMenuKeyboard(ctx);
    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  async handleResetMenu(ctx: AuthenticatedBotContext): Promise<void> {
    let text = '<b>🔄 Reset Account</b>\n\n';
    text += '⚠️ <b>WARNING:</b> This action will reset:\n\n';
    text += '❌ All settings to default\n';
    text += '❌ Notification preferences\n';
    text += '❌ Display preferences\n';
    text += '❌ Language settings\n\n';
    text += '✅ <b>Will NOT affect:</b>\n';
    text += '• Your balance\n';
    text += '• Order history\n';
    text += '• Transaction history\n\n';
    text += '⚡️ <b>This action is IRREVERSIBLE!</b>\n\n';
    text += 'Are you absolutely sure you want to continue?';

    const keyboard = this.menuActionHandler.createConfirmationKeyboard(ctx, 'reset');
    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  async handleStatusDisplay(ctx: BotContext): Promise<void> {
    const userId = ctx.from?.id;
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('status.display', {
        default: `📊 Account Status\n\n🆔 User ID: ${userId || 'Unknown'}\n✅ Status: Active\n📅 Member since: Today\n\nAll systems operational.`,
      }),
      replyMarkup: this.createBackButton(ctx, 'menu:main'),
    });
  }

  async handleCommandsHelp(ctx: BotContext): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('commands.help_text', {
        default:
          '💬 Available Commands\n\n/start - Start bot\n/menu - Open menu\n/help - Show help\n/profile - View profile\n/balance - Check balance\n/settings - Settings\n/stats - Statistics',
      }),
      replyMarkup: this.createBackButton(ctx, 'menu:main'),
    });
  }

  async handleOrdersMenu(ctx: AuthenticatedBotContext): Promise<void> {
    const [activeCount, completedCount, totalCount] = await Promise.all([
      this.em.count(TrafficOrderEntity, {
        creator: ctx.user.id,
        status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress] },
      }),
      this.em.count(TrafficOrderEntity, {
        creator: ctx.user.id,
        status: TrafficOrderStatus.Completed,
      }),
      this.em.count(TrafficOrderEntity, { creator: ctx.user.id }),
    ]);

    const text = `<b>📦 ${ctx.t('orders.title')}</b>

<b>📊 ${ctx.t('orders.stats_title')}:</b>
• ${ctx.t('orders.active_count')}: ${activeCount}
• ${ctx.t('orders.completed_count')}: ${completedCount}
• ${ctx.t('orders.total_count')}: ${totalCount}

<i>${ctx.t('common.select_action')}:</i>`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('orders.btn_new'), 'order:create:start')
      .row()
      .text(ctx.t('orders.btn_active'), 'orders:active')
      .text(ctx.t('orders.btn_completed'), 'orders:completed')
      .row()
      .text(ctx.t('orders.btn_search'), 'orders:search')
      .row()
      .text(ctx.t('common.back'), 'menu:main');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }
}
