import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { ProviderRoutingEntity, RoutingRuleType, ConditionOperator } from '../entity/ProviderRouting.entity';
import { CurrencyCode } from '../entity/Currency.entity';
import { PaymentProvider } from '../enum';

/**
 * Repository for ProviderRouting operations
 * Handles queries for routing rules
 */
@Injectable()
export class ProviderRoutingRepository {
  constructor(private readonly em: EntityManager) {}

  /**
   * Find all active rules sorted by priority
   */
  async findActiveRules(): Promise<ProviderRoutingEntity[]> {
    return this.em.find(
      ProviderRoutingEntity,
      {
        isEnabled: true,
      },
      {
        populate: ['provider', 'currency'],
        orderBy: { priority: 'ASC' },
      },
    );
  }

  /**
   * Find rules by type
   */
  async findByType(ruleType: RoutingRuleType): Promise<ProviderRoutingEntity[]> {
    return this.em.find(
      ProviderRoutingEntity,
      {
        ruleType,
        isEnabled: true,
      },
      {
        populate: ['provider', 'currency'],
        orderBy: { priority: 'ASC' },
      },
    );
  }

  /**
   * Find rules for a specific provider
   */
  async findByProvider(provider: PaymentProvider): Promise<ProviderRoutingEntity[]> {
    return this.em.find(
      ProviderRoutingEntity,
      {
        provider: { provider },
        isEnabled: true,
      },
      {
        populate: ['currency'],
        orderBy: { priority: 'ASC' },
      },
    );
  }

  /**
   * Find rules for a specific currency
   */
  async findByCurrency(currencyCode: CurrencyCode): Promise<ProviderRoutingEntity[]> {
    return this.em.find(
      ProviderRoutingEntity,
      {
        currency: { code: currencyCode },
        isEnabled: true,
      },
      {
        populate: ['provider'],
        orderBy: { priority: 'ASC' },
      },
    );
  }

  /**
   * Find rules applicable to a specific context
   */
  async findApplicableRules(params: {
    currencyCode?: CurrencyCode;
    country?: string;
    platform?: string;
    amount?: string;
  }): Promise<ProviderRoutingEntity[]> {
    const conditions: {
      isEnabled: boolean;
      $or?: Array<{ currency: { code: CurrencyCode } } | { currency: null }>;
    } = {
      isEnabled: true,
    };

    // Filter by currency if specified (or rules that apply to all currencies)
    if (params.currencyCode) {
      conditions.$or = [{ currency: { code: params.currencyCode } }, { currency: null }];
    }

    const rules = await this.em.find(ProviderRoutingEntity, conditions, {
      populate: ['provider', 'currency'],
      orderBy: { priority: 'ASC' },
    });

    // Further filter rules based on context
    return rules.filter((rule) => {
      // Check if rule is currently active (time/date constraints)
      if (!rule.isCurrentlyActive()) {
        return false;
      }

      // Check country filters
      if (params.country) {
        if (rule.allowedCountries && rule.allowedCountries.length > 0) {
          if (!rule.allowedCountries.includes(params.country)) {
            return false;
          }
        }

        if (rule.blockedCountries && rule.blockedCountries.length > 0) {
          if (rule.blockedCountries.includes(params.country)) {
            return false;
          }
        }
      }

      // Check platform filters
      if (params.platform) {
        if (rule.allowedPlatforms && rule.allowedPlatforms.length > 0) {
          if (!rule.allowedPlatforms.includes(params.platform)) {
            return false;
          }
        }
      }

      // Check amount filters
      if (params.amount) {
        const amountNum = parseFloat(params.amount);

        if (rule.minAmountUsd && amountNum < parseFloat(rule.minAmountUsd)) {
          return false;
        }

        if (rule.maxAmountUsd && amountNum > parseFloat(rule.maxAmountUsd)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Find default routing rule
   */
  async findDefaultRule(): Promise<ProviderRoutingEntity | null> {
    return this.em.findOne(
      ProviderRoutingEntity,
      {
        ruleType: RoutingRuleType.Default,
        isEnabled: true,
      },
      {
        populate: ['provider'],
        orderBy: { priority: 'ASC' },
      },
    );
  }

  /**
   * Find fallback rule by ID
   */
  async findFallbackRule(ruleId: string): Promise<ProviderRoutingEntity | null> {
    const rule = await this.em.findOne(ProviderRoutingEntity, { id: ruleId });

    if (!rule || !rule.fallbackRuleId) {
      return null;
    }

    return this.em.findOne(
      ProviderRoutingEntity,
      {
        id: rule.fallbackRuleId,
        isEnabled: true,
      },
      {
        populate: ['provider', 'currency'],
      },
    );
  }

  /**
   * Create or update routing rule
   */
  async upsert(
    data: (Required<Pick<ProviderRoutingEntity, 'name' | 'ruleType'>> &
      Partial<Omit<ProviderRoutingEntity, 'name' | 'ruleType'>>) | (Required<Pick<ProviderRoutingEntity, 'id'>> & Partial<ProviderRoutingEntity>),
  ): Promise<ProviderRoutingEntity> {
    if ('id' in data && data.id) {
      // Update existing
      const entity = await this.em.findOne(ProviderRoutingEntity, { id: data.id });

      if (!entity) {
        throw new Error(`Rule with ID ${data.id} not found`);
      }

      this.em.assign(entity, data);
      await this.em.flush();

      return entity;
    } else {
      // Create new using entity constructor which properly handles defaults and relations
      const entity = new ProviderRoutingEntity(data as ConstructorParameters<typeof ProviderRoutingEntity>[0]);
      this.em.persist(entity);
      await this.em.flush();

      return entity;
    }
  }

  /**
   * Record rule usage (increment counters)
   */
  async recordUsage(ruleId: string, success: boolean): Promise<void> {
    const rule = await this.em.findOne(ProviderRoutingEntity, { id: ruleId });

    if (!rule) {
      return;
    }

    rule.usageCount += 1;

    if (success) {
      rule.successCount += 1;
    } else {
      rule.failureCount += 1;
    }

    rule.lastUsedAt = new Date();

    await this.em.flush();
  }

  /**
   * Enable/disable rule
   */
  async setEnabled(ruleId: string, enabled: boolean): Promise<ProviderRoutingEntity | null> {
    const rule = await this.em.findOne(ProviderRoutingEntity, { id: ruleId });

    if (!rule) {
      return null;
    }

    rule.isEnabled = enabled;
    await this.em.flush();

    return rule;
  }

  /**
   * Update rule priority
   */
  async updatePriority(ruleId: string, priority: number): Promise<ProviderRoutingEntity | null> {
    const rule = await this.em.findOne(ProviderRoutingEntity, { id: ruleId });

    if (!rule) {
      return null;
    }

    rule.priority = priority;
    await this.em.flush();

    return rule;
  }

  /**
   * Update load balancing weight
   */
  async updateWeight(ruleId: string, weight: number): Promise<ProviderRoutingEntity | null> {
    const rule = await this.em.findOne(ProviderRoutingEntity, { id: ruleId });

    if (!rule) {
      return null;
    }

    rule.weight = Math.max(0, weight);
    await this.em.flush();

    return rule;
  }

  /**
   * Get rules sorted by success rate
   */
  async findBySuccessRate(limit: number = 10): Promise<ProviderRoutingEntity[]> {
    const rules = await this.findActiveRules();

    // Sort by success rate
    return rules
      .sort((a, b) => b.getSuccessRate() - a.getSuccessRate())
      .slice(0, limit);
  }

  /**
   * Delete routing rule
   */
  async delete(ruleId: string): Promise<boolean> {
    const rule = await this.em.findOne(ProviderRoutingEntity, { id: ruleId });

    if (!rule) {
      return false;
    }

    await this.em.removeAndFlush(rule);

    return true;
  }

  /**
   * Reset rule statistics
   */
  async resetStatistics(ruleId: string): Promise<ProviderRoutingEntity | null> {
    const rule = await this.em.findOne(ProviderRoutingEntity, { id: ruleId });

    if (!rule) {
      return null;
    }

    rule.usageCount = 0;
    rule.successCount = 0;
    rule.failureCount = 0;
    rule.lastUsedAt = null;

    await this.em.flush();

    return rule;
  }
}
