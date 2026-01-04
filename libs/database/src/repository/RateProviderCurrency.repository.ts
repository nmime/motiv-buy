import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { RateProviderCurrencyEntity } from '../entity/RateProviderCurrency.entity';
import { RateProvider } from '../entity/CurrencyRatesHistory.entity';
import { CurrencyCode } from '../entity/Currency.entity';

/**
 * Currency mapping data for a provider
 */
export interface ProviderCurrencyMapping {
  currencyCode: CurrencyCode;
  providerSymbol: string;
  isEnabled: boolean;
  priority: number;
}

export class RateProviderCurrencyRepository extends EntityRepository<RateProviderCurrencyEntity> {
  constructor(em: EntityManager) {
    super(em, RateProviderCurrencyEntity);
  }

  /**
   * Get all enabled currency mappings for a specific provider
   */
  async findByProvider(providerName: RateProvider): Promise<ProviderCurrencyMapping[]> {
    const mappings = await this.em.find(
      RateProviderCurrencyEntity,
      {
        provider: { name: providerName, isEnabled: true },
        isEnabled: true,
      },
      {
        populate: ['currency'],
        orderBy: { priority: 'ASC' },
      },
    );

    return mappings.map((m) => ({
      currencyCode: m.currency.getEntity().code,
      providerSymbol: m.providerSymbol,
      isEnabled: m.isEnabled,
      priority: m.priority,
    }));
  }

  /**
   * Get all enabled currency mappings grouped by provider
   */
  async findAllEnabled(): Promise<Map<RateProvider, ProviderCurrencyMapping[]>> {
    const mappings = await this.em.find(
      RateProviderCurrencyEntity,
      {
        provider: { isEnabled: true },
        isEnabled: true,
      },
      {
        populate: ['provider', 'currency'],
        orderBy: { priority: 'ASC' },
      },
    );

    const result = new Map<RateProvider, ProviderCurrencyMapping[]>();

    for (const mapping of mappings) {
      const providerName = mapping.provider.getEntity().name;
      const existing = result.get(providerName) ?? [];
      existing.push({
        currencyCode: mapping.currency.getEntity().code,
        providerSymbol: mapping.providerSymbol,
        isEnabled: mapping.isEnabled,
        priority: mapping.priority,
      });

      result.set(providerName, existing);
    }

    return result;
  }
}
