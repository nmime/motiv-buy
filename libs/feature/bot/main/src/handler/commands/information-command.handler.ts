/**
 * Information Command Handler
 *
 * Handles information and utility commands that display static or semi-static
 * content to users. Extracted from CommandHandler to reduce file size.
 */

import { Injectable, Logger } from '@nestjs/common';
import { BotContext } from '@app/feature-bot-shared';
import { AuthUserService } from '@app/feature-auth-shared';
import { BalanceService } from '@app/feature-balance-main';
import { UserRole, UserStatus } from '@app/database';
import { unknownToError, toDisplayString } from '@app/common-shared';
import { SessionService } from '../../service/session.service';

@Injectable()
export class InformationCommandHandler {
  private readonly logger = new Logger(InformationCommandHandler.name);

  constructor(
    private readonly authUserService: AuthUserService,
    private readonly balanceService: BalanceService,
    private readonly sessionService: SessionService,
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

<i>Version 1.0 | Last updated: ${new Date().toLocaleDateString()}</i>
`;

    await ctx.replyWithHTML(helpText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📞 Contact Support', callback_data: 'help:contact' },
            { text: '📚 FAQ', callback_data: 'help:faq' },
          ],
          [{ text: '📋 Main Menu', callback_data: 'menu:main' }],
        ],
      },
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

    await ctx.replyWithHTML(supportText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💬 Contact Support', url: 'https://t.me/motivbuy_support' }],
          [
            { text: '📚 FAQ', callback_data: 'help:faq' },
            { text: '🐛 Report Bug', callback_data: 'help:bug_report' },
          ],
          [{ text: '⬅️ Back', callback_data: 'menu:main' }],
        ],
      },
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

    await ctx.replyWithHTML(languageText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🇺🇸 English', callback_data: 'settings:language:en' },
            { text: '🇪🇸 Español', callback_data: 'settings:language:es' },
          ],
          [
            { text: '🇫🇷 Français', callback_data: 'settings:language:fr' },
            { text: '🇩🇪 Deutsch', callback_data: 'settings:language:de' },
          ],
          [
            { text: '🇷🇺 Русский', callback_data: 'settings:language:ru' },
            { text: '🇨🇳 中文', callback_data: 'settings:language:zh' },
          ],
          [{ text: '⬅️ Back to Settings', callback_data: 'menu:settings' }],
        ],
      },
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

    await ctx.replyWithHTML(verificationText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📧 Verify Email', callback_data: 'verify:email' },
            { text: '📱 Verify Phone', callback_data: 'verify:phone' },
          ],
          [{ text: '🆔 Identity Verification', callback_data: 'verify:identity' }],
          [{ text: '⬅️ Back', callback_data: 'menu:profile' }],
        ],
      },
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

    await ctx.replyWithHTML(exportText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💰 Transactions', callback_data: 'export:transactions' },
            { text: '📈 Analytics', callback_data: 'export:analytics' },
          ],
          [
            { text: '🎯 Traffic Reports', callback_data: 'export:traffic' },
            { text: '📋 Account Summary', callback_data: 'export:summary' },
          ],
          [{ text: '📦 Full Archive', callback_data: 'export:full' }],
          [{ text: '⬅️ Back', callback_data: 'menu:settings' }],
        ],
      },
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

    await ctx.replyWithHTML(resetText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🗂️ Reset Session Data', callback_data: 'reset:session' }],
          [
            { text: '🔔 Reset Notifications', callback_data: 'reset:notifications' },
            { text: '⚙️ Reset Preferences', callback_data: 'reset:preferences' },
          ],
          [{ text: '🧹 Clear Cache', callback_data: 'reset:cache' }],
          [{ text: '❌ Cancel', callback_data: 'menu:settings' }],
        ],
      },
    });
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
        await ctx.reply(ctx.t('common.errors.user_not_found'));

        return;
      }

      const session = await this.sessionService.getSession(userId);
      const balance = await this.balanceService.getBalance(user.id);

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
• Member since: ${new Date(user.createdAt).toLocaleDateString()}

<b>💰 Financial Status:</b>
• Current balance: $${toDisplayString(balance.availableAmount)}
• Total earned: $${toDisplayString(balance.totalEarned)}
• Last transaction: ${balance.lastTransactionAt ? new Date(balance.lastTransactionAt).toLocaleDateString() : 'None'}

<b>📱 Session Info:</b>
• Session active: ${session ? '✅ Yes' : '❌ No'}
• Last active: ${session ? new Date(session.updatedAt).toLocaleString() : 'Unknown'}
• Current location: ${session?.data.navigationState?.currentLocation || 'Unknown'}

<b>🔔 Notifications:</b>
• Push notifications: ${session?.data.preferences?.notifications?.enablePush ? '✅ Enabled' : '❌ Disabled'}
• Language: ${session?.data.preferences?.language || 'en'}
`;

      await ctx.replyWithHTML(statusText, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Refresh Status', callback_data: 'status:refresh' }],
            [
              { text: '⚙️ Settings', callback_data: 'menu:settings' },
              { text: '📋 Main Menu', callback_data: 'menu:main' },
            ],
          ],
        },
      });
    } catch (err: unknown) {
      this.logger.error('Error fetching status', {
        error: unknownToError(err),
        userId,
      });

      await ctx.reply(ctx.t('common.errors.status_fetch_error'));
    }
  }
}
