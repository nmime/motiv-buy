import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { ProviderCurrencySupportEntity, NetworkType } from '../entity/ProviderCurrencySupport.entity';
import { PaymentProvider, CurrencyCode } from '../enum';

/**
 * Repository for ProviderCurrencySupport operations
 * Handles queries for provider-currency relationships
 */
@Injectable()
export class ProviderCurrencySupportRepository {
  constructor(private readonly em: EntityManager) {}

  /**
   * Find all currencies supported by a provider
   */
  async findByProvider(provider: PaymentProvider): Promise<ProviderCurrencySupportEntity[]> {
    return this.em.find(
      ProviderCurrencySupportEntity,
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
  async findByCurrency(currencyCode: CurrencyCode): Promise<ProviderCurrencySupportEntity[]> {
    return this.em.find(
      ProviderCurrencySupportEntity,
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
  ): Promise<ProviderCurrencySupportEntity | null> {
    const conditions: Record<string, unknown> = {
      provider: { provider },
      currency: { code: currencyCode },
    };

    if (network) {
      conditions.network = network;
    }

    return this.em.findOne(ProviderCurrencySupportEntity, conditions, {
      populate: ['provider', 'currency'],
    });
  }

  /**
   * Find preferred network for a currency on a provider
   */
  async findPreferredNetwork(
    provider: PaymentProvider,
    currencyCode: CurrencyCode,
  ): Promise<ProviderCurrencySupportEntity | null> {
    return this.em.findOne(
      ProviderCurrencySupportEntity,
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
  async findDepositProviders(currencyCode: CurrencyCode): Promise<ProviderCurrencySupportEntity[]> {
    return this.em.find(
      ProviderCurrencySupportEntity,
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
  async findWithdrawalProviders(currencyCode: CurrencyCode): Promise<ProviderCurrencySupportEntity[]> {
    return this.em.find(
      ProviderCurrencySupportEntity,
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
  ): Promise<ProviderCurrencySupportEntity | null> {
    const orderBy: Record<string, 'ASC' | 'DESC'> = {};

    switch (criteria) {
      case 'lowest_fee':
        orderBy.networkFeeEstimate = 'ASC';
        break;
      case 'fastest':
        orderBy.avgConfirmationTimeSeconds = 'ASC';
        break;
      case 'most_reliable':
        orderBy.reliabilityScore = 'DESC';
        break;
    }

    const results = await this.em.find(
      ProviderCurrencySupportEntity,
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
    const count = await this.em.count(ProviderCurrencySupportEntity, {
      provider: { provider },
      currency: { code: currencyCode },
      isEnabled: true,
    });

    return count > 0;
  }

  /**
   * Create or update provider-currency support
   */
  async upsert(data: Partial<ProviderCurrencySupportEntity>): Promise<ProviderCurrencySupportEntity> {
    if (!data.provider || !data.currency) {
      throw new Error('Provider and currency are required');
    }

    const network = data.network || NetworkType.Native;

    let entity = await this.em.findOne(ProviderCurrencySupportEntity, {
      provider: data.provider,
      currency: data.currency,
      network,
    });

    if (entity) {
      // Update existing
      this.em.assign(entity, data);
    } else {
      // Create new
      entity = this.em.create(ProviderCurrencySupportEntity, {
        ...data,
        network,
      });
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
  ): Promise<ProviderCurrencySupportEntity | null> {
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
  ): Promise<ProviderCurrencySupportEntity | null> {
    // First, unset all other networks as not preferred
    const allNetworks = await this.em.find(ProviderCurrencySupportEntity, {
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
  ): Promise<ProviderCurrencySupportEntity | null> {
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
  ): Promise<ProviderCurrencySupportEntity | null> {
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
  async delete(
    provider: PaymentProvider,
    currencyCode: CurrencyCode,
    network: NetworkType,
  ): Promise<boolean> {
    const entity = await this.findByProviderAndCurrency(provider, currencyCode, network);

    if (!entity) {
      return false;
    }

    await this.em.removeAndFlush(entity);

    return true;
  }
}
