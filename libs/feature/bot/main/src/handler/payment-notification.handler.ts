import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { PaymentEventService, BalanceCreditedEvent } from '@app/feature-payment-shared';
import { UserEntity } from '@app/database';
import { toDisplayString } from '@app/common-shared';
import { I18nService } from 'nestjs-i18n';
import { BotService } from '../service/bot.service';

/**
 * Handles payment event notifications.
 * Listens for payment events and sends Telegram notifications to users.
 */
@Injectable()
export class PaymentNotificationHandler implements OnModuleInit {
  private readonly logger = new Logger(PaymentNotificationHandler.name);

  constructor(
    private readonly paymentEventService: PaymentEventService,
    private readonly em: EntityManager,
    private readonly botService: BotService,
    private readonly i18n: I18nService,
  ) {}

  onModuleInit(): void {
    this.paymentEventService.onBalanceCredited((event) => this.handleBalanceCredited(event));
    this.logger.log('Registered payment notification listener');
  }

  private async handleBalanceCredited(event: BalanceCreditedEvent): Promise<void> {
    try {
      // Fork EntityManager to avoid global context issues in async event handlers
      const em = this.em.fork();
      const user = await em.findOne(UserEntity, { id: event.userId });

      if (!user) {
        this.logger.warn(`User not found for notification: ${event.userId}`);

        return;
      }

      const amount = toDisplayString(event.amount, 8);
      const { currency } = event;
      const locale = user.language || 'en';

      const message = this.i18n.t('balance.deposit_success_notification', {
        lang: locale,
        args: { amount, currency },
      });

      await this.botService.sendDirectMessage(user.telegramId, String(message));
      this.logger.log(`Payment notification sent to user ${user.id}`);
    } catch (error) {
      this.logger.error(`Failed to send payment notification for ${event.transactionId}`, error);
    }
  }
}
