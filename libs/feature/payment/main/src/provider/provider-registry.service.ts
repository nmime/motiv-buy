import { Injectable, Logger } from '@nestjs/common';
import { PaymentProvider } from '@app/database';
import { IPaymentProvider } from '@app/feature-payment-shared';
import { CryptoBotProvider } from './crypto-bot.provider';
import { HeleketProvider } from './heleket.provider';
import { YooKassaProvider } from './yookassa.provider';

/**
 * Payment Provider Registry
 *
 * Central registry for all payment providers. Provides access to provider
 * instances by type and allows dynamic provider selection.
 *
 * This service ensures:
 * - Single instance of each provider
 * - Type-safe provider access
 * - Easy provider discovery
 * - Centralized provider management
 */
@Injectable()
export class PaymentProviderRegistry {
  private readonly logger = new Logger(PaymentProviderRegistry.name);

  private readonly providers = new Map<PaymentProvider, IPaymentProvider>();

  constructor(
    private readonly cryptoBotProvider: CryptoBotProvider,
    private readonly heleketProvider: HeleketProvider,
    private readonly yookassaProvider: YooKassaProvider,
  ) {
    // Register all available providers
    this.registerProviders();
  }

  /**
   * Get a payment provider by type
   *
   * @param provider The payment provider type
   * @returns The provider instance
   * @throws Error if provider is not found
   */
  getProvider(provider: PaymentProvider): IPaymentProvider {
    const providerInstance = this.providers.get(provider);

    if (!providerInstance) {
      const error = new Error(`Payment provider not found: ${provider}`);
      this.logger.error(error.message, { provider });

      throw error;
    }

    this.logger.debug(`Retrieved provider: ${provider}`);

    return providerInstance;
  }

  /**
   * Check if a provider is registered
   *
   * @param provider The payment provider type
   * @returns True if provider is registered, false otherwise
   */
  hasProvider(provider: PaymentProvider): boolean {
    return this.providers.has(provider);
  }

  /**
   * Get all registered providers
   *
   * @returns Array of registered provider types
   */
  getRegisteredProviders(): PaymentProvider[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get provider display name
   *
   * @param provider The payment provider type
   * @returns Human-readable provider name
   */
  getProviderName(provider: PaymentProvider): string {
    const names: Record<PaymentProvider, string> = {
      [PaymentProvider.CryptoBot]: 'CryptoBot (CryptoPay)',
      [PaymentProvider.Heleket]: 'Heleket',
      [PaymentProvider.YooKassa]: 'YooKassa',
    };

    return names[provider] || provider;
  }

  /**
   * Get provider description
   *
   * @param provider The payment provider type
   * @returns Provider description
   */
  getProviderDescription(provider: PaymentProvider): string {
    const descriptions: Record<PaymentProvider, string> = {
      [PaymentProvider.CryptoBot]:
        'Cryptocurrency payment processor supporting USDT, TON, BTC, ETH, and other cryptocurrencies.',
      [PaymentProvider.Heleket]:
        'Universal payment solution supporting multiple payment methods including cards and bank transfers.',
      [PaymentProvider.YooKassa]:
        'Russian payment service supporting cards, bank transfers, SBP, and other payment methods.',
    };

    return descriptions[provider] || 'Payment provider';
  }

  /**
   * Validate provider configuration
   *
   * @param provider The payment provider type
   * @returns True if provider is properly configured, false otherwise
   */
  async validateProvider(provider: PaymentProvider): Promise<boolean> {
    try {
      // Try to get provider balances to validate configuration
      const providerInstance = this.getProvider(provider);

      // This is a basic validation - can be enhanced per provider
      if ('getBalances' in providerInstance) {
        await providerInstance.getBalances();
        this.logger.log(`Provider ${provider} configuration validated successfully`);

        return true;
      }

      this.logger.warn(`Provider ${provider} does not support validation`);

      return false;
    } catch (error) {
      this.logger.error(`Provider ${provider} validation failed`, error);

      return false;
    }
  }

  /**
   * Register all available payment providers
   */
  private registerProviders(): void {
    this.providers.set(PaymentProvider.CryptoBot, this.cryptoBotProvider);
    this.providers.set(PaymentProvider.Heleket, this.heleketProvider);
    this.providers.set(PaymentProvider.YooKassa, this.yookassaProvider);

    this.logger.log(`Registered ${this.providers.size} payment providers`);
    this.logger.debug(`Providers: ${Array.from(this.providers.keys()).join(', ')}`);
  }
}
