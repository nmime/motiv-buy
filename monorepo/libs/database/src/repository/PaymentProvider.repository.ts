import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { PaymentProviderEntity, ProviderStatus } from '../entity/PaymentProvider.entity';
import { PaymentProvider } from '../enum';

/**
 * Repository for PaymentProvider operations
 * Handles database queries for payment provider configuration
 */
@Injectable()
export class PaymentProviderRepository {
  constructor(private readonly em: EntityManager) {}

  /**
   * Find provider by type
   */
  async findByProvider(provider: PaymentProvider): Promise<PaymentProviderEntity | null> {
    return this.em.findOne(PaymentProviderEntity, {
      provider,
      isEnabled: true,
    });
  }

  /**
   * Get all active providers
   */
  async findAllActive(): Promise<PaymentProviderEntity[]> {
    return this.em.find(
      PaymentProviderEntity,
      {
        isEnabled: true,
        status: ProviderStatus.Active,
      },
      {
        orderBy: { priority: 'ASC' },
      },
    );
  }

  /**
   * Get all enabled providers (including maintenance mode)
   */
  async findAllEnabled(): Promise<PaymentProviderEntity[]> {
    return this.em.find(
      PaymentProviderEntity,
      {
        isEnabled: true,
      },
      {
        orderBy: { priority: 'ASC' },
      },
    );
  }

  /**
   * Get providers that support deposits
   */
  async findDepositProviders(): Promise<PaymentProviderEntity[]> {
    return this.em.find(
      PaymentProviderEntity,
      {
        isEnabled: true,
        status: ProviderStatus.Active,
        supportsDeposits: true,
      },
      {
        orderBy: { priority: 'ASC' },
      },
    );
  }

  /**
   * Get providers that support withdrawals
   */
  async findWithdrawalProviders(): Promise<PaymentProviderEntity[]> {
    return this.em.find(
      PaymentProviderEntity,
      {
        isEnabled: true,
        status: ProviderStatus.Active,
        supportsWithdrawals: true,
      },
      {
        orderBy: { priority: 'ASC' },
      },
    );
  }

  /**
   * Get providers with Telegram integration
   */
  async findTelegramProviders(): Promise<PaymentProviderEntity[]> {
    return this.em.find(
      PaymentProviderEntity,
      {
        isEnabled: true,
        status: ProviderStatus.Active,
        supportsTelegramIntegration: true,
      },
      {
        orderBy: { priority: 'ASC' },
      },
    );
  }

  /**
   * Get providers with fiat conversion support
   */
  async findFiatProviders(): Promise<PaymentProviderEntity[]> {
    return this.em.find(
      PaymentProviderEntity,
      {
        isEnabled: true,
        status: ProviderStatus.Active,
        supportsFiatConversion: true,
      },
      {
        orderBy: { priority: 'ASC' },
      },
    );
  }

  /**
   * Create or update provider configuration
   */
  async upsert(data: Partial<PaymentProviderEntity>): Promise<PaymentProviderEntity> {
    if (!data.provider) {
      throw new Error('Provider type is required');
    }

    let entity = await this.em.findOne(PaymentProviderEntity, {
      provider: data.provider,
    });

    if (entity) {
      // Update existing
      this.em.assign(entity, data);
    } else {
      // Create new
      entity = this.em.create(PaymentProviderEntity, data as never);
      this.em.persist(entity);
    }

    await this.em.flush();

    return entity;
  }

  /**
   * Update provider status
   */
  async updateStatus(provider: PaymentProvider, status: ProviderStatus): Promise<PaymentProviderEntity | null> {
    const entity = await this.em.findOne(PaymentProviderEntity, { provider });

    if (!entity) {
      return null;
    }

    entity.status = status;
    await this.em.flush();

    return entity;
  }

  /**
   * Enable/disable provider
   */
  async setEnabled(provider: PaymentProvider, enabled: boolean): Promise<PaymentProviderEntity | null> {
    const entity = await this.em.findOne(PaymentProviderEntity, { provider });

    if (!entity) {
      return null;
    }

    entity.isEnabled = enabled;
    await this.em.flush();

    return entity;
  }

  /**
   * Update provider priority
   */
  async updatePriority(provider: PaymentProvider, priority: number): Promise<PaymentProviderEntity | null> {
    const entity = await this.em.findOne(PaymentProviderEntity, { provider });

    if (!entity) {
      return null;
    }

    entity.priority = priority;
    await this.em.flush();

    return entity;
  }

  /**
   * Update reliability score
   */
  async updateReliabilityScore(
    provider: PaymentProvider,
    score: number,
  ): Promise<PaymentProviderEntity | null> {
    const entity = await this.em.findOne(PaymentProviderEntity, { provider });

    if (!entity) {
      return null;
    }

    entity.reliabilityScore = Math.max(0, Math.min(100, score));
    await this.em.flush();

    return entity;
  }

  /**
   * Get provider configuration with relationships
   */
  async findWithRelations(provider: PaymentProvider): Promise<PaymentProviderEntity | null> {
    return this.em.findOne(
      PaymentProviderEntity,
      { provider },
      {
        populate: ['currencySupport', 'routingRules'],
      },
    );
  }

  /**
   * Delete provider configuration (use with caution)
   */
  async delete(provider: PaymentProvider): Promise<boolean> {
    const entity = await this.em.findOne(PaymentProviderEntity, { provider });

    if (!entity) {
      return false;
    }

    await this.em.removeAndFlush(entity);

    return true;
  }
}
