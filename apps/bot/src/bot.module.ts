import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BotMainModule } from '@app/feature-bot-main';
import { TrafficMainModule } from '@app/feature-traffic-main';
import { NotificationMainModule } from '@app/feature-notification-main';
import { BotService } from './service';
import {
  CallbackRouterHandler,
  MenuActionHandler,
  ProfileActionHandler,
  BalanceActionHandler,
  StatisticsActionHandler,
  OrderActionHandler,
  SettingsActionHandler,
} from '@app/feature-bot-main';
import { ModerationActionHandler } from '@app/feature-traffic-main';

/**
 * Bot Application Module
 *
 * Thin composition root that wires up domain modules for bot functionality.
 * No business logic should be implemented here.
 *
 * Integrates notification system for scheduled notifications and event processing.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Bot domain module - contains all business logic
    BotMainModule,

    // Traffic domain module - integrates with bot and notification systems
    TrafficMainModule,

    // Notification module - enables scheduled notification processing
    NotificationMainModule,
  ],
  providers: [
    // Thin wrapper service
    BotService,

    // Handlers from BotMainModule (only needed in Bot app, not API)
    CallbackRouterHandler,
    MenuActionHandler,
    ProfileActionHandler,
    BalanceActionHandler,
    StatisticsActionHandler,
    OrderActionHandler,
    SettingsActionHandler,
    ModerationActionHandler,
  ],
  exports: [BotService],
})
export class BotModule {}
