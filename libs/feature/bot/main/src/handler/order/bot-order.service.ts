/**
 * Bot Order Service
 *
 * Bot-specific order service that wraps the core OrderService
 * and adds session-based state management for order creation flows.
 */

import { Injectable, Logger } from '@nestjs/common';
import { BotContext, ChannelService } from '@app/feature-bot-shared';
import { IChannelService, OrderService } from '@app/feature-order-main';
import {
  defaultOrderConfig,
  OrderConfiguration,
  OrderCreationOrigin,
  OrderFlowStep,
  OrderSessionState,
} from '@app/feature-order-shared';

@Injectable()
export class BotOrderService extends OrderService {
  private readonly botLogger = new Logger(BotOrderService.name);

  // Session cleanup interval (1 hour)
  private readonly sessionTtlMs = 60 * 60 * 1000;
  private readonly sessionCleanupIntervalMs = 15 * 60 * 1000;

  constructor(channelService: ChannelService) {
    super(channelService as IChannelService);
    this.startSessionCleanup();
  }

  /**
   * Get order session state from context (checks TTL)
   */
  getOrderSessionState(ctx: BotContext): OrderSessionState | null {
    const state = (ctx.session?.formData?.orderCreation as OrderSessionState & { expiresAt?: number }) || null;

    if (!state) {
      return null;
    }

    // Check if session is expired
    if (state.expiresAt && Date.now() > state.expiresAt) {
      this.botLogger.warn('Session expired, clearing state');
      this.clearOrderSessionState(ctx);

      return null;
    }

    return state;
  }

  /**
   * Save order session state to context with TTL
   */
  saveOrderSessionState(ctx: BotContext, state: OrderSessionState): void {
    if (!ctx.session) {
      ctx.session = {};
    }

    if (!ctx.session.formData) {
      ctx.session.formData = {};
    }

    // Add TTL metadata
    const stateWithTTL = {
      ...state,
      expiresAt: Date.now() + this.sessionTtlMs,
    };

    ctx.session.formData.orderCreation = stateWithTTL;
  }

  /**
   * Clear order session state
   */
  clearOrderSessionState(ctx: BotContext): void {
    if (ctx.session?.formData) {
      delete ctx.session.formData.orderCreation;
    }
  }

  /**
   * Initialize order creation flow
   */
  initOrderCreation(ctx: BotContext, origin: OrderCreationOrigin = 'orders_list'): OrderSessionState {
    const state: OrderSessionState = {
      currentStep: OrderFlowStep.EnterChannelLink,
      config: { ...defaultOrderConfig },
      startedAt: new Date(),
      origin,
    };

    this.saveOrderSessionState(ctx, state);

    return state;
  }

  /**
   * Move to next step in order creation
   */
  moveToNextStep(ctx: BotContext, nextStep: OrderFlowStep): void {
    const state = this.getOrderSessionState(ctx);
    if (state) {
      state.currentStep = nextStep;
      this.saveOrderSessionState(ctx, state);
    }
  }

  /**
   * Update order creation config
   */
  updateOrderCreationConfig(ctx: BotContext, config: Partial<OrderConfiguration>): void {
    const state = this.getOrderSessionState(ctx);
    if (state) {
      state.config = {
        ...state.config,
        ...config,
      };

      this.saveOrderSessionState(ctx, state);
    }
  }

  /**
   * Start session cleanup interval
   */
  private startSessionCleanup(): void {
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.sessionCleanupIntervalMs);
  }

  /**
   * Cleanup expired sessions
   */
  private cleanupExpiredSessions(): void {
    // Session cleanup is handled by Redis TTL automatically
    // This method is kept for future database-backed session cleanup if needed
  }
}

// Re-export types for convenience
export {
  Order,
  OrderConfiguration,
  OrderCreationOrigin,
  OrderFlowStep,
  OrderSessionState,
  OrderStatus,
  ChannelInfo,
  defaultOrderConfig,
} from '@app/feature-order-shared';
