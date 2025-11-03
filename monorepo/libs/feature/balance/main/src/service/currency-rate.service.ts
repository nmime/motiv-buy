import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  CurrencyRepository,
  CurrencyRatesHistoryRepository,
  CurrencyCode,
  CurrencyType,
  RateProvider,
} from '@app/database';
import { Result, Ok, Err } from '@app/common-shared';

/**
 * Currency rate service
 * Fetches rates from multiple sources and maintains up-to-date USD-based conversion rates
 * Uses weighted average from multiple providers for accuracy
 */
@Injectable()
export class CurrencyRateService implements OnModuleInit {
  private readonly logger = new Logger(CurrencyRateService.name);

  constructor(
    private readonly currencyRepository: CurrencyRepository,
    private readonly currencyRatesHistoryRepository: CurrencyRatesHistoryRepository,
  ) {}

  /**
   * Convert amount from one currency to another
   */
  async convertAmount(amount: string, fromCode: CurrencyCode, toCode: CurrencyCode): Promise<Result<string, Error>> {
    try {
      const amountNum = parseFloat(amount);

      if (fromCode === toCode) {
        return Ok(amount);
      }

      const convertedAmount = await this.currencyRepository.convertAmount(fromCode, toCode, amountNum);

      if (convertedAmount === null) {
        return Err(new Error(`Unable to convert from ${fromCode} to ${toCode}`));
      }

      // Format based on target currency type
      const toCurrency = await this.currencyRepository.findByCode(toCode);
      const decimals = toCurrency?.decimalPlaces || 2;

      return Ok(convertedAmount.toFixed(decimals));
    } catch (error) {
      this.logger.error(`Error converting currency: ${error}`);
      return Err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get current rate for a currency (to USD)
   */
  async getCurrentRate(code: CurrencyCode): Promise<Result<string, Error>> {
    try {
      const currencyData = await this.currencyRepository.getCurrencyWithRate(code);

      if (!currencyData) {
        return Err(new Error(`Currency ${code} not found`));
      }

      return Ok(currencyData.currency.rateToUsd);
    } catch (error) {
      return Err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Fetch rates from CoinGecko API
   */
  private async fetchCoinGeckoRates(): Promise<void> {
    try {
      const cryptoMapping = {
        [CurrencyCode.Btc]: 'bitcoin',
        [CurrencyCode.Eth]: 'ethereum',
        [CurrencyCode.UsdT]: 'tether',
        [CurrencyCode.UsdC]: 'usd-coin',
        [CurrencyCode.Bnb]: 'binancecoin',
        [CurrencyCode.Ton]: 'the-open-network',
        [CurrencyCode.Trx]: 'tron',
        [CurrencyCode.Ltc]: 'litecoin',
      };

      const ids = Object.values(cryptoMapping).join(',');
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.statusText}`);
      }

      const data = await response.json();

      for (const [currencyCode, coinId] of Object.entries(cryptoMapping)) {
        if (data[coinId]?.usd) {
          const rate = data[coinId].usd.toString();
          const currency = await this.currencyRepository.findByCode(currencyCode as CurrencyCode);

          if (currency) {
            await this.currencyRatesHistoryRepository.createEntry(currency.id, RateProvider.CoinGecko, rate, 95);

            // Update weighted average
            await this.updateCurrencyRate(currencyCode as CurrencyCode);
          }
        }
      }

      this.logger.log('Successfully fetched rates from CoinGecko');
    } catch (error) {
      this.logger.error(`Error fetching CoinGecko rates: ${error}`);
    }
  }

  /**
   * Fetch rates from Binance API
   */
  private async fetchBinanceRates(): Promise<void> {
    try {
      const pairs = [
        { code: CurrencyCode.Btc, symbol: 'BTCUSDT' },
        { code: CurrencyCode.Eth, symbol: 'ETHUSDT' },
        { code: CurrencyCode.Bnb, symbol: 'BNBUSDT' },
        { code: CurrencyCode.Ltc, symbol: 'LTCUSDT' },
      ];

      for (const pair of pairs) {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair.symbol}`);

        if (response.ok) {
          const data = await response.json();
          const rate = parseFloat(data.price).toFixed(8);
          const currency = await this.currencyRepository.findByCode(pair.code);

          if (currency) {
            await this.currencyRatesHistoryRepository.createEntry(currency.id, RateProvider.Binance, rate, 90);

            await this.updateCurrencyRate(pair.code);
          }
        }
      }

      this.logger.log('Successfully fetched rates from Binance');
    } catch (error) {
      this.logger.error(`Error fetching Binance rates: ${error}`);
    }
  }

  /**
   * Fetch fiat rates (RUB, EUR) from external API
   */
  private async fetchFiatRates(): Promise<void> {
    try {
      // Using exchangerate-api.com (free tier)
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');

      if (!response.ok) {
        throw new Error(`Exchange rate API error: ${response.statusText}`);
      }

      const data = await response.json();

      // EUR: 1 USD = X EUR, so rate to USD = 1/X
      if (data.rates.EUR) {
        const eurToUsd = (1 / data.rates.EUR).toFixed(8);
        const eurCurrency = await this.currencyRepository.findByCode(CurrencyCode.Eur);

        if (eurCurrency) {
          await this.currencyRatesHistoryRepository.createEntry(
            eurCurrency.id,
            RateProvider.CentralBank,
            eurToUsd,
            100,
          );

          await this.updateCurrencyRate(CurrencyCode.Eur);
        }
      }

      // RUB: 1 USD = X RUB, so rate to USD = 1/X
      if (data.rates.RUB) {
        const rubToUsd = (1 / data.rates.RUB).toFixed(8);
        const rubCurrency = await this.currencyRepository.findByCode(CurrencyCode.Rub);

        if (rubCurrency) {
          await this.currencyRatesHistoryRepository.createEntry(
            rubCurrency.id,
            RateProvider.CentralBank,
            rubToUsd,
            100,
          );

          await this.updateCurrencyRate(CurrencyCode.Rub);
        }
      }

      this.logger.log('Successfully fetched fiat rates');
    } catch (error) {
      this.logger.error(`Error fetching fiat rates: ${error}`);
    }
  }

  /**
   * Update currency rate with weighted average from providers
   */
  private async updateCurrencyRate(code: CurrencyCode): Promise<void> {
    const weightedRate = await this.currencyRatesHistoryRepository.getWeightedAverageRate(code);

    if (weightedRate) {
      await this.currencyRepository.updateRate(code, weightedRate);
    }
  }

  /**
   * Update all rates from all providers
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async updateAllRates(): Promise<void> {
    this.logger.log('Starting rate update from all providers');

    try {
      await Promise.all([this.fetchCoinGeckoRates(), this.fetchBinanceRates(), this.fetchFiatRates()]);

      this.logger.log('All rates updated successfully');
    } catch (error) {
      this.logger.error(`Error updating rates: ${error}`);
    }
  }

  /**
   * Cleanup old rates daily
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldRates(): Promise<void> {
    this.logger.log('Cleaning up old rates');

    try {
      const deletedCount = await this.currencyRatesHistoryRepository.cleanupOldRates(7);
      this.logger.log(`Cleaned up ${deletedCount} old rate entries`);
    } catch (error) {
      this.logger.error(`Error cleaning up rates: ${error}`);
    }
  }

  /**
   * Initialize currencies and fetch initial rates
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing currencies and rates');

    try {
      // Initialize currencies
      await this.initializeCurrencies();

      // Fetch initial rates
      await this.updateAllRates();
    } catch (error) {
      this.logger.error(`Error initializing currency service: ${error}`);
    }
  }

  /**
   * Initialize default currencies in database
   */
  private async initializeCurrencies(): Promise<void> {
    const currencies = [
      // Fiat
      { code: CurrencyCode.Usd, name: 'US Dollar', type: CurrencyType.Fiat, rate: '1.0', symbol: '$', decimals: 2 },
      { code: CurrencyCode.Eur, name: 'Euro', type: CurrencyType.Fiat, rate: '0.92', symbol: '€', decimals: 2 },
      {
        code: CurrencyCode.Rub,
        name: 'Russian Ruble',
        type: CurrencyType.Fiat,
        rate: '0.011',
        symbol: '₽',
        decimals: 2,
      },

      // Crypto
      { code: CurrencyCode.Btc, name: 'Bitcoin', type: CurrencyType.Crypto, rate: '45000', symbol: '₿', decimals: 8 },
      { code: CurrencyCode.Eth, name: 'Ethereum', type: CurrencyType.Crypto, rate: '2500', symbol: 'Ξ', decimals: 8 },
      { code: CurrencyCode.UsdT, name: 'Tether', type: CurrencyType.Crypto, rate: '1.0', symbol: '₮', decimals: 6 },
      {
        code: CurrencyCode.UsdC,
        name: 'USD Coin',
        type: CurrencyType.Crypto,
        rate: '1.0',
        symbol: 'USDC',
        decimals: 6,
      },
      {
        code: CurrencyCode.Bnb,
        name: 'Binance Coin',
        type: CurrencyType.Crypto,
        rate: '300',
        symbol: 'BNB',
        decimals: 8,
      },
      { code: CurrencyCode.Ton, name: 'Toncoin', type: CurrencyType.Crypto, rate: '2.5', symbol: 'TON', decimals: 8 },
      { code: CurrencyCode.Trx, name: 'Tron', type: CurrencyType.Crypto, rate: '0.10', symbol: 'TRX', decimals: 6 },
      { code: CurrencyCode.Ltc, name: 'Litecoin', type: CurrencyType.Crypto, rate: '70', symbol: 'Ł', decimals: 8 },
    ];

    for (const curr of currencies) {
      const existing = await this.currencyRepository.findByCode(curr.code);

      if (!existing) {
        await this.currencyRepository.upsert(curr.code, curr.name, curr.type, curr.rate, curr.symbol);

        const currency = await this.currencyRepository.findByCode(curr.code);
        if (currency) {
          // Set decimal places
          currency.decimalPlaces = curr.decimals;
          await this.currencyRepository.updateRate(curr.code, curr.rate);
        }
      }
    }

    this.logger.log('Currencies initialized');
  }
}
