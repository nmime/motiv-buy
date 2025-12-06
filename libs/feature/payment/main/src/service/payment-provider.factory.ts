import { Injectable, Logger } from '@nestjs/common';
import { PaymentProvider, CurrencyRepository, CurrencyType } from '@app/database';
import { IPaymentProvider } from '@app/feature-payment-shared';
import { CryptoBotProvider } from '../provider/crypto-bot.provider';
import { HeleketProvider } from '../provider/heleket.provider';
import { YooKassaProvider } from '../provider/yookassa.provider';

/**
 * Payment Provider Factory
 *
 * Factory service for managing multiple payment providers with isolated contexts.
 * Each provider has its own configuration and implementation.
 *
 * Supported Providers:
 * - CryptoBot: Cryptocurrency payments (USDT, TON, BTC, ETH, etc.)
 * - Heleket: Russian payment gateway (cards, SBP, wallets)
 * - YooKassa: Russian payment gateway (cards, wallets, SBP, installments)
 *
 * Usage:
 * ```typescript
 * const provider = this.providerFactory.getProvider(PaymentProvider.CryptoBot);
 * const invoice = await provider.createInvoice(params);
 * ```
 */
@Injectable()
export class PaymentProviderFactory {
  private readonly logger = new Logger(PaymentProviderFactory.name);
  private readonly providers: Map<PaymentProvider, IPaymentProvider>;

  constructor(
    private readonly cryptoBotProvider: CryptoBotProvider,
    private readonly heleketProvider: HeleketProvider,
    private readonly yooKassaProvider: YooKassaProvider,
    private readonly currencyRepository: CurrencyRepository,
  ) {
    // Initialize provider map with all available providers
    this.providers = new Map<PaymentProvider, IPaymentProvider>([
      [PaymentProvider.CryptoBot, this.cryptoBotProvider],
      [PaymentProvider.Heleket, this.heleketProvider],
      [PaymentProvider.YooKassa, this.yooKassaProvider],
    ]);

    this.logger.log(
      `PaymentProviderFactory initialized with ${this.providers.size} providers: ${Array.from(this.providers.keys()).join(', ')}`,
    );
  }

  /**
   * Get payment provider instance by type
   * Returns the appropriate provider implementation with isolated context
   *
   * @param providerType - The payment provider type
   * @returns The payment provider instance
   * @throws Error if provider is not supported
   */
  getProvider(providerType: PaymentProvider): IPaymentProvider {
    const provider = this.providers.get(providerType);

    if (!provider) {
      const availableProviders = Array.from(this.providers.keys()).join(', ');
      throw new Error(`Unsupported payment provider: ${providerType}. Available providers: ${availableProviders}`);
    }

    this.logger.debug(`Retrieved provider: ${providerType}`);

    return provider;
  }

  /**
   * Check if a provider is available
   *
   * @param providerType - The payment provider type to check
   * @returns true if provider is available, false otherwise
   */
  hasProvider(providerType: PaymentProvider): boolean {
    return this.providers.has(providerType);
  }

  /**
   * Get list of all available providers
   *
   * @returns Array of available payment provider types
   */
  getAvailableProviders(): PaymentProvider[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get provider for a specific cryptocurrency
   * Returns the best provider for the given cryptocurrency
   *
   * @param currency - The cryptocurrency
   * @returns The recommended payment provider type
   */
  async getProviderForCurrency(currency: string): Promise<PaymentProvider> {
    // CryptoBot is the primary provider for all cryptocurrencies
    // Heleket and YooKassa handle fiat gateways for crypto top-ups via RUB
    const cryptoCurrencies = await this.currencyRepository.findByType(CurrencyType.Crypto);
    const cryptoCurrencyCodes = cryptoCurrencies.map((c) => c.code.toUpperCase());

    if (cryptoCurrencyCodes.includes(currency.toUpperCase())) {
      return PaymentProvider.CryptoBot;
    }

    // Default to CryptoBot for unknown currencies
    return PaymentProvider.CryptoBot;
  }
}
