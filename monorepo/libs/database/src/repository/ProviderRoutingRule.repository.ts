import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { ProviderRoutingRuleEntity, RoutingRuleType } from '../entity/ProviderRoutingRule.entity';
import { PaymentProvider, CurrencyCode } from '../enum';

/**
 * Repository for ProviderRoutingRule operations
 * Handles queries for routing rules
 */
@Injectable()
export class ProviderRoutingRuleRepository {
  constructor(private readonly em: EntityManager) {}

  /**
   * Find all active rules sorted by priority
   */
  async findActiveRules(): Promise<ProviderRoutingRuleEntity[]> {
    return this.em.find(
      ProviderRoutingRuleEntity,
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
  async findByType(ruleType: RoutingRuleType): Promise<ProviderRoutingRuleEntity[]> {
    return this.em.find(
      ProviderRoutingRuleEntity,
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
  async findByProvider(provider: PaymentProvider): Promise<ProviderRoutingRuleEntity[]> {
    return this.em.find(
      ProviderRoutingRuleEntity,
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
  async findByCurrency(currencyCode: CurrencyCode): Promise<ProviderRoutingRuleEntity[]> {
    return this.em.find(
      ProviderRoutingRuleEntity,
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
  }): Promise<ProviderRoutingRuleEntity[]> {
    const conditions: Record<string, unknown> = {
      isEnabled: true,
    };

    // Filter by currency if specified (or rules that apply to all currencies)
    if (params.currencyCode) {
      conditions.$or = [{ currency: { code: params.currencyCode } }, { currency: null }];
    }

    const rules = await this.em.find(ProviderRoutingRuleEntity, conditions, {
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
  async findDefaultRule(): Promise<ProviderRoutingRuleEntity | null> {
    return this.em.findOne(
      ProviderRoutingRuleEntity,
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
  async findFallbackRule(ruleId: string): Promise<ProviderRoutingRuleEntity | null> {
    const rule = await this.em.findOne(ProviderRoutingRuleEntity, { id: ruleId });

    if (!rule || !rule.fallbackRuleId) {
      return null;
    }

    return this.em.findOne(
      ProviderRoutingRuleEntity,
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
  async upsert(data: Partial<ProviderRoutingRuleEntity>): Promise<ProviderRoutingRuleEntity> {
    if (data.id) {
      // Update existing
      const entity = await this.em.findOne(ProviderRoutingRuleEntity, { id: data.id });

      if (!entity) {
        throw new Error(`Rule with ID ${data.id} not found`);
      }

      this.em.assign(entity, data);
      await this.em.flush();

      return entity;
    } else {
      // Create new
      const entity = this.em.create(ProviderRoutingRuleEntity, data);
      this.em.persist(entity);
      await this.em.flush();

      return entity;
    }
  }

  /**
   * Record rule usage (increment counters)
   */
  async recordUsage(ruleId: string, success: boolean): Promise<void> {
    const rule = await this.em.findOne(ProviderRoutingRuleEntity, { id: ruleId });

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
  async setEnabled(ruleId: string, enabled: boolean): Promise<ProviderRoutingRuleEntity | null> {
    const rule = await this.em.findOne(ProviderRoutingRuleEntity, { id: ruleId });

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
  async updatePriority(ruleId: string, priority: number): Promise<ProviderRoutingRuleEntity | null> {
    const rule = await this.em.findOne(ProviderRoutingRuleEntity, { id: ruleId });

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
  async updateWeight(ruleId: string, weight: number): Promise<ProviderRoutingRuleEntity | null> {
    const rule = await this.em.findOne(ProviderRoutingRuleEntity, { id: ruleId });

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
  async findBySuccessRate(limit: number = 10): Promise<ProviderRoutingRuleEntity[]> {
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
    const rule = await this.em.findOne(ProviderRoutingRuleEntity, { id: ruleId });

    if (!rule) {
      return false;
    }

    await this.em.removeAndFlush(rule);

    return true;
  }

  /**
   * Reset rule statistics
   */
  async resetStatistics(ruleId: string): Promise<ProviderRoutingRuleEntity | null> {
    const rule = await this.em.findOne(ProviderRoutingRuleEntity, { id: ruleId });

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
