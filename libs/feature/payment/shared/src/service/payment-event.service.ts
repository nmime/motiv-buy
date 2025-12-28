import { Injectable, Logger } from '@nestjs/common';

/**
 * Payment event data for balance credited event
 */
export interface BalanceCreditedEvent {
  transactionId: string;
  userId: string;
  amount: string;
  currency: string;
}

/**
 * Callback type for balance credited events
 */
export type BalanceCreditedCallback = (event: BalanceCreditedEvent) => void | Promise<void>;

/**
 * Simple event emitter for payment events.
 * Allows other modules to subscribe to payment events without circular dependencies.
 */
@Injectable()
export class PaymentEventService {
  private readonly logger = new Logger(PaymentEventService.name);
  private readonly balanceCreditedListeners: BalanceCreditedCallback[] = [];

  /**
   * Register a listener for balance credited events
   */
  onBalanceCredited(callback: BalanceCreditedCallback): void {
    this.balanceCreditedListeners.push(callback);
    this.logger.debug(`Registered balance credited listener (total: ${this.balanceCreditedListeners.length})`);
  }

  /**
   * Emit a balance credited event to all registered listeners
   */
  async emitBalanceCredited(event: BalanceCreditedEvent): Promise<void> {
    this.logger.debug(`Emitting balance credited event for transaction ${event.transactionId}`);

    const promises = this.balanceCreditedListeners.map(async (listener) => {
      try {
        await listener(event);
      } catch (error) {
        this.logger.error('Error in balance credited listener', error);
      }
    });

    await Promise.all(promises);
  }
}
