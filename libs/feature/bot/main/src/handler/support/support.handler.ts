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

<b>📞 ${ctx.t('support.contact_methods')}:</b>
• ${ctx.t('support.telegram')}: @motivbuy_support
• ${ctx.t('support.email')}: support@motivbuy.com

<b>⏰ ${ctx.t('support.working_hours')}:</b>
• ${ctx.t('support.weekdays')}
• ${ctx.t('support.weekends')}

<b>📋 ${ctx.t('support.faq_title')}:</b>
• ${ctx.t('help.faq_create_order')}
• ${ctx.t('help.faq_deposit')}
• ${ctx.t('help.faq_withdraw')}
• ${ctx.t('help.faq_bot_issues')}

<i>${ctx.t('support.select_action')}.</i>`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('support.btn_contact'), 'support:contact')
      .row()
      .text(ctx.t('support.btn_faq'), 'help:faq')
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
   * Display FAQ page
   */
  async handleFAQ(ctx: BotContext): Promise<void> {
    const text = `<b>❓ ${ctx.t('help.faq_title')}</b>

<b>Q: ${ctx.t('help.faq_q1')}</b>
A: ${ctx.t('help.faq_a1')}

<b>Q: ${ctx.t('help.faq_q2')}</b>
A: ${ctx.t('help.faq_a2')}

<b>Q: ${ctx.t('help.faq_q3')}</b>
A: ${ctx.t('help.faq_a3')}

<b>Q: ${ctx.t('help.faq_q4')}</b>
A: ${ctx.t('help.faq_a4')}

<b>Q: ${ctx.t('help.faq_q5')}</b>
A: ${ctx.t('help.faq_a5')}

<b>Q: ${ctx.t('help.faq_q6')}</b>
A: ${ctx.t('help.faq_a6')}`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('help.btn_more_orders'), 'help:createOrder')
      .row()
      .text(ctx.t('help.btn_balance_questions'), 'help:topup')
      .row()
      .text(ctx.t('common.back'), 'menu:support');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }
}
