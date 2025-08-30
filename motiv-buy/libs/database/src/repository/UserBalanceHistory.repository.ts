import {EntityManager, EntityRepository, QueryOrder} from '@mikro-orm/core';
import {TransactionStatus, TransactionType, UserBalanceHistoryEntity} from '../entity/UserBalanceHistory.entity';
import {UserEntity} from '../entity/User.entity';
import {CurrencyType} from '../entity/UserBalance.entity';

export class UserBalanceHistoryRepository extends EntityRepository<UserBalanceHistoryEntity> {
  constructor(em: EntityManager) {
    super(em, UserBalanceHistoryEntity);
  }

  async findByUser(
    user: UserEntity,
    limit: number = 50,
    offset: number = 0
  ): Promise<UserBalanceHistoryEntity[]> {
    return this.find(
      { user },
      {
        orderBy: { createdAt: QueryOrder.DESC },
        limit,
        offset,
        populate: ['user']
      }
    );
  }

  async findByUserAndCurrency(
    user: UserEntity,
    currency: CurrencyType,
    limit: number = 50
  ): Promise<UserBalanceHistoryEntity[]> {
    return this.find(
      { user, currency },
      {
        orderBy: { createdAt: QueryOrder.DESC },
        limit,
        populate: ['user']
      }
    );
  }

  async findByTransactionType(
    type: TransactionType,
    limit: number = 50
  ): Promise<UserBalanceHistoryEntity[]> {
    return this.find(
      { type },
      {
        orderBy: { createdAt: QueryOrder.DESC },
        limit,
        populate: ['user']
      }
    );
  }

  async findByStatus(
    status: TransactionStatus,
    limit: number = 50
  ): Promise<UserBalanceHistoryEntity[]> {
    return this.find(
      { status },
      {
        orderBy: { createdAt: QueryOrder.DESC },
        limit,
        populate: ['user']
      }
    );
  }

  async findByReferenceId(referenceId: string): Promise<UserBalanceHistoryEntity | null> {
    return this.findOne({ referenceId });
  }

  async createTransaction(data: {
    user: UserEntity;
    currency: CurrencyType;
    type: TransactionType;
    amount: string;
    balanceBefore: string;
    balanceAfter: string;
    description?: string;
    txHash?: string;
    referenceId?: string;
    metadata?: Record<string, any>;
    status?: TransactionStatus;
  }): Promise<UserBalanceHistoryEntity> {
    const transaction = new UserBalanceHistoryEntity(
      data.user,
      data.currency,
      data.type,
      data.amount,
      data.balanceBefore,
      data.balanceAfter
    );

    if (data.description) transaction.description = data.description;
    if (data.txHash) transaction.txHash = data.txHash;
    if (data.referenceId) transaction.referenceId = data.referenceId;
    if (data.metadata) transaction.metadata = data.metadata;
    if (data.status) transaction.status = data.status;

    await this.em.persistAndFlush(transaction);
    return transaction;
  }

  async updateStatus(id: number, status: TransactionStatus): Promise<void> {
    const transaction = await this.findOne(id);
    if (transaction) {
      transaction.status = status;
      await this.em.flush();
    }
  }

  async getTransactionStats(
    user?: UserEntity,
    currency?: CurrencyType,
    days: number = 30
  ): Promise<{
    totalTransactions: number;
    totalVolume: string;
    successfulTransactions: number;
    failedTransactions: number;
  }> {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const conditions: any = {
      createdAt: { $gte: dateFrom }
    };

    if (user) conditions.user = user;
    if (currency) conditions.currency = currency;

    const [total, successful, failed] = await Promise.all([
      this.count(conditions),
      this.count({ ...conditions, status: TransactionStatus.COMPLETED }),
      this.count({ ...conditions, status: TransactionStatus.FAILED })
    ]);

    // Calculate total volume for successful transactions
    const volumeResult = await this.em.getConnection().execute(
      'SELECT SUM(CAST(amount AS DECIMAL(20,8))) as volume FROM user_balance_history WHERE status = ? AND type IN (?, ?, ?, ?) AND created_at >= ?',
      [TransactionStatus.COMPLETED, TransactionType.DEPOSIT, TransactionType.WITHDRAWAL, TransactionType.TRADE_BUY, TransactionType.TRADE_SELL, dateFrom]
    );

    return {
      totalTransactions: total,
      totalVolume: volumeResult[0]?.volume?.toString() || '0',
      successfulTransactions: successful,
      failedTransactions: failed
    };
  }

  async getUserTransactionHistory(
    telegramId: string,
    currency?: CurrencyType,
    type?: TransactionType,
    limit: number = 50
  ): Promise<UserBalanceHistoryEntity[]> {
    const conditions: any = {
      user: { telegramId }
    };

    if (currency) conditions.currency = currency;
    if (type) conditions.type = type;

    return this.find(
      conditions,
      {
        orderBy: { createdAt: QueryOrder.DESC },
        limit,
        populate: ['user']
      }
    );
  }
}
