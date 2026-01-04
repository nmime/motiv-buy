/**
 * Profile Action Handler
 *
 * Handles user profile-related actions including viewing profiles and referrals.
 */

import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { I18nService } from 'nestjs-i18n';
import { AuthenticatedBotContext } from '@app/feature-bot-shared';
import {
  TransactionStatus,
  TransactionType,
  UserBalanceHistoryEntity,
  UserEntity,
  UserRefLinkEntity,
  UserStatus,
} from '@app/database';
import {
  defaultLanguage,
  languageNames,
  multiply,
  sum,
  supportedLanguages,
  toDisplayString,
  toNumber,
} from '@app/common-shared';
import { changeUserLanguage, updateContextTranslation } from '@app/common-intl';
import { MenuActionHandler } from './menu-action.handler';
import { MessageService } from '../service/message.service';
import { BotConfigService } from '../config/bot-config.service';
import { PaymentConfigService } from '@app/feature-payment-shared';
import { BotSessionService } from '../service/auth';

@Injectable()
export class ProfileActionHandler {
  private readonly logger = new Logger(ProfileActionHandler.name);

  constructor(
    private readonly em: EntityManager,
    private readonly menuHandler: MenuActionHandler,
    private readonly messageService: MessageService,
    private readonly botConfigService: BotConfigService,
    private readonly paymentConfigService: PaymentConfigService,
    private readonly i18n: I18nService,
    private readonly botSessionService: BotSessionService,
  ) {}

  private get currencySymbol(): string {
    return this.paymentConfigService.getBaseCurrencySymbol();
  }

  /**
   * Handle profile view action
   *
   * Note: This handler must be wrapped with protectHandler()
   * Context type guarantees user exists - no null checks or assertions needed
   */
  async handleProfileView(ctx: AuthenticatedBotContext): Promise<void> {
    const profileText = this.formatProfileView(ctx, ctx.user);
    const keyboard = this.menuHandler.createProfileMenuKeyboard(ctx);

    await this.messageService.sendOrEditMessage(ctx, {
      text: profileText,
      replyMarkup: keyboard,
    });

    this.logger.log('Profile viewed', { userId: ctx.user.id, telegramId: ctx.user.telegramId });
  }

  /**
   * Format profile view text
   */
  private formatProfileView(ctx: AuthenticatedBotContext, user: Partial<UserEntity>): string {
    const statusEmojiMap: Record<UserStatus, string> = {
      [UserStatus.Active]: '✅',
      [UserStatus.Restricted]: '⚠️',
      [UserStatus.Banned]: '🚫',
    };

    const statusEmoji = user.status ? statusEmojiMap[user.status] : '❓';

    return (
      `<b>${ctx.t('profile.title')}</b>\n\n` +
      `<b>${ctx.t('profile.name')}:</b> ${user.firstName ?? ctx.t('profile.unknown')}${user.lastName ? ' ' + user.lastName : ''}\n` +
      `<b>${ctx.t('profile.username')}:</b> ${user.username ?? ctx.t('profile.not_set')}\n` +
      `<b>${ctx.t('profile.status')}:</b> ${statusEmoji} ${user.status ?? ctx.t('profile.unknown')}\n` +
      `<b>${ctx.t('profile.referrals')}:</b> ${user.referralCount ?? 0}\n` +
      `<b>${ctx.t('profile.member_since')}:</b> ${this.messageService.formatDate(ctx, user.createdAt)}`
    );
  }

  /**
   * Handle referrals view action
   */
  async handleReferralsView(ctx: AuthenticatedBotContext): Promise<void> {
    const { user } = ctx;
    const em = this.em.fork();

    const [referralCount, referralEarnings, userRefLink] = await Promise.all([
      em.count(UserEntity, { referredBy: user.id }),
      this.calculateReferralEarnings(em, user),
      em.findOne(UserRefLinkEntity, { user: user.id, isDefault: true, isDeleted: false }),
    ]);

    const refCode = userRefLink?.refCode ?? user.telegramId;
    const referralLink = this.generateReferralLink(refCode);
    const referralsText = this.formatReferralsView(ctx, referralCount, referralEarnings, referralLink);
    const keyboard = this.menuHandler.createReferralsViewKeyboard(ctx, referralLink);

    await this.messageService.sendOrEditMessage(ctx, {
      text: referralsText,
      replyMarkup: keyboard,
    });

    this.logger.log('Referrals viewed', { userId: user.id, referralCount });
  }

  /**
   * Handle language settings view (from profile)
   */
  async handleLanguageSettings(ctx: AuthenticatedBotContext): Promise<void> {
    // Use ctx.language (session) as primary source since it's what i18n uses
    const currentLang = ctx.language || ctx.user.language || defaultLanguage;
    const languageText =
      `🌐 <b>${ctx.t('settings.language_title')}</b>\n\n` +
      `${ctx.t('settings.current_language')}: ${this.getLanguageName(currentLang)}\n\n` +
      `${ctx.t('settings.select_language')}`;

    const keyboard = this.menuHandler.createProfileLanguageKeyboard(ctx, currentLang);

    await this.messageService.sendOrEditMessage(ctx, {
      text: languageText,
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle language change (from profile)
   */
  async handleLanguageChange(ctx: AuthenticatedBotContext, languageCode: string): Promise<void> {
    if (!supportedLanguages.includes(languageCode)) {
      await this.messageService.sendNewMessage(ctx, { text: ctx.t('common.errors.invalid_input') });

      return;
    }

    const em = this.em.fork();
    const user = await em.findOne(UserEntity, { id: ctx.user.id });

    if (!user) {
      await this.messageService.sendNewMessage(ctx, { text: ctx.t('common.errors.user_not_found') });

      return;
    }

    user.language = languageCode;
    await em.persistAndFlush(user);

    // Sync language across all places:
    // 1. Update ctx.user (for immediate access)
    ctx.user.language = languageCode;

    // 2. Update Grammy session language
    if (ctx.session) {
      ctx.session.language = languageCode;
    }

    // 3. Update Redis session cache (for BotAuthMiddleware on next request)
    if (ctx.sessionId) {
      await this.botSessionService.updateSessionLanguage(ctx.sessionId, languageCode);
    }

    // 4. Update i18n context language and recreate ctx.t() function
    changeUserLanguage(ctx, languageCode);
    updateContextTranslation(ctx, this.i18n, languageCode);

    // Now ctx.t() uses the new language
    await this.messageService.sendNewMessage(ctx, {
      text: ctx.t('settings.language_changed', { language: this.getLanguageName(languageCode) }),
    });

    this.logger.log('Language changed from profile', { userId: ctx.user.id, language: languageCode });

    await this.handleProfileView(ctx);
  }

  /**
   * Get language display name
   */
  private getLanguageName(code: string): string {
    return languageNames[code] ?? code;
  }

  /**
   * Calculate referral earnings for a user
   */
  private async calculateReferralEarnings(em: EntityManager, user: UserEntity): Promise<number> {
    const referredUsers = await em.find(UserEntity, { referredBy: user.id }, { fields: ['id'] });

    if (referredUsers.length === 0) {
      return 0;
    }

    const userTransactionPromises = referredUsers.map(async (referredUser) => {
      const transactions = await em.find(UserBalanceHistoryEntity, {
        user: referredUser.id,
        status: TransactionStatus.Completed,
        type: { $in: [TransactionType.Deposit, TransactionType.TradeBuy, TransactionType.ReferralBonus] },
      });

      const userTotal = sum(transactions.map((tx) => tx.amount || '0'));

      return toNumber(multiply(userTotal, '0.1'));
    });

    const userEarningsArray = await Promise.all(userTransactionPromises);
    const totalEarnings = sum(userEarningsArray.map((earnings) => earnings.toString()));

    return toNumber(totalEarnings);
  }

  /**
   * Generate referral link for user
   */
  private generateReferralLink(refCode: string): string {
    const botConfig = this.botConfigService.getBotConfig();
    const botUsername = botConfig.username ?? 'bot';

    return `https://t.me/${botUsername}?start=ref_${refCode}`;
  }

  /**
   * Format referrals view text
   */
  private formatReferralsView(ctx: AuthenticatedBotContext, count: number, earnings: number, link: string): string {
    return (
      `<b>${ctx.t('referral.title')}</b>\n\n` +
      `${ctx.t('referral.description')}\n\n` +
      `<b>${ctx.t('referral.stats_title')}</b>\n` +
      `👥 ${ctx.t('referral.invited')}: <b>${count}</b>\n` +
      `💰 ${ctx.t('referral.earned')}: <b>${this.currencySymbol}${toDisplayString(earnings, 2)}</b>\n\n` +
      `<b>${ctx.t('referral.link_title')}</b>\n` +
      `<code>${link}</code>\n\n` +
      `<i>${ctx.t('referral.share_hint')}</i>`
    );
  }
}
