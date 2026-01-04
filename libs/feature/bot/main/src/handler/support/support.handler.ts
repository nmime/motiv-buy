/**
 * Support Action Handler
 *
 * Handles support-related actions including support menu,
 * contact support, FAQ, bug reports, and feature suggestions.
 */

import { Injectable, Logger } from '@nestjs/common';
import { BotContext } from '@app/feature-bot-shared';
import { MessageService } from '../../service/message.service';
import { InlineKeyboard } from 'grammy';

@Injectable()
export class SupportHandler {
  private readonly logger = new Logger(SupportHandler.name);

  constructor(private readonly messageService: MessageService) {}

  /**
   * Display support menu with contact options and FAQ
   */
  async handleSupportMenu(ctx: BotContext): Promise<void> {
    const text = `<b>🏢 ${ctx.t('support.title')}</b>

${ctx.t('support.description')}

<b>⏰ ${ctx.t('support.working_hours')}:</b>
${ctx.t('support.weekdays')} · ${ctx.t('support.weekends')}`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('support.btn_faq'), 'help:faq')
      .row()
      .text(ctx.t('support.btn_contact'), 'support:contact')
      .row()
      .text(ctx.t('support.btn_report'), 'support:report')
      .text(ctx.t('support.btn_suggest'), 'support:suggest')
      .row()
      .text(ctx.t('common.back'), 'menu:main');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Display contact support page with methods and response times
   */
  async handleSupportContact(ctx: BotContext): Promise<void> {
    const text = `<b>💬 ${ctx.t('support.contact_title')}</b>

${ctx.t('support.contact_intro')}

<b>📱 Telegram:</b>
@motivbuy_support - ${ctx.t('support.fast_response')}

<b>📧 Email:</b>
support@motivbuy.com

<b>⏰ ${ctx.t('support.response_time')}:</b>
• Telegram: ${ctx.t('support.response_telegram')}
• Email: ${ctx.t('support.response_email')}

<i>${ctx.t('support.contact_hint')}</i>`;

    const keyboard = new InlineKeyboard()
      .url(ctx.t('support.btn_write_telegram'), 'https://t.me/motivbuy_support')
      .row()
      .text(ctx.t('common.back'), 'menu:support');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Display bug report page with instructions
   */
  async handleSupportReport(ctx: BotContext): Promise<void> {
    const text = `<b>📝 ${ctx.t('support.report_title')}</b>

${ctx.t('support.report_intro')}

<b>${ctx.t('support.what_we_need')}:</b>
• ${ctx.t('support.report_q1')}
• ${ctx.t('support.report_q2')}
• ${ctx.t('support.report_q3')}
• ${ctx.t('support.report_q4')}

<b>${ctx.t('support.common_issues')}:</b>
• ${ctx.t('support.issue_order')}
• ${ctx.t('support.issue_payment')}
• ${ctx.t('support.issue_subscribers')}
• ${ctx.t('support.issue_bot')}

<i>${ctx.t('support.report_hint')}</i>`;

    const keyboard = new InlineKeyboard()
      .url(ctx.t('support.btn_send_report'), 'https://t.me/motivbuy_support')
      .row()
      .text(ctx.t('common.back'), 'menu:support');

    if (ctx.session) {
      ctx.session.conversationState = 'awaiting_support_report';
    }

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Display feature suggestion page
   */
  async handleSupportSuggest(ctx: BotContext): Promise<void> {
    const text = `<b>💡 ${ctx.t('support.suggest_title')}</b>

${ctx.t('support.suggest_intro')}

<b>${ctx.t('support.suggest_what')}:</b>
• ${ctx.t('support.suggest_features')}
• ${ctx.t('support.suggest_ui')}
• ${ctx.t('support.suggest_optimization')}
• ${ctx.t('support.suggest_other')}

<b>${ctx.t('support.suggest_how')}:</b>
${ctx.t('support.suggest_instructions')}

<i>${ctx.t('support.suggest_thanks')}</i>`;

    const keyboard = new InlineKeyboard()
      .url(ctx.t('support.btn_send_suggestion'), 'https://t.me/motivbuy_support')
      .row()
      .text(ctx.t('common.back'), 'menu:support');

    if (ctx.session) {
      ctx.session.conversationState = 'awaiting_support_suggestion';
    }

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Display FAQ main menu with categories
   */
  async handleFAQ(ctx: BotContext): Promise<void> {
    const text = `<b>❓ ${ctx.t('faq.title')}</b>

${ctx.t('faq.description')}`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('faq.cat_getting_started'), 'faq:cat:start')
      .row()
      .text(ctx.t('faq.cat_orders'), 'faq:cat:orders')
      .text(ctx.t('faq.cat_balance'), 'faq:cat:balance')
      .row()
      .text(ctx.t('faq.cat_traffic'), 'faq:cat:traffic')
      .text(ctx.t('faq.cat_technical'), 'faq:cat:technical')
      .row()
      .text(ctx.t('support.btn_contact'), 'support:contact')
      .row()
      .text(ctx.t('common.back'), 'menu:support');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Display Getting Started FAQ category
   */
  async handleFAQStart(ctx: BotContext): Promise<void> {
    const text = `<b>🚀 ${ctx.t('faq.cat_getting_started')}</b>

<b>Q: ${ctx.t('faq.start.q1')}</b>
${ctx.t('faq.start.a1')}

<b>Q: ${ctx.t('faq.start.q2')}</b>
${ctx.t('faq.start.a2')}

<b>Q: ${ctx.t('faq.start.q3')}</b>
${ctx.t('faq.start.a3')}`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('faq.btn_buy_traffic'), 'menu:buy_traffic')
      .text(ctx.t('faq.btn_sell_traffic'), 'menu:sell_traffic')
      .row()
      .text(ctx.t('common.back'), 'help:faq');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Display Orders FAQ category
   */
  async handleFAQOrders(ctx: BotContext): Promise<void> {
    const text = `<b>📦 ${ctx.t('faq.cat_orders')}</b>

<b>Q: ${ctx.t('faq.orders.q1')}</b>
${ctx.t('faq.orders.a1')}

<b>Q: ${ctx.t('faq.orders.q2')}</b>
${ctx.t('faq.orders.a2')}

<b>Q: ${ctx.t('faq.orders.q3')}</b>
${ctx.t('faq.orders.a3')}

<b>Q: ${ctx.t('faq.orders.q4')}</b>
${ctx.t('faq.orders.a4')}

<b>Q: ${ctx.t('faq.orders.q5')}</b>
${ctx.t('faq.orders.a5')}`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('faq.btn_create_order'), 'menu:buy_traffic')
      .row()
      .text(ctx.t('faq.btn_order_help'), 'help:createOrder')
      .row()
      .text(ctx.t('common.back'), 'help:faq');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Display Balance FAQ category
   */
  async handleFAQBalance(ctx: BotContext): Promise<void> {
    const text = `<b>💰 ${ctx.t('faq.cat_balance')}</b>

<b>Q: ${ctx.t('faq.balance.q1')}</b>
${ctx.t('faq.balance.a1')}

<b>Q: ${ctx.t('faq.balance.q2')}</b>
${ctx.t('faq.balance.a2')}

<b>Q: ${ctx.t('faq.balance.q3')}</b>
${ctx.t('faq.balance.a3')}

<b>Q: ${ctx.t('faq.balance.q4')}</b>
${ctx.t('faq.balance.a4')}

<b>Q: ${ctx.t('faq.balance.q5')}</b>
${ctx.t('faq.balance.a5')}`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('faq.btn_deposit'), 'balance:deposit')
      .text(ctx.t('faq.btn_withdraw'), 'balance:withdraw')
      .row()
      .text(ctx.t('common.back'), 'help:faq');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Display Traffic FAQ category
   */
  async handleFAQTraffic(ctx: BotContext): Promise<void> {
    const text = `<b>🎯 ${ctx.t('faq.cat_traffic')}</b>

<b>Q: ${ctx.t('faq.traffic.q1')}</b>
${ctx.t('faq.traffic.a1')}

<b>Q: ${ctx.t('faq.traffic.q2')}</b>
${ctx.t('faq.traffic.a2')}

<b>Q: ${ctx.t('faq.traffic.q3')}</b>
${ctx.t('faq.traffic.a3')}

<b>Q: ${ctx.t('faq.traffic.q4')}</b>
${ctx.t('faq.traffic.a4')}`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('faq.btn_add_source'), 'traffic:sources:add')
      .row()
      .text(ctx.t('faq.btn_traffic_guide'), 'help:traffic')
      .row()
      .text(ctx.t('common.back'), 'help:faq');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Display Technical FAQ category
   */
  async handleFAQTechnical(ctx: BotContext): Promise<void> {
    const text = `<b>🔧 ${ctx.t('faq.cat_technical')}</b>

<b>Q: ${ctx.t('faq.technical.q1')}</b>
${ctx.t('faq.technical.a1')}

<b>Q: ${ctx.t('faq.technical.q2')}</b>
${ctx.t('faq.technical.a2')}

<b>Q: ${ctx.t('faq.technical.q3')}</b>
${ctx.t('faq.technical.a3')}

<b>Q: ${ctx.t('faq.technical.q4')}</b>
${ctx.t('faq.technical.a4')}`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('support.btn_report'), 'support:report')
      .row()
      .text(ctx.t('support.btn_contact'), 'support:contact')
      .row()
      .text(ctx.t('common.back'), 'help:faq');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }
}
