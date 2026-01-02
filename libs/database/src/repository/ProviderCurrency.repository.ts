import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { NetworkType, ProviderCurrencyEntity } from '../entity/ProviderCurrency.entity';
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
    const em = this.em.fork();

    return em.find(
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
    const em = this.em.fork();

    return em.find(
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
    const em = this.em.fork();
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

    return em.findOne(ProviderCurrencyEntity, conditions, {
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
    const em = this.em.fork();

    return em.findOne(
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
    const em = this.em.fork();

    return em.find(
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
    const em = this.em.fork();

    return em.find(
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
    const em = this.em.fork();
    const orderByMap: Record<typeof criteria, Partial<Record<keyof ProviderCurrencyEntity, 'ASC' | 'DESC'>>> = {
      lowest_fee: { networkFeeEstimate: 'ASC' },
      fastest: { avgConfirmationTimeSeconds: 'ASC' },
      most_reliable: { reliabilityScore: 'DESC' },
    };

    const orderBy = orderByMap[criteria];

    const results = await em.find(
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
    const em = this.em.fork();
    const count = await em.count(ProviderCurrencyEntity, {
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
    const em = this.em.fork();
    const network = data.network || NetworkType.Native;

    let entity = await em.findOne(ProviderCurrencyEntity, {
      provider: data.provider,
      currency: data.currency,
      network,
    });

    if (entity) {
      // Update existing
      em.assign(entity, data);
    } else {
      // Create new using entity constructor which properly handles defaults and relations
      entity = new ProviderCurrencyEntity({
        ...data,
        network,
      } as ConstructorParameters<typeof ProviderCurrencyEntity>[0]);

      em.persist(entity);
    }

    await em.flush();

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
    const em = this.em.fork();
    const entity = await this.findByProviderAndCurrency(provider, currencyCode, network);

    if (!entity) {
      return null;
    }

    const managedEntity = em.getReference(ProviderCurrencyEntity, entity.id);
    em.assign(managedEntity, { isEnabled: enabled });
    await em.flush();

    return managedEntity;
  }

  /**
   * Set preferred network for currency
   */
  async setPreferredNetwork(
    provider: PaymentProvider,
    currencyCode: CurrencyCode,
    network: NetworkType,
  ): Promise<ProviderCurrencyEntity | null> {
    const em = this.em.fork();

    // First, unset all other networks as not preferred
    const allNetworks = await em.find(ProviderCurrencyEntity, {
      provider: { provider },
      currency: { code: currencyCode },
    });

    for (const net of allNetworks) {
      net.isPreferred = false;
    }

    // Set the specified network as preferred
    const entity = allNetworks.find((n) => n.network === network);

    if (!entity) {
      return null;
    }

    entity.isPreferred = true;
    await em.flush();

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
    const em = this.em.fork();
    const entity = await this.findByProviderAndCurrency(provider, currencyCode, network);

    if (!entity) {
      return null;
    }

    const managedEntity = em.getReference(ProviderCurrencyEntity, entity.id);
    em.assign(managedEntity, { routingPriority: priority });
    await em.flush();

    return managedEntity;
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
    const em = this.em.fork();
    const entity = await this.findByProviderAndCurrency(provider, currencyCode, network);

    if (!entity) {
      return null;
    }

    const managedEntity = em.getReference(ProviderCurrencyEntity, entity.id);
    em.assign(managedEntity, { reliabilityScore: Math.max(0, Math.min(100, score)) });
    await em.flush();

    return managedEntity;
  }

  /**
   * Delete provider-currency support
   */
  async delete(provider: PaymentProvider, currencyCode: CurrencyCode, network: NetworkType): Promise<boolean> {
    const em = this.em.fork();
    const entity = await this.findByProviderAndCurrency(provider, currencyCode, network);

    if (!entity) {
      return false;
    }

    const managedEntity = em.getReference(ProviderCurrencyEntity, entity.id);
    await em.removeAndFlush(managedEntity);

    return true;
  }
}
