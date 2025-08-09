import {EntityManager, EntityRepository} from '@mikro-orm/core';
import {CurrencyType, UserBalanceEntity} from '../entities';
import {UserEntity} from '../entities/User.entity';

export class UserBalanceRepository extends EntityRepository<UserBalanceEntity> {
  constructor(em: EntityManager) {
    super(em, UserBalanceEntity);
  }

  async findByUserAndCurrency(user: UserEntity, currency: CurrencyType): Promise<UserBalanceEntity | null> {
    return this.findOne({ user, currency });
  }

  async findByUserId(userId: number): Promise<UserBalanceEntity[]> {
    return this.find({ user: userId }, { populate: ['user'] });
  }

  async findByTelegramId(telegramId: string): Promise<UserBalanceEntity[]> {
    return this.find({ user: { telegramId } }, { populate: ['user'] });
  }

  async createOrUpdateBalance(
    user: UserEntity,
    currency: CurrencyType,
    balance: string
  ): Promise<UserBalanceEntity> {
    let userBalance = await this.findByUserAndCurrency(user, currency);
    
    if (!userBalance) {
      userBalance = new UserBalanceEntity(user, currency, balance);
      this.em.persist(userBalance);
    } else {
      userBalance.balance = balance;
    }
    
    await this.em.flush();
    return userBalance;
  }

  async updateBalance(
    user: UserEntity,
    currency: CurrencyType,
    newBalance: string
  ): Promise<UserBalanceEntity | null> {
    const userBalance = await this.findByUserAndCurrency(user, currency);
    if (userBalance) {
      userBalance.balance = newBalance;
      await this.em.flush();
    }
    return userBalance;
  }

  async lockBalance(
    user: UserEntity,
    currency: CurrencyType,
    amount: string
  ): Promise<boolean> {
    const userBalance = await this.findByUserAndCurrency(user, currency);
    if (!userBalance) return false;

    const availableBalance = parseFloat(userBalance.balance);
    const lockAmount = parseFloat(amount);

    if (availableBalance >= lockAmount) {
      userBalance.balance = (availableBalance - lockAmount).toString();
      userBalance.lockedBalance = (parseFloat(userBalance.lockedBalance) + lockAmount).toString();
      await this.em.flush();
      return true;
    }
    
    return false;
  }

  async unlockBalance(
    user: UserEntity,
    currency: CurrencyType,
    amount: string
  ): Promise<boolean> {
    const userBalance = await this.findByUserAndCurrency(user, currency);
    if (!userBalance) return false;

    const lockedAmount = parseFloat(userBalance.lockedBalance);
    const unlockAmount = parseFloat(amount);

    if (lockedAmount >= unlockAmount) {
      userBalance.lockedBalance = (lockedAmount - unlockAmount).toString();
      userBalance.balance = (parseFloat(userBalance.balance) + unlockAmount).toString();
      await this.em.flush();
      return true;
    }
    
    return false;
  }

  async getTotalBalanceByCurrency(currency: CurrencyType): Promise<string> {
    const result = await this.em.getConnection().execute(
      'SELECT SUM(CAST(balance AS DECIMAL(20,8)) + CAST(locked_balance AS DECIMAL(20,8))) as total FROM user_balance WHERE currency = ?',
      [currency]
    );

    return result[0]?.total?.toString() || '0';
  }

  async getUserBalanceSummary(user: UserEntity): Promise<Record<CurrencyType, {
    available: string;
    locked: string;
    total: string;
  }>> {
    const balances = await this.find({ user });
    const summary: Record<string, any> = {};

    for (const balance of balances) {
      summary[balance.currency] = {
        available: balance.balance,
        locked: balance.lockedBalance,
        total: balance.getTotalBalance()
      };
    }

    return summary;
  }
}
