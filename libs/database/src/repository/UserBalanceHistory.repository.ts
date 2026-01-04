import { EntityManager, EntityRepository, FilterQuery, QueryOrder, ref } from '@mikro-orm/core';
import { TransactionStatus, TransactionType, UserBalanceHistoryEntity } from '../entity/UserBalanceHistory.entity';
import { UserEntity } from '../entity/User.entity';
import { CurrencyCode } from '../entity/Currency.entity';
import { UserBalanceMetadata } from '../type';

export class UserBalanceHistoryRepository extends EntityRepository<UserBalanceHistoryEntity> {
  constructor(em: EntityManager) {
    super(em, UserBalanceHistoryEntity);
  }

  async findByUser(user: UserEntity, limit = 50, offset = 0): Promise<UserBalanceHistoryEntity[]> {
    return this.find(
      { user },
      {
        orderBy: { createdAt: QueryOrder.DESC },
        limit,
        offset,
        populate: ['user'],
      },
    );
  }

  async findByUserAndCurrency(
    user: UserEntity,
    currency: CurrencyCode,
    limit = 50,
  ): Promise<UserBalanceHistoryEntity[]> {
    return this.find(
      { user, currency },
      {
        orderBy: { createdAt: QueryOrder.DESC },
        limit,
        populate: ['user'],
      },
    );
  }

  async findByTransactionType(type: TransactionType, limit = 50): Promise<UserBalanceHistoryEntity[]> {
    return this.find(
      { type },
      {
        orderBy: { createdAt: QueryOrder.DESC },
        limit,
        populate: ['user'],
      },
    );
  }

  async findByStatus(status: TransactionStatus, limit = 50): Promise<UserBalanceHistoryEntity[]> {
    return this.find(
      { status },
      {
        orderBy: { createdAt: QueryOrder.DESC },
        limit,
        populate: ['user'],
      },
    );
  }

  async findByReferenceId(referenceId: string): Promise<UserBalanceHistoryEntity | null> {
    return this.findOne({ referenceId });
  }

  async createTransaction(data: {
    userId: string;
    currency: CurrencyCode;
    type: TransactionType;
    amount: string;
    balanceBefore: string;
    balanceAfter: string;
    description?: string;
    txHash?: string;
    referenceId?: string;
    metadata?: UserBalanceMetadata;
    status?: TransactionStatus;
  }): Promise<UserBalanceHistoryEntity> {
    const userRef = this.em.getReference('UserEntity', data.userId);
    const transaction = new UserBalanceHistoryEntity({
      user: ref(userRef),
      currency: data.currency,
      type: data.type,
      amount: data.amount,
      balanceBefore: data.balanceBefore,
      balanceAfter: data.balanceAfter,
      description: data.description,
      txHash: data.txHash,
      referenceId: data.referenceId,
      metadata: data.metadata,
      status: data.status,
    });

    await this.em.persistAndFlush(transaction);

    return transaction;
  }

  async updateStatus(id: string, status: TransactionStatus): Promise<void> {
    const transaction = await this.findOne({ id });
    if (transaction) {
      transaction.status = status;
      await this.em.flush();
    }
  }

  async getTransactionStats(
    user?: UserEntity,
    currency?: CurrencyCode,
    days = 30,
  ): Promise<{
    totalTransactions: number;
    totalVolume: string;
    successfulTransactions: number;
    failedTransactions: number;
  }> {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const conditions: FilterQuery<UserBalanceHistoryEntity> = {
      createdAt: { $gte: dateFrom },
    };

    if (user) {
      conditions.user = user;
    }

    if (currency) {
      conditions.currency = currency;
    }

    const [total, successful, failed] = await Promise.all([
      this.count(conditions),
      this.count({ ...conditions, status: TransactionStatus.Completed }),
      this.count({ ...conditions, status: TransactionStatus.Failed }),
    ]);

    const volumeResult = (await this.em
      .getConnection()
      .execute(
        'SELECT SUM(CAST(amount AS DECIMAL(20,8))) as volume FROM user_balance_history WHERE status = ? AND type IN (?, ?, ?, ?) AND created_at >= ?',
        [
          TransactionStatus.Completed,
          TransactionType.Deposit,
          TransactionType.Withdrawal,
          TransactionType.TradeBuy,
          TransactionType.TradeSell,
          dateFrom,
        ],
      )) as Array<{ volume?: number }>;

    return {
      totalTransactions: total,
      totalVolume: volumeResult[0]?.volume?.toString() || '0',
      successfulTransactions: successful,
      failedTransactions: failed,
    };
  }

  async getUserTransactionHistory(
    telegramId: string,
    currency?: CurrencyCode,
    type?: TransactionType,
    limit = 50,
  ): Promise<UserBalanceHistoryEntity[]> {
    const conditions: FilterQuery<UserBalanceHistoryEntity> = {
      user: { telegramId },
    };

    if (currency) {
      conditions.currency = currency;
    }

    if (type) {
      conditions.type = type;
    }

    return this.find(conditions, {
      orderBy: { createdAt: QueryOrder.DESC },
      limit,
      populate: ['user'],
    });
  }
}
