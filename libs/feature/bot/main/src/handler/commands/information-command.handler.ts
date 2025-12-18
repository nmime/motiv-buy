/**
 * Information Command Handler
 *
 * Handles information and utility commands that display static or semi-static
 * content to users. Extracted from CommandHandler to reduce file size.
 */

import { Injectable, Logger } from '@nestjs/common';
import { BotContext } from '@app/feature-bot-shared';
import { AuthUserService } from '@app/feature-auth-shared';
import { BalanceQueryService } from '@app/feature-balance-shared';
import { UserRole, UserStatus } from '@app/database';
import { defaultLanguage, unknownToError, toDisplayString } from '@app/common-shared';
import { SessionService } from '../../service/session.service';
import { MessageService } from '../../service/message.service';
import { InlineKeyboard } from 'grammy';

@Injectable()
export class InformationCommandHandler {
  private readonly logger = new Logger(InformationCommandHandler.name);

  constructor(
    private readonly authUserService: AuthUserService,
    private readonly balanceQueryService: BalanceQueryService,
    private readonly sessionService: SessionService,
    private readonly messageService: MessageService,
  ) {}

  /**
   * Handle /help command - comprehensive help information
   */
  async handleHelpCommand(ctx: BotContext): Promise<void> {
    const helpText = `
<b>🤖 MotivBuy Bot Help Center</b>

<b>📋 Available Commands:</b>
/start - Start or restart the bot
/menu - Open main menu
/profile - View your profile
/balance - Check your balance and earnings
/stats - View detailed statistics
/campaign - Manage your campaigns
/traffic - Traffic analytics
/withdraw - Request withdrawals
/referral - Referral program
/settings - Manage preferences
/help - Show this help message
/support - Contact support team
/status - Check account status

<b>🎯 Main Features:</b>
• <b>Campaign Tracking</b> - Monitor all your traffic campaigns
• <b>Real-time Analytics</b> - Live performance metrics
• <b>Balance Management</b> - Track earnings and request withdrawals
• <b>Traffic Sources</b> - Manage multiple traffic channels
• <b>Referral System</b> - Earn by inviting others
• <b>Detailed Reports</b> - Export comprehensive analytics

<b>🚀 Quick Actions:</b>
• Use inline buttons for faster navigation
• Check your balance with /balance
• View live stats with /stats
• Access settings with /settings

<b>💡 Tips:</b>
• Keep your profile updated for better service
• Enable notifications to stay informed
• Use the referral program to earn extra income
• Check analytics regularly to optimize performance

<b>🆘 Need Help?</b>
• Use /support for direct assistance
• Check our FAQ in the help menu
• Contact support: @motivbuy_support

<i>Version 1.0 | Last updated: ${this.messageService.formatDate(ctx, new Date())}</i>
`;

    const keyboard = new InlineKeyboard()
      .text('📞 Contact Support', 'help:contact')
      .text('📚 FAQ', 'help:faq')
      .row()
      .text('📋 Main Menu', 'menu:main');

    await this.messageService.sendNewMessage(ctx, {
      text: helpText,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle /support command - contact support
   */
  async handleSupportCommand(ctx: BotContext): Promise<void> {
    const supportText = `
<b>🆘 Support & Contact</b>

<b>📧 Contact Methods:</b>
• Telegram Support: @motivbuy_support
• Email: support@motivbuy.com
• Response time: Usually within 2-4 hours

<b>🔥 Quick Help:</b>
• Check our FAQ for common questions
• Use /help for bot commands
• Report bugs or issues directly

<b>📋 When contacting support, please include:</b>
• Your user ID: ${ctx.from?.id || 'Unknown'}
• Description of the issue
• Screenshots if applicable
• Steps to reproduce the problem

<b>🕐 Support Hours:</b>
Monday - Friday: 9:00 AM - 6:00 PM UTC
Weekend: Limited support available

<i>We're here to help you succeed! 🚀</i>
`;

    const keyboard = new InlineKeyboard()
      .url('💬 Contact Support', 'https://t.me/motivbuy_support')
      .row()
      .text('📚 FAQ', 'help:faq')
      .text('🐛 Report Bug', 'help:bug_report')
      .row()
      .text('⬅️ Back', 'menu:main');

    await this.messageService.sendNewMessage(ctx, {
      text: supportText,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle /language command - language selection
   */
  async handleLanguageCommand(ctx: BotContext): Promise<void> {
    const languageText = `
<b>🌍 Language Settings</b>

Select your preferred language:

<i>Currently supported languages:</i>
`;

    const keyboard = new InlineKeyboard()
      .text('🇺🇸 English', 'settings:language:en')
      .text('🇪🇸 Español', 'settings:language:es')
      .row()
      .text('🇫🇷 Français', 'settings:language:fr')
      .text('🇩🇪 Deutsch', 'settings:language:de')
      .row()
      .text('🇷🇺 Русский', 'settings:language:ru')
      .text('🇨🇳 中文', 'settings:language:zh')
      .row()
      .text('⬅️ Back to Settings', 'menu:settings');

    await this.messageService.sendNewMessage(ctx, {
      text: languageText,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle /verify command - account verification
   */
  async handleVerifyCommand(ctx: BotContext): Promise<void> {
    const verificationText = `
<b>✅ Account Verification</b>

Verify your account to unlock all features:

<b>🔒 Current Status:</b>
• Identity: Not verified
• Email: Not verified
• Phone: Not verified
• Payment methods: Basic

<b>🎯 Verification Benefits:</b>
• Higher withdrawal limits
• Priority support
• Advanced analytics
• Premium features access
• Enhanced security

<b>📋 Required Documents:</b>
• Government-issued ID
• Proof of address
• Email confirmation
`;

    const keyboard = new InlineKeyboard()
      .text('📧 Verify Email', 'verify:email')
      .text('📱 Verify Phone', 'verify:phone')
      .row()
      .text('🆔 Identity Verification', 'verify:identity')
      .row()
      .text('⬅️ Back', 'menu:profile');

    await this.messageService.sendNewMessage(ctx, {
      text: verificationText,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle /export command - data export
   */
  async handleExportCommand(ctx: BotContext): Promise<void> {
    const exportText = `
<b>📥 Data Export</b>

Export your data in various formats:

<b>📊 Available Exports:</b>
• Transaction history (CSV, PDF)
• Campaign analytics (Excel, PDF)
• Traffic reports (CSV, JSON)
• Account summary (PDF)
• Full data archive (ZIP)

<b>⏰ Processing Time:</b>
• Small reports: Instant
• Large datasets: 5-10 minutes
• Full archive: Up to 30 minutes

<i>Exported files will be sent as documents to this chat.</i>
`;

    const keyboard = new InlineKeyboard()
      .text('💰 Transactions', 'export:transactions')
      .text('📈 Analytics', 'export:analytics')
      .row()
      .text('🎯 Traffic Reports', 'export:traffic')
      .text('📋 Account Summary', 'export:summary')
      .row()
      .text('📦 Full Archive', 'export:full')
      .row()
      .text('⬅️ Back', 'menu:settings');

    await this.messageService.sendNewMessage(ctx, {
      text: exportText,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle /reset command - reset account data
   */
  async handleResetCommand(ctx: BotContext): Promise<void> {
    const resetText = `
<b>🔄 Reset Account Data</b>

<b>⚠️ WARNING:</b> This action will reset various parts of your account data.

<b>🔴 What can be reset:</b>
• Session data and preferences
• Cached analytics data
• Notification settings
• Menu navigation history
• Temporary form data

<b>✅ What remains unchanged:</b>
• Your account and profile
• Balance and transactions
• Campaign data
• Traffic history
• Referral information

<i>Choose what you want to reset:</i>
`;

    const keyboard = new InlineKeyboard()
      .text('🗂️ Reset Session Data', 'reset:session')
      .row()
      .text('🔔 Reset Notifications', 'reset:notifications')
      .text('⚙️ Reset Preferences', 'reset:preferences')
      .row()
      .text('🧹 Clear Cache', 'reset:cache')
      .row()
      .text('❌ Cancel', 'menu:settings');

    await this.messageService.sendNewMessage(ctx, {
      text: resetText,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle /balance command - show balance information
   */
  async handleBalanceCommand(ctx: BotContext): Promise<void> {
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return;
    }

    try {
      const user = await this.authUserService.findByPlatformId(userId);
      if (!user) {
        await this.messageService.sendNewMessage(ctx, { text: ctx.t('common.errors.user_not_found') });

        return;
      }

      const balance = await this.balanceQueryService.getBalance(user.id);

      const balanceText = `
<b>💰 Your Balance</b>

<b>💵 Current Balance:</b> $${toDisplayString(balance.availableAmount)}
<b>🔒 Pending:</b> $${toDisplayString(balance.pendingAmount)}
<b>📊 Total Earned:</b> $${toDisplayString(balance.totalEarned)}

<b>📈 Recent Activity:</b>
• Last transaction: ${balance.lastTransactionAt ? this.messageService.formatDate(ctx, new Date(balance.lastTransactionAt)) : 'No transactions yet'}
• Account created: ${this.messageService.formatDate(ctx, user.createdAt)}

<b>💸 Withdrawal Status:</b>
• Available for withdrawal: $${toDisplayString(balance.availableAmount)}
• Minimum withdrawal: $10.00
`;

      const keyboard = new InlineKeyboard()
        .text('💸 Withdraw', 'menu:withdrawal')
        .text('📈 History', 'balance:history')
        .row()
        .text('📊 Analytics', 'balance:analytics')
        .text('🔄 Refresh', 'balance:current')
        .row()
        .text('⬅️ Back', 'menu:main');

      await this.messageService.sendNewMessage(ctx, {
        text: balanceText,
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });
    } catch (err: unknown) {
      this.logger.error('Error fetching balance', {
        error: unknownToError(err),
        userId,
      });

      await this.messageService.sendNewMessage(ctx, { text: ctx.t('common.errors.fetch_failed') });
    }
  }

  /**
   * Handle /status command - show account status
   */
  async handleStatusCommand(ctx: BotContext): Promise<void> {
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return;
    }

    try {
      const user = await this.authUserService.findByPlatformId(userId);
      if (!user) {
        await this.messageService.sendNewMessage(ctx, { text: ctx.t('common.errors.user_not_found') });

        return;
      }

      const session = await this.sessionService.getSession(userId);
      const balance = await this.balanceQueryService.getBalance(user.id);

      const statusText = `
<b>📊 Account Status</b>

<b>👤 Profile Information:</b>
• Name: ${user.firstName} ${user.lastName || ''}
• Username: ${user.username || 'Not set'}
• User ID: ${user.id}
• Platform ID: ${userId}

<b>🔐 Account Status:</b>
• Status: ${user.status === UserStatus.Active ? '✅ Active' : '❌ Inactive'}
• Role: ${user.role !== UserRole.User ? '✅ Admin' : '❌ User'}
• Member since: ${this.messageService.formatDate(ctx, user.createdAt)}

<b>💰 Financial Status:</b>
• Current balance: $${toDisplayString(balance.availableAmount)}
• Total earned: $${toDisplayString(balance.totalEarned)}
• Last transaction: ${balance.lastTransactionAt ? this.messageService.formatDate(ctx, new Date(balance.lastTransactionAt)) : 'None'}

<b>📱 Session Info:</b>
• Session active: ${session ? '✅ Yes' : '❌ No'}
• Last active: ${session ? this.messageService.formatDateTime(ctx, new Date(session.updatedAt)) : 'Unknown'}
• Current location: ${session?.data.navigationState?.currentLocation || 'Unknown'}

<b>🔔 Notifications:</b>
• Push notifications: ${session?.data.preferences?.notifications?.enablePush ? '✅ Enabled' : '❌ Disabled'}
• Language: ${session?.data.preferences?.language || defaultLanguage}
`;

      const keyboard = new InlineKeyboard()
        .text(ctx.t('common.buttons.refresh'), 'status:refresh')
        .row()
        .text(ctx.t('settings.title'), 'menu:settings')
        .text(ctx.t('bot.menu.main'), 'menu:main');

      await this.messageService.sendNewMessage(ctx, {
        text: statusText,
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });
    } catch (err: unknown) {
      this.logger.error('Error fetching status', {
        error: unknownToError(err),
        userId,
      });

      await this.messageService.sendNewMessage(ctx, { text: ctx.t('common.errors.status_fetch_error') });
    }
  }
}
