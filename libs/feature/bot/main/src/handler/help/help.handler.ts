/**
 * Help Action Handler
 *
 * Handles help-related actions including help menu and
 * instructional guides for orders, deposits, withdrawals, stats, and traffic.
 */

import { Injectable, Logger } from '@nestjs/common';
import { BotContext } from '@app/feature-bot-shared';
import { MessageService } from '../../service/message.service';
import { InlineKeyboard } from 'grammy';

@Injectable()
export class HelpHandler {
  private readonly logger = new Logger(HelpHandler.name);

  constructor(private readonly messageService: MessageService) {}

  /**
   * Display help menu with quick start and command list
   */
  async handleHelpMenu(ctx: BotContext): Promise<void> {
    const text = `<b>❓ ${ctx.t('menu.help_menu.title')}</b>

${ctx.t('help.welcome')}

<b>🚀 ${ctx.t('help.quick_start')}:</b>
1. ${ctx.t('help.step1')}
2. ${ctx.t('help.step2')}
3. ${ctx.t('help.step3')}
4. ${ctx.t('help.step4')}

<b>📚 ${ctx.t('help.sections_title')}:</b>
• ${ctx.t('help.section_orders')}
• ${ctx.t('help.section_balance')}
• ${ctx.t('help.section_stats')}
• ${ctx.t('help.section_traffic')}

<b>💬 ${ctx.t('help.commands_title')}:</b>
/start - ${ctx.t('commands.start_desc')}
/menu - ${ctx.t('commands.menu_desc')}
/balance - ${ctx.t('commands.balance_desc')}
/profile - ${ctx.t('commands.profile_desc')}
/settings - ${ctx.t('commands.settings_desc')}
/help - ${ctx.t('commands.help_desc')}

<i>${ctx.t('help.contact_hint')}</i>`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('help.btn_create_order'), 'help:createOrder')
      .row()
      .text(ctx.t('help.btn_topup'), 'help:topup')
      .text(ctx.t('help.btn_withdraw'), 'help:withdraw')
      .row()
      .text(ctx.t('help.btn_stats'), 'help:stats')
      .text(ctx.t('help.btn_traffic'), 'help:traffic')
      .row()
      .text(ctx.t('support.btn_contact'), 'support:contact')
      .row()
      .text(ctx.t('common.back'), 'menu:main');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Display help guide for creating orders
   */
  async handleHelpCreateOrder(ctx: BotContext): Promise<void> {
    const text = `<b>📖 ${ctx.t('help.create_order_title')}</b>

<b>${ctx.t('help.step')} 1:</b>
${ctx.t('help.create_step1')}

<b>${ctx.t('help.step')} 2:</b>
${ctx.t('help.create_step2')}
${ctx.t('help.create_format')}

<b>${ctx.t('help.step')} 3:</b>
${ctx.t('help.create_step3')}
${ctx.t('help.create_step3_note')}

<b>${ctx.t('help.step')} 4:</b>
${ctx.t('help.create_step4')}

<b>${ctx.t('help.step')} 5:</b>
${ctx.t('help.create_step5')}

<b>💡 ${ctx.t('help.tip')}:</b>
${ctx.t('help.create_tip')}`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('help.btn_create_now'), 'order:create:start')
      .row()
      .text(ctx.t('common.back'), 'menu:help');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Display help guide for depositing funds
   */
  async handleHelpTopup(ctx: BotContext): Promise<void> {
    const text = `<b>💰 ${ctx.t('help.topup_title')}</b>

<b>${ctx.t('help.payment_methods')}:</b>

<b>💳 ${ctx.t('help.method_card')}</b>
• Visa, MasterCard, MIR
• ${ctx.t('help.instant_deposit')}
• ${ctx.t('help.no_fee')}

<b>🪙 ${ctx.t('help.method_crypto')}</b>
• Bitcoin (BTC), Ethereum (ETH), USDT
• ${ctx.t('help.crypto_confirmations')}

<b>📱 ${ctx.t('help.method_ewallet')}</b>
• ${ctx.t('help.instant_deposit')}

<b>${ctx.t('help.min_amount')}:</b> $10
<b>${ctx.t('help.max_amount')}:</b> $10,000

<b>💡 ${ctx.t('help.bonus')}:</b>
${ctx.t('help.deposit_bonus')}`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('help.btn_deposit_now'), 'balance:deposit')
      .row()
      .text(ctx.t('common.back'), 'menu:help');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Display help guide for withdrawing funds
   */
  async handleHelpWithdraw(ctx: BotContext): Promise<void> {
    const text = `<b>💸 ${ctx.t('help.withdraw_title')}</b>

<b>${ctx.t('help.withdrawal_methods')}:</b>

<b>🪙 ${ctx.t('help.method_crypto')}</b>
• Bitcoin, Ethereum, USDT
• ${ctx.t('help.network_fee')}
• ${ctx.t('help.processing_24h')}

<b>📱 ${ctx.t('help.method_ewallet')}</b>
• ${ctx.t('help.ewallet_fee')}
• ${ctx.t('help.processing_24h')}

<b>${ctx.t('help.withdraw_conditions')}:</b>
• ${ctx.t('help.min_amount')}: $10
• ${ctx.t('help.verification_note')}

<b>${ctx.t('help.payout_statuses')}:</b>
⏳ ${ctx.t('help.status_pending')}
✅ ${ctx.t('help.status_completed')}
❌ ${ctx.t('help.status_rejected')}

<b>💡 ${ctx.t('help.tip')}:</b>
${ctx.t('help.withdraw_tip')}`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('help.btn_withdraw_now'), 'balance:withdraw')
      .row()
      .text(ctx.t('common.back'), 'menu:help');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Display help guide for statistics
   */
  async handleHelpStats(ctx: BotContext): Promise<void> {
    const text = `<b>📊 ${ctx.t('help.stats_title')}</b>

<b>${ctx.t('help.stats_available')}:</b>

<b>📈 ${ctx.t('help.stats_orders')}:</b>
• ${ctx.t('help.stats_subscribers')}
• ${ctx.t('help.stats_speed')}
• ${ctx.t('help.stats_unsubscribe')}
• ${ctx.t('help.stats_conversion')}

<b>💰 ${ctx.t('help.stats_financial')}:</b>
• ${ctx.t('help.stats_income')}
• ${ctx.t('help.stats_expenses')}
• ${ctx.t('help.stats_history')}

<b>🎯 ${ctx.t('help.stats_traffic')}:</b>
• ${ctx.t('help.stats_sources')}
• ${ctx.t('help.stats_quality')}
• ${ctx.t('help.stats_activity')}

<b>📅 ${ctx.t('help.stats_periods')}:</b>
• ${ctx.t('help.period_today')}
• ${ctx.t('help.period_week')}
• ${ctx.t('help.period_month')}
• ${ctx.t('help.period_custom')}

<b>💡 ${ctx.t('help.tip')}:</b>
${ctx.t('help.stats_tip')}`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('help.btn_view_stats'), 'stats:overview')
      .row()
      .text(ctx.t('common.back'), 'menu:help');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Display help guide for traffic sources
   */
  async handleHelpTraffic(ctx: BotContext): Promise<void> {
    const text = `<b>🤖 ${ctx.t('help.traffic_title')}</b>

${ctx.t('help.traffic_intro')}

<b>${ctx.t('help.how_it_works')}:</b>
1. ${ctx.t('help.traffic_step1')}
2. ${ctx.t('help.traffic_step2')}
3. ${ctx.t('help.traffic_step3')}

<b>💰 ${ctx.t('help.traffic_earnings')}:</b>
• ${ctx.t('help.traffic_rate')}
• ${ctx.t('help.traffic_depends')}
• ${ctx.t('help.traffic_auto')}

<b>📋 ${ctx.t('help.traffic_requirements')}:</b>
• ${ctx.t('help.traffic_req1')}
• ${ctx.t('help.traffic_req2')}
• ${ctx.t('help.traffic_req3')}

<b>🚀 ${ctx.t('help.traffic_benefits')}:</b>
• ${ctx.t('help.traffic_ben1')}
• ${ctx.t('help.traffic_ben2')}
• ${ctx.t('help.traffic_ben3')}
• ${ctx.t('help.traffic_ben4')}

<i>${ctx.t('help.traffic_cta')}</i>`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('help.btn_add_source'), 'traffic:sources')
      .row()
      .text(ctx.t('help.btn_my_sources'), 'menu:traffic')
      .row()
      .text(ctx.t('common.back'), 'menu:help');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }
}
