import { EntityManager, EntityRepository, ref } from '@mikro-orm/core';
import { UserBalanceEntity } from '../entity';
import { UserEntity } from '../entity/User.entity';
import { CurrencyCode, CurrencyEntity } from '../entity/Currency.entity';
import { decimal, add, subtract, toDbString, greaterThanOrEqual } from '@app/common-shared/util';

export class UserBalanceRepository extends EntityRepository<UserBalanceEntity> {
  constructor(em: EntityManager) {
    super(em, UserBalanceEntity);
  }

  async findByUserAndCurrency(userId: string, currencyCode: CurrencyCode): Promise<UserBalanceEntity | null> {
    const currency = await this.em.findOne(CurrencyEntity, { code: currencyCode });
    if (!currency) {
      return null;
    }

    return this.findOne({ user: userId, currency: currency.id });
  }

  async findByTelegramId(telegramId: string): Promise<UserBalanceEntity[]> {
    return this.find({ user: { telegramId } }, { populate: ['user'] });
  }

  async createOrUpdateBalance(userId: string, currencyCode: CurrencyCode, balance: string): Promise<UserBalanceEntity> {
    const currency = await this.em.findOne(CurrencyEntity, { code: currencyCode });
    if (!currency) {
      throw new Error(`Currency with code ${currencyCode} not found`);
    }

    let userBalance = await this.findOne({ user: userId, currency: currency.id });

    if (!userBalance) {
      const userRef = this.em.getReference('UserEntity', userId);
      const currencyRef = this.em.getReference(CurrencyEntity, currency.id);
      userBalance = new UserBalanceEntity({
        user: ref(userRef),
        currency: ref(currencyRef),
        balance,
        lockedBalance: '0',
      });
      this.em.persist(userBalance);
    } else {
      userBalance.balance = balance;
    }

    await this.em.flush();

    return userBalance;
  }

  async updateBalance(user: UserEntity, currencyCode: CurrencyCode, newBalance: string): Promise<UserBalanceEntity | null> {
    const userBalance = await this.findByUserAndCurrency(user.id, currencyCode);
    if (userBalance) {
      userBalance.balance = newBalance;
      await this.em.flush();
    }

    return userBalance;
  }

  async lockBalance(user: UserEntity, currencyCode: CurrencyCode, amount: string): Promise<boolean> {
    const userBalance = await this.findByUserAndCurrency(user.id, currencyCode);
    if (!userBalance) {
      return false;
    }

    const availableBalance = decimal(userBalance.balance);
    const lockAmount = decimal(amount);

    if (greaterThanOrEqual(availableBalance, lockAmount)) {
      userBalance.balance = toDbString(subtract(availableBalance, lockAmount), 8);
      userBalance.lockedBalance = toDbString(add(userBalance.lockedBalance, lockAmount), 8);
      await this.em.flush();

      return true;
    }

    return false;
  }

  async unlockBalance(user: UserEntity, currencyCode: CurrencyCode, amount: string): Promise<boolean> {
    const userBalance = await this.findByUserAndCurrency(user.id, currencyCode);
    if (!userBalance) {
      return false;
    }

    const lockedAmount = decimal(userBalance.lockedBalance);
    const unlockAmount = decimal(amount);

    if (greaterThanOrEqual(lockedAmount, unlockAmount)) {
      userBalance.lockedBalance = toDbString(subtract(lockedAmount, unlockAmount), 8);
      userBalance.balance = toDbString(add(userBalance.balance, unlockAmount), 8);
      await this.em.flush();

      return true;
    }

    return false;
  }

  async getTotalBalanceByCurrency(currencyCode: CurrencyCode): Promise<string> {
    const currency = await this.em.findOne(CurrencyEntity, { code: currencyCode });
    if (!currency) {
      return '0';
    }

    const result = (await this.em
      .getConnection()
      .execute(
        'SELECT SUM(CAST(balance AS DECIMAL(20,8)) + CAST(locked_balance AS DECIMAL(20,8))) as total FROM user_balances WHERE currency_id = ?',
        [currency.id],
      )) as Array<{ total?: number }>;

    return result[0]?.total?.toString() || '0';
  }

  async getUserBalanceSummary(user: UserEntity): Promise<
    Record<
      CurrencyCode,
      {
        available: string;
        locked: string;
        total: string;
      }
    >
  > {
    const balances = await this.find({ user }, { populate: ['currency'] });
    const summary: Record<
      string,
      {
        available: string;
        locked: string;
        total: string;
      }
    > = {};

    for (const balance of balances) {
      const currencyEntity = balance.currency.getEntity();
      summary[currencyEntity.code] = {
        available: balance.balance,
        locked: balance.lockedBalance,
        total: balance.getTotalBalance(),
      };
    }

    return summary;
  }
}
