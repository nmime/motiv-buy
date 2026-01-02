import { Injectable, Logger } from '@nestjs/common';
import { EntityManager, LockMode, ref } from '@mikro-orm/core';
import {
  CurrencyCode,
  SourceTransactionStatus,
  SourceTransactionType,
  TrafficActionsEntity,
  TrafficActionStatus,
  TrafficActionType,
  TrafficOrderBalanceEntity,
  TrafficOrderEntity,
  TrafficOrderStatus,
  TrafficSourceBalanceEntity,
  TrafficSourceBalanceHistoryEntity,
  TrafficSourceEntity,
} from '@app/database';
import { add, Err, getErrorMessage, greaterThanOrEqual, Ok, Result, subtract, toDbString } from '@app/common-shared';

export interface ActionCompletionDto {
  orderId: string;
  sourceId: string;
  userId: number;
  actionType: TrafficActionType;
  reward?: string;
}

export interface ActionCompletionResultDto {
  actionId: string;
  reward: string;
  sourceBalanceAfter: string;
  orderBalanceAfter: string;
}

/**
 * Service for handling Traffic Action completion and money flow
 *
 * MONEY FLOW:
 * 1. Order creator pre-pays → TrafficOrderBalanceEntity (escrow)
 * 2. User completes action (join channel, etc.) → detected by bot
 * 3. This service: TrafficOrderBalanceEntity → TrafficSourceBalanceEntity
 * 4. Source owner transfers → UserBalanceEntity (via SourceBalanceService)
 */
@Injectable()
export class TrafficActionService {
  private readonly logger = new Logger(TrafficActionService.name);

  constructor(private readonly em: EntityManager) {}

  /**
   * Complete an action and credit the source balance
   * Called by bot when user completes a task (e.g., joins channel)
   *
   * Transaction-safe with pessimistic locking
   */
  async completeAction(dto: ActionCompletionDto): Promise<Result<ActionCompletionResultDto, Error>> {
    this.logger.log(`Completing action for order ${dto.orderId}, source ${dto.sourceId}, user ${dto.userId}`);

    const em = this.em.fork();

    try {
      return await em.transactional(async (txEm) => {
        // Lock order for update
        const order = await txEm.findOne(
          TrafficOrderEntity,
          { orderId: dto.orderId },
          { lockMode: LockMode.PESSIMISTIC_WRITE },
        );

        if (!order) {
          return Err(new Error('Order not found'));
        }

        if (order.status !== TrafficOrderStatus.Active) {
          return Err(new Error('Order is not active'));
        }

        // Check if action already exists for this user
        const existingAction = await txEm.findOne(TrafficActionsEntity, {
          trafficOrder: order.id,
          trafficSource: dto.sourceId,
          actionData: { userId: dto.userId },
        });

        if (existingAction) {
          if (existingAction.status === TrafficActionStatus.Completed) {
            return Err(new Error('Action already completed'));
          }

          // Update existing action
          return this.updateExistingAction(txEm, existingAction, order, dto);
        }

        // Create new action and process payment
        return this.createNewAction(txEm, order, dto);
      });
    } catch (err: unknown) {
      this.logger.error(`Action completion failed: ${getErrorMessage(err)}`);

      return Err(new Error(`Action completion failed: ${getErrorMessage(err)}`));
    }
  }

  /**
   * Check if a user has already completed an action for an order
   */
  async hasCompletedAction(orderId: string, sourceId: string, userId: number): Promise<boolean> {
    const action = await this.em.findOne(TrafficActionsEntity, {
      trafficOrder: { orderId },
      trafficSource: sourceId,
      actionData: { userId },
      status: TrafficActionStatus.Completed,
    });

    return action !== null;
  }

  /**
   * Get action status for a user
   */
  async getActionStatus(
    orderId: string,
    sourceId: string,
    userId: number,
  ): Promise<{ status: TrafficActionStatus; reward?: string } | null> {
    const action = await this.em.findOne(TrafficActionsEntity, {
      trafficOrder: { orderId },
      trafficSource: sourceId,
      actionData: { userId },
    });

    if (!action) {
      return null;
    }

    return {
      status: action.status,
      reward: action.status === TrafficActionStatus.Completed ? action.reward : undefined,
    };
  }

  // =====================================
  // PRIVATE HELPER METHODS
  // =====================================

  private async updateExistingAction(
    txEm: EntityManager,
    action: TrafficActionsEntity,
    order: TrafficOrderEntity,
    dto: ActionCompletionDto,
  ): Promise<Result<ActionCompletionResultDto, Error>> {
    const reward = dto.reward || order.pricePerAction;

    // Process the payment from order balance to source balance
    const paymentResult = await this.processPayment(txEm, order, dto.sourceId, reward);

    if (paymentResult.err) {
      return paymentResult;
    }

    // Update action status using assign to avoid param-reassign lint error
    Object.assign(action, {
      status: TrafficActionStatus.Completed,
      reward,
      completedAt: new Date(),
    });

    // Update order counts
    this.updateOrderProgress(order);

    await txEm.flush();

    this.logger.log(`Action ${action.actionId} completed with reward ${reward}`);

    return Ok({
      actionId: action.actionId,
      reward,
      sourceBalanceAfter: paymentResult.val.sourceBalanceAfter,
      orderBalanceAfter: paymentResult.val.orderBalanceAfter,
    });
  }

  private async createNewAction(
    txEm: EntityManager,
    order: TrafficOrderEntity,
    dto: ActionCompletionDto,
  ): Promise<Result<ActionCompletionResultDto, Error>> {
    const reward = dto.reward || order.pricePerAction;
    const actionId = `${dto.orderId}-${dto.sourceId.substring(0, 8)}-${dto.userId}-${Date.now()}`;

    // Process the payment from order balance to source balance
    const paymentResult = await this.processPayment(txEm, order, dto.sourceId, reward);

    if (paymentResult.err) {
      return paymentResult;
    }

    // Create the action record
    const action = new TrafficActionsEntity({
      actionId,
      type: dto.actionType,
      status: TrafficActionStatus.Completed,
      reward,
      completedAt: new Date(),
      actionData: { userId: dto.userId },
      trafficSourceId: dto.sourceId,
      trafficOrderId: order.id,
    });

    txEm.persist(action);

    // Update order counts
    this.updateOrderProgress(order);

    await txEm.flush();

    this.logger.log(`New action ${actionId} created with reward ${reward}`);

    return Ok({
      actionId,
      reward,
      sourceBalanceAfter: paymentResult.val.sourceBalanceAfter,
      orderBalanceAfter: paymentResult.val.orderBalanceAfter,
    });
  }

  private updateOrderProgress(order: TrafficOrderEntity): void {
    const newCount = order.currentCount + 1;

    Object.assign(order, { currentCount: newCount });

    if (newCount >= order.targetCount) {
      Object.assign(order, {
        status: TrafficOrderStatus.Completed,
        completedAt: new Date(),
      });
    }
  }

  private async processPayment(
    txEm: EntityManager,
    order: TrafficOrderEntity,
    sourceId: string,
    reward: string,
  ): Promise<Result<{ sourceBalanceAfter: string; orderBalanceAfter: string }, Error>> {
    // Lock order balance for update
    const orderBalance = await txEm.findOne(
      TrafficOrderBalanceEntity,
      { trafficOrder: order.id },
      { lockMode: LockMode.PESSIMISTIC_WRITE, populate: ['currency'] },
    );

    if (!orderBalance) {
      return Err(new Error('Order balance not found'));
    }

    // Check sufficient balance
    if (!greaterThanOrEqual(orderBalance.availableAmount, reward)) {
      return Err(new Error('Insufficient order balance'));
    }

    // Get currency code from order balance
    const currencyEntity = orderBalance.currency.getEntity();
    const currencyCode = currencyEntity.code as CurrencyCode;

    // Get or create source balance
    let sourceBalance = await txEm.findOne(
      TrafficSourceBalanceEntity,
      { trafficSource: sourceId, currency: currencyEntity.id },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    );

    if (!sourceBalance) {
      const sourceRef = txEm.getReference(TrafficSourceEntity, sourceId);

      sourceBalance = new TrafficSourceBalanceEntity({
        trafficSource: ref(sourceRef),
        currency: ref(currencyEntity),
      });

      txEm.persist(sourceBalance);
    }

    // Calculate new balances
    const newAvailableAmount = toDbString(subtract(orderBalance.availableAmount, reward), 8);
    const newSpentAmount = toDbString(add(orderBalance.spentAmount, reward), 8);
    const sourceBalanceBefore = sourceBalance.balance;
    const newSourceBalance = toDbString(add(sourceBalance.balance, reward), 8);
    const newTotalEarned = toDbString(add(sourceBalance.totalEarned, reward), 8);

    // Update order balance
    Object.assign(orderBalance, {
      availableAmount: newAvailableAmount,
      spentAmount: newSpentAmount,
    });

    // Update source balance
    Object.assign(sourceBalance, {
      balance: newSourceBalance,
      totalEarned: newTotalEarned,
    });

    // Create source balance history record
    const history = new TrafficSourceBalanceHistoryEntity({
      trafficSourceId: sourceId,
      currency: currencyCode,
      type: SourceTransactionType.TaskReward,
      amount: reward,
      balanceBefore: sourceBalanceBefore,
      balanceAfter: newSourceBalance,
      status: SourceTransactionStatus.Completed,
      description: `Reward for order ${order.orderId}`,
      referenceId: order.id,
      metadata: { orderId: order.orderId },
    });

    txEm.persist(history);

    this.logger.log(
      `Payment processed: ${reward} from order ${order.orderId} to source ${sourceId}. ` +
        `Order balance: ${newAvailableAmount}, Source balance: ${newSourceBalance}`,
    );

    return Ok({
      sourceBalanceAfter: newSourceBalance,
      orderBalanceAfter: newAvailableAmount,
    });
  }
}
