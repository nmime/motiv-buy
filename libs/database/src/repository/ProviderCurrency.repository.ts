import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { ProviderCurrencyEntity, NetworkType } from '../entity/ProviderCurrency.entity';
import { CurrencyCode } from '../entity/Currency.entity';
import { PaymentProvider } from '../enum';

/**
 * Repository for ProviderCurrency operations
 * Handles queries for provider-currency relationships
 */
@Injectable()
export class ProviderCurrencyRepository {
  constructor(private readonly em: EntityManager) {}

  /**
   * Find all currencies supported by a provider
   */
  async findByProvider(provider: PaymentProvider): Promise<ProviderCurrencyEntity[]> {
    return this.em.find(
      ProviderCurrencyEntity,
      {
        provider: { provider },
        isEnabled: true,
      },
      {
        populate: ['currency'],
        orderBy: { routingPriority: 'ASC' },
      },
    );
  }

  /**
   * Find all providers that support a specific currency
   */
  async findByCurrency(currencyCode: CurrencyCode): Promise<ProviderCurrencyEntity[]> {
    return this.em.find(
      ProviderCurrencyEntity,
      {
        currency: { code: currencyCode },
        isEnabled: true,
      },
      {
        populate: ['provider'],
        orderBy: { routingPriority: 'ASC' },
      },
    );
  }

  /**
   * Find specific provider-currency combination
   */
  async findByProviderAndCurrency(
    provider: PaymentProvider,
    currencyCode: CurrencyCode,
    network?: NetworkType,
  ): Promise<ProviderCurrencyEntity | null> {
    const conditions: {
      provider: { provider: PaymentProvider };
      currency: { code: CurrencyCode };
      network?: NetworkType;
    } = {
      provider: { provider },
      currency: { code: currencyCode },
    };

    if (network) {
      conditions['network'] = network;
    }

    return this.em.findOne(ProviderCurrencyEntity, conditions, {
      populate: ['provider', 'currency'],
    });
  }

  /**
   * Find preferred network for a currency on a provider
   */
  async findPreferredNetwork(
    provider: PaymentProvider,
    currencyCode: CurrencyCode,
  ): Promise<ProviderCurrencyEntity | null> {
    return this.em.findOne(
      ProviderCurrencyEntity,
      {
        provider: { provider },
        currency: { code: currencyCode },
        isPreferred: true,
        isEnabled: true,
      },
      {
        populate: ['provider', 'currency'],
      },
    );
  }

  /**
   * Find all providers that support deposits for a currency
   */
  async findDepositProviders(currencyCode: CurrencyCode): Promise<ProviderCurrencyEntity[]> {
    return this.em.find(
      ProviderCurrencyEntity,
      {
        currency: { code: currencyCode },
        isEnabled: true,
        supportsDeposits: true,
      },
      {
        populate: ['provider'],
        orderBy: { routingPriority: 'ASC' },
      },
    );
  }

  /**
   * Find all providers that support withdrawals for a currency
   */
  async findWithdrawalProviders(currencyCode: CurrencyCode): Promise<ProviderCurrencyEntity[]> {
    return this.em.find(
      ProviderCurrencyEntity,
      {
        currency: { code: currencyCode },
        isEnabled: true,
        supportsWithdrawals: true,
      },
      {
        populate: ['provider'],
        orderBy: { routingPriority: 'ASC' },
      },
    );
  }

  /**
   * Find best provider for a currency based on criteria
   */
  async findBestProvider(
    currencyCode: CurrencyCode,
    criteria: 'lowest_fee' | 'fastest' | 'most_reliable',
  ): Promise<ProviderCurrencyEntity | null> {
    const orderByMap: Record<typeof criteria, Partial<Record<keyof ProviderCurrencyEntity, 'ASC' | 'DESC'>>> = {
      lowest_fee: { networkFeeEstimate: 'ASC' },
      fastest: { avgConfirmationTimeSeconds: 'ASC' },
      most_reliable: { reliabilityScore: 'DESC' },
    };

    const orderBy = orderByMap[criteria];

    const results = await this.em.find(
      ProviderCurrencyEntity,
      {
        currency: { code: currencyCode },
        isEnabled: true,
      },
      {
        populate: ['provider'],
        orderBy,
        limit: 1,
      },
    );

    return results[0] || null;
  }

  /**
   * Check if provider supports currency
   */
  async supportsProviderCurrency(provider: PaymentProvider, currencyCode: CurrencyCode): Promise<boolean> {
    const count = await this.em.count(ProviderCurrencyEntity, {
      provider: { provider },
      currency: { code: currencyCode },
      isEnabled: true,
    });

    return count > 0;
  }

  /**
   * Create or update provider-currency support
   */
  async upsert(
    data: Required<Pick<ProviderCurrencyEntity, 'provider' | 'currency'>> &
      Partial<Omit<ProviderCurrencyEntity, 'provider' | 'currency'>>,
  ): Promise<ProviderCurrencyEntity> {
    const network = data.network || NetworkType.Native;

    let entity = await this.em.findOne(ProviderCurrencyEntity, {
      provider: data.provider,
      currency: data.currency,
      network,
    });

    if (entity) {
      // Update existing
      this.em.assign(entity, data);
    } else {
      // Create new using entity constructor which properly handles defaults and relations
      entity = new ProviderCurrencyEntity({
        ...data,
        network,
      } as ConstructorParameters<typeof ProviderCurrencyEntity>[0]);

      this.em.persist(entity);
    }

    await this.em.flush();

    return entity;
  }

  /**
   * Enable/disable provider-currency combination
   */
  async setEnabled(
    provider: PaymentProvider,
    currencyCode: CurrencyCode,
    network: NetworkType,
    enabled: boolean,
  ): Promise<ProviderCurrencyEntity | null> {
    const entity = await this.findByProviderAndCurrency(provider, currencyCode, network);

    if (!entity) {
      return null;
    }

    entity.isEnabled = enabled;
    await this.em.flush();

    return entity;
  }

  /**
   * Set preferred network for currency
   */
  async setPreferredNetwork(
    provider: PaymentProvider,
    currencyCode: CurrencyCode,
    network: NetworkType,
  ): Promise<ProviderCurrencyEntity | null> {
    // First, unset all other networks as not preferred
    const allNetworks = await this.em.find(ProviderCurrencyEntity, {
      provider: { provider },
      currency: { code: currencyCode },
    });

    for (const net of allNetworks) {
      net.isPreferred = false;
    }

    // Set the specified network as preferred
    const entity = await this.findByProviderAndCurrency(provider, currencyCode, network);

    if (!entity) {
      return null;
    }

    entity.isPreferred = true;
    await this.em.flush();

    return entity;
  }

  /**
   * Update routing priority
   */
  async updateRoutingPriority(
    provider: PaymentProvider,
    currencyCode: CurrencyCode,
    network: NetworkType,
    priority: number,
  ): Promise<ProviderCurrencyEntity | null> {
    const entity = await this.findByProviderAndCurrency(provider, currencyCode, network);

    if (!entity) {
      return null;
    }

    entity.routingPriority = priority;
    await this.em.flush();

    return entity;
  }

  /**
   * Update reliability score
   */
  async updateReliabilityScore(
    provider: PaymentProvider,
    currencyCode: CurrencyCode,
    network: NetworkType,
    score: number,
  ): Promise<ProviderCurrencyEntity | null> {
    const entity = await this.findByProviderAndCurrency(provider, currencyCode, network);

    if (!entity) {
      return null;
    }

    entity.reliabilityScore = Math.max(0, Math.min(100, score));
    await this.em.flush();

    return entity;
  }

  /**
   * Delete provider-currency support
   */
  async delete(provider: PaymentProvider, currencyCode: CurrencyCode, network: NetworkType): Promise<boolean> {
    const entity = await this.findByProviderAndCurrency(provider, currencyCode, network);

    if (!entity) {
      return false;
    }

    await this.em.removeAndFlush(entity);

    return true;
  }
}
