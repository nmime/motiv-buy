import { Injectable, Logger } from '@nestjs/common';
import { EntityManager, LockMode } from '@mikro-orm/core';
import {
  CurrencyCode,
  SourceTransactionStatus,
  SourceTransactionType,
  TrafficSourceBalanceEntity,
  TrafficSourceBalanceHistoryEntity,
  TrafficSourceBalanceRepository,
  TrafficSourceRepository,
  TransactionStatus,
  TransactionType,
  UserBalanceHistoryEntity,
  UserBalanceRepository,
} from '@app/database';
import {
  add,
  decimal,
  Err,
  getErrorMessage,
  greaterThan,
  Ok,
  Result,
  subtract,
  toDbString,
  toNumber,
} from '@app/common-shared';

export interface SourceBalanceDto {
  sourceId: string;
  sourceName: string;
  available: number;
  pending: number;
  totalEarned: number;
  totalWithdrawn: number;
  currency: string;
}

export interface TransferResultDto {
  transferId: string;
  amount: number;
  sourceBalanceAfter: number;
  userBalanceAfter: number;
}

/**
 * Service for Traffic Source Balance operations
 *
 * Handles:
 * - Getting source balance
 * - Adding rewards when tasks complete
 * - Transferring funds to user balance
 */
@Injectable()
export class SourceBalanceService {
  private readonly logger = new Logger(SourceBalanceService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly trafficSourceRepository: TrafficSourceRepository,
    private readonly trafficSourceBalanceRepository: TrafficSourceBalanceRepository,
    private readonly userBalanceRepository: UserBalanceRepository,
  ) {}

  /**
   * Get balance for a traffic source
   */
  async getSourceBalance(
    sourceId: string,
    currencyCode: CurrencyCode = CurrencyCode.Rub,
  ): Promise<SourceBalanceDto | null> {
    const source = await this.trafficSourceRepository.findById(sourceId);
    if (!source) {
      return null;
    }

    const balance = await this.trafficSourceBalanceRepository.findBySourceAndCurrency(sourceId, currencyCode);

    if (!balance) {
      return {
        sourceId,
        sourceName: source.name,
        available: 0,
        pending: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        currency: currencyCode,
      };
    }

    return {
      sourceId,
      sourceName: source.name,
      available: toNumber(decimal(balance.balance)),
      pending: toNumber(decimal(balance.pendingBalance)),
      totalEarned: toNumber(decimal(balance.totalEarned)),
      totalWithdrawn: toNumber(decimal(balance.totalWithdrawn)),
      currency: currencyCode,
    };
  }

  /**
   * Get all source balances for a user (source owner)
   */
  async getUserSourceBalances(
    userId: string,
    currencyCode: CurrencyCode = CurrencyCode.Rub,
  ): Promise<SourceBalanceDto[]> {
    const sources = await this.trafficSourceRepository.findByManager(userId);

    const balancePromises = sources.map((source) => this.getSourceBalance(source.id, currencyCode));
    const balanceResults = await Promise.all(balancePromises);

    return balanceResults.filter((balance): balance is SourceBalanceDto => balance !== null);
  }

  /**
   * Add reward to source balance when task is completed
   * Called by the bot when action is verified
   */
  async addReward(
    sourceId: string,
    amount: string,
    currencyCode: CurrencyCode,
    actionId: string,
    orderId: string,
  ): Promise<Result<TrafficSourceBalanceEntity, Error>> {
    const em = this.em.fork();

    try {
      return await em.transactional(async (txEm) => {
        const balance = await this.trafficSourceBalanceRepository.getOrCreateBalance(sourceId, currencyCode);

        const balanceBefore = balance.balance;

        // Update balance
        balance.balance = toDbString(add(balance.balance, amount), 8);
        balance.totalEarned = toDbString(add(balance.totalEarned, amount), 8);

        // Create history record
        const history = new TrafficSourceBalanceHistoryEntity({
          trafficSourceId: sourceId,
          currency: currencyCode,
          type: SourceTransactionType.TaskReward,
          amount,
          balanceBefore,
          balanceAfter: balance.balance,
          status: SourceTransactionStatus.Completed,
          description: `Reward for order ${orderId}`,
          referenceId: actionId,
          metadata: { orderId },
        });

        txEm.persist(history);
        await txEm.flush();

        this.logger.log(`Added reward ${amount} to source ${sourceId} for action ${actionId}`);

        return Ok(balance);
      });
    } catch (err: unknown) {
      this.logger.error(`Failed to add reward: ${getErrorMessage(err)}`);

      return Err(new Error(`Failed to add reward: ${getErrorMessage(err)}`));
    }
  }

  /**
   * Transfer funds from source balance to user balance
   * Transaction-safe with pessimistic locking
   */
  async transferToUserBalance(
    sourceId: string,
    userId: string,
    amount: string,
    currencyCode: CurrencyCode = CurrencyCode.Rub,
  ): Promise<Result<TransferResultDto, Error>> {
    this.logger.log(`Transfer request: ${amount} from source ${sourceId} to user ${userId}`);

    const em = this.em.fork();

    try {
      return await em.transactional(async (txEm) => {
        // Lock source balance for update
        const sourceBalance = await txEm.findOne(
          TrafficSourceBalanceEntity,
          { trafficSource: sourceId },
          { lockMode: LockMode.PESSIMISTIC_WRITE, populate: ['currency'] },
        );

        if (!sourceBalance) {
          return Err(new Error('Source balance not found'));
        }

        // Check sufficient balance
        if (!greaterThan(sourceBalance.balance, '0') || !greaterThan(amount, '0')) {
          return Err(new Error('Invalid transfer amount'));
        }

        const sourceBalanceDecimal = decimal(sourceBalance.balance);
        const amountDecimal = decimal(amount);

        if (sourceBalanceDecimal.lessThan(amountDecimal)) {
          return Err(new Error(`Insufficient balance. Available: ${sourceBalance.balance}, Requested: ${amount}`));
        }

        // Ensure user balance exists (will be updated below via txEm)
        await this.userBalanceRepository.createOrUpdateBalance(userId, currencyCode, '0');

        const userBalanceEntity = await txEm.findOne(
          'UserBalanceEntity',
          { user: userId, currency: sourceBalance.currency.id },
          { lockMode: LockMode.PESSIMISTIC_WRITE },
        );

        if (!userBalanceEntity) {
          return Err(new Error('Failed to get user balance'));
        }

        // Deduct from source balance
        const sourceBalanceBefore = sourceBalance.balance;
        sourceBalance.balance = toDbString(subtract(sourceBalance.balance, amount), 8);
        sourceBalance.totalWithdrawn = toDbString(add(sourceBalance.totalWithdrawn, amount), 8);

        // Add to user balance
        const userBalanceBefore = (userBalanceEntity as { balance: string }).balance;
        (userBalanceEntity as { balance: string }).balance = toDbString(
          add((userBalanceEntity as { balance: string }).balance, amount),
          8,
        );

        // Create source balance history
        const sourceHistory = new TrafficSourceBalanceHistoryEntity({
          trafficSourceId: sourceId,
          currency: currencyCode,
          type: SourceTransactionType.WithdrawToUser,
          amount,
          balanceBefore: sourceBalanceBefore,
          balanceAfter: sourceBalance.balance,
          status: SourceTransactionStatus.Completed,
          description: 'Transfer to personal balance',
          metadata: { userId },
        });

        txEm.persist(sourceHistory);

        // Create user balance history
        const userHistory = new UserBalanceHistoryEntity({
          userId,
          currency: currencyCode,
          type: TransactionType.TransferIn,
          amount,
          balanceBefore: userBalanceBefore,
          balanceAfter: (userBalanceEntity as { balance: string }).balance,
          status: TransactionStatus.Completed,
          description: 'Transfer from traffic source',
          referenceId: sourceId,
        });

        txEm.persist(userHistory);

        await txEm.flush();

        this.logger.log(
          `Transfer completed: ${amount} from source ${sourceId} to user ${userId}. ` +
            `Source balance: ${sourceBalance.balance}, User balance: ${(userBalanceEntity as { balance: string }).balance}`,
        );

        return Ok({
          transferId: sourceHistory.id,
          amount: toNumber(amountDecimal),
          sourceBalanceAfter: toNumber(decimal(sourceBalance.balance)),
          userBalanceAfter: toNumber(decimal((userBalanceEntity as { balance: string }).balance)),
        });
      });
    } catch (err: unknown) {
      this.logger.error(`Transfer failed: ${getErrorMessage(err)}`);

      return Err(new Error(`Transfer failed: ${getErrorMessage(err)}`));
    }
  }

  /**
   * Transfer ALL available funds from source to user balance
   */
  async transferAllToUserBalance(
    sourceId: string,
    userId: string,
    currencyCode: CurrencyCode = CurrencyCode.Rub,
  ): Promise<Result<TransferResultDto, Error>> {
    const sourceBalance = await this.trafficSourceBalanceRepository.findBySourceAndCurrency(sourceId, currencyCode);

    if (!sourceBalance || !greaterThan(sourceBalance.balance, '0')) {
      return Err(new Error('No available balance to transfer'));
    }

    return this.transferToUserBalance(sourceId, userId, sourceBalance.balance, currencyCode);
  }

  /**
   * Verify user owns the source before allowing transfer
   */
  async verifySourceOwnership(sourceId: string, userId: string): Promise<boolean> {
    const source = await this.trafficSourceRepository.findById(sourceId);

    if (!source) {
      return false;
    }

    const managedBy = source.managedBy?.getEntity();

    return managedBy?.id === userId;
  }
}
