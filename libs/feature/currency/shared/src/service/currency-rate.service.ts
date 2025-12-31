import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from '@mikro-orm/postgresql';
import { MikroORM, RequestContext } from '@mikro-orm/core';
import Redlock from 'redlock';
import {
  CurrencyCode,
  CurrencyRatesHistoryRepository,
  CurrencyRepository,
  CurrencyRateProviderRepository,
  RateProviderCurrencyRepository,
  ProviderCurrencyMapping,
  RateProvider,
} from '@app/database';
import {
  abs,
  add,
  decimal,
  Decimal,
  divide,
  Err,
  multiply,
  Ok,
  Result,
  subtract,
  toDbString,
} from '@app/common-shared';

interface ProviderConfig {
  name: RateProvider;
  reliability: number;
  enabled: boolean;
  requiresAuth: boolean;
}

@Injectable()
export class CurrencyRateService implements OnModuleInit {
  private readonly logger = new Logger(CurrencyRateService.name);

  private providerConfigs: ProviderConfig[] = [];
  private providerConfigsLoaded = false;

  private currencyMappings = new Map<RateProvider, ProviderCurrencyMapping[]>();
  private currencyMappingsLoaded = false;

  private readonly stablecoinTolerance = 0.03;
  private readonly stablecoins = [CurrencyCode.Usdt, CurrencyCode.Usdc];

  private readonly lockTtl = 60000;
  private readonly lockKey = 'currency-rate-update';
  private readonly isSchedulerEnabled: boolean;

  constructor(
    private readonly orm: MikroORM,
    private readonly em: EntityManager,
    private readonly currencyRepository: CurrencyRepository,
    private readonly currencyRatesHistoryRepository: CurrencyRatesHistoryRepository,
    private readonly currencyRateProviderRepository: CurrencyRateProviderRepository,
    private readonly rateProviderCurrencyRepository: RateProviderCurrencyRepository,
    private readonly configService: ConfigService,
    private readonly redlock: Redlock,
  ) {
    this.isSchedulerEnabled = this.configService.get<string>('CURRENCY_RATE_SCHEDULER_ENABLED', 'true') === 'true';
  }

  private async loadProviderConfigs(): Promise<void> {
    if (this.providerConfigsLoaded) {
      return;
    }

    const providers = await this.currencyRateProviderRepository.findAllEnabled();

    this.providerConfigs = providers.map((p) => ({
      name: p.name,
      reliability: p.reliability,
      enabled: p.isEnabled,
      requiresAuth: p.requiresAuth,
    }));

    this.providerConfigsLoaded = true;
    this.logger.log('Provider configurations loaded', { count: this.providerConfigs.length });
  }

  private async loadCurrencyMappings(): Promise<void> {
    if (this.currencyMappingsLoaded) {
      return;
    }

    this.currencyMappings = await this.rateProviderCurrencyRepository.findAllEnabled();
    this.currencyMappingsLoaded = true;
    this.logger.log('Currency mappings loaded', { providerCount: this.currencyMappings.size });
  }

  private getCurrencyMappings(provider: RateProvider): ProviderCurrencyMapping[] {
    return this.currencyMappings.get(provider) ?? [];
  }

  private async executeInContext<T>(fn: () => Promise<T>): Promise<T> {
    return RequestContext.create(this.orm.em, fn);
  }

  async convertAmount(amount: string, fromCode: CurrencyCode, toCode: CurrencyCode): Promise<Result<string, Error>> {
    try {
      const amountDecimal = decimal(amount);

      if (fromCode === toCode) {
        return Ok(amount);
      }

      const convertedAmount = await this.currencyRepository.convertAmount(fromCode, toCode, amountDecimal.toNumber());

      if (convertedAmount === null) {
        return Err(new Error(`Unable to convert from ${fromCode} to ${toCode}`));
      }

      const toCurrency = await this.currencyRepository.findByCode(toCode);
      const decimals = toCurrency?.decimalPlaces || 2;

      return Ok(toDbString(convertedAmount, decimals));
    } catch (error) {
      this.logger.error('Currency conversion failed', { error });

      return Err(error instanceof Error ? error : new Error(String(error)));
    }
  }

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

  @Cron(CronExpression.EVERY_10_MINUTES)
  async updateAllRates(): Promise<void> {
    if (!this.isSchedulerEnabled) {
      return;
    }

    let lock;

    try {
      lock = await this.redlock.acquire([this.lockKey], this.lockTtl);
    } catch {
      this.logger.debug('Rate update already in progress, skipping');

      return;
    }

    try {
      await this.executeInContext(async () => {
        await this.loadProviderConfigs();
        await this.loadCurrencyMappings();

        this.logger.log('Rate update started');

        const startTime = Date.now();
        const results = await Promise.allSettled([
          this.fetchCoinGeckoRates(),
          this.fetchBinanceRates(),
          this.fetchCryptoCompareRates(),
          this.fetchKrakenRates(),
          this.fetchCoinCodexRates(),
          this.fetchHuobiRates(),
          this.fetchOkxRates(),
          this.fetchExchangeRateAPI(),
          this.fetchFrankfurterRates(),
          this.fetchFreeCurrencyRates(),
          this.fetchCoinbaseRates(),
          this.fetchOpenExchangeRates(),
        ]);

        const duration = Date.now() - startTime;
        const successful = results.filter((r) => r.status === 'fulfilled').length;
        const failed = results.filter((r) => r.status === 'rejected').length;

        this.logger.log('Rate update completed', { durationMs: duration, successful, failed });

        await this.verifyMinimumProviders();
      });
    } finally {
      await lock.release();
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldRates(): Promise<void> {
    if (!this.isSchedulerEnabled) {
      return;
    }

    await this.executeInContext(async () => {
      this.logger.log('Cleaning up old rates');

      try {
        const deletedCount = await this.currencyRatesHistoryRepository.cleanupOldRates(7);
        this.logger.log('Rate cleanup completed', { deletedCount });
      } catch (error) {
        this.logger.error('Rate cleanup failed', { error });
      }
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.isSchedulerEnabled) {
      this.logger.log('Currency rate scheduler disabled');

      return;
    }

    this.logger.log('Currency rate service starting');
    setTimeout(() => {
      this.performInitialization().catch((error) => {
        this.logger.error('Initialization failed', { error });
      });
    }, 1000);
  }

  private async performInitialization(): Promise<void> {
    await this.executeInContext(async () => {
      try {
        await this.loadProviderConfigs();
        await this.loadCurrencyMappings();
      } catch (error) {
        this.logger.error('Deferred initialization error', { error });
      }
    });

    await this.updateAllRates();
    this.logger.log('Currency rate service ready');
  }

  private async fetchWithTimeout(url: string, timeout = 10000): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private validateStablecoinRate(currencyCode: CurrencyCode, rate: Decimal.Value): boolean {
    if (!this.stablecoins.includes(currencyCode)) {
      return true;
    }

    const rateDecimal = decimal(rate);
    const deviation = abs(subtract(rateDecimal, 1.0));
    const isValid = deviation.lessThanOrEqualTo(this.stablecoinTolerance);

    if (!isValid) {
      this.logger.warn('Stablecoin rate deviation detected', {
        currency: currencyCode,
        rate: rateDecimal.toString(),
        deviationPercent: toDbString(multiply(deviation, 100), 2),
      });
    }

    return isValid;
  }

  private async fetchCoinGeckoRates(): Promise<void> {
    const provider = RateProvider.CoinGecko;
    const mappings = this.getCurrencyMappings(provider);
    if (mappings.length === 0) {
      return;
    }

    try {
      const ids = mappings.map((m) => m.providerSymbol).join(',');
      const response = await this.fetchWithTimeout(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      const config = this.providerConfigs.find((c) => c.name === provider);

      await Promise.all(
        mappings.map(async (mapping) => {
          if (data[mapping.providerSymbol]?.usd) {
            const rate = data[mapping.providerSymbol].usd.toString();

            if (!this.validateStablecoinRate(mapping.currencyCode, rate)) {
              return;
            }

            const currency = await this.currencyRepository.findByCode(mapping.currencyCode);
            if (currency) {
              await this.currencyRatesHistoryRepository.createEntry(
                currency.id,
                provider,
                toDbString(rate, 8),
                config?.reliability ?? 95,
              );

              await this.updateCurrencyRate(mapping.currencyCode);
            }
          }
        }),
      );

      this.logger.log('Rates fetched', { provider });
    } catch (error) {
      this.logger.error('Provider fetch failed', { provider, error });
    }
  }

  private async fetchBinanceRates(): Promise<void> {
    const provider = RateProvider.Binance;
    const mappings = this.getCurrencyMappings(provider);
    if (mappings.length === 0) {
      return;
    }

    try {
      const symbols = mappings.map((m) => `"${m.providerSymbol}"`).join(',');
      const response = await this.fetchWithTimeout(`https://api4.binance.com/api/v3/ticker/price?symbols=[${symbols}]`);

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
      }

      const data = await response.json();
      const config = this.providerConfigs.find((c) => c.name === provider);

      await Promise.all(
        mappings.map(async (mapping) => {
          const ticker = data.find((t: { symbol: string }) => t.symbol === mapping.providerSymbol);
          if (ticker?.price) {
            const rate = ticker.price.toString();
            const currency = await this.currencyRepository.findByCode(mapping.currencyCode);

            if (currency) {
              await this.currencyRatesHistoryRepository.createEntry(
                currency.id,
                provider,
                toDbString(rate, 8),
                config?.reliability ?? 90,
              );

              await this.updateCurrencyRate(mapping.currencyCode);
            }
          }
        }),
      );

      this.logger.log('Rates fetched', { provider });
    } catch (error) {
      this.logger.error('Provider fetch failed', { provider, error });
    }
  }

  private async fetchCryptoCompareRates(): Promise<void> {
    const provider = RateProvider.CryptoCompare;
    const apiKey = this.configService.get<string>('CRYPTOCOMPARE_API_KEY');
    if (!apiKey) {
      return;
    }

    const mappings = this.getCurrencyMappings(provider);
    if (mappings.length === 0) {
      return;
    }

    try {
      const fsyms = mappings.map((m) => m.providerSymbol).join(',');
      const url = `https://min-api.cryptocompare.com/data/pricemulti?fsyms=${fsyms}&tsyms=USD&api_key=${apiKey}`;
      const response = await this.fetchWithTimeout(url);

      if (!response.ok) {
        throw new Error(`CryptoCompare API error: ${response.status}`);
      }

      const data = await response.json();
      const config = this.providerConfigs.find((c) => c.name === provider);

      await Promise.all(
        mappings.map(async (mapping) => {
          if (data[mapping.providerSymbol]?.USD) {
            const rate = data[mapping.providerSymbol].USD.toString();

            if (!this.validateStablecoinRate(mapping.currencyCode, rate)) {
              return;
            }

            const currency = await this.currencyRepository.findByCode(mapping.currencyCode);
            if (currency) {
              await this.currencyRatesHistoryRepository.createEntry(
                currency.id,
                provider,
                toDbString(rate, 8),
                config?.reliability ?? 85,
              );

              await this.updateCurrencyRate(mapping.currencyCode);
            }
          }
        }),
      );

      this.logger.log('Rates fetched', { provider });
    } catch (error) {
      this.logger.error('Provider fetch failed', { provider, error });
    }
  }

  private async fetchKrakenRates(): Promise<void> {
    const provider = RateProvider.Kraken;
    const mappings = this.getCurrencyMappings(provider);
    if (mappings.length === 0) {
      return;
    }

    try {
      const pairs = mappings.map((m) => m.providerSymbol).join(',');
      const response = await this.fetchWithTimeout(`https://api.kraken.com/0/public/Ticker?pair=${pairs}`);

      if (!response.ok) {
        throw new Error(`Kraken API error: ${response.status}`);
      }

      const data = await response.json();
      const config = this.providerConfigs.find((c) => c.name === provider);

      await Promise.all(
        mappings.map(async (mapping) => {
          if (data.result?.[mapping.providerSymbol]) {
            const rate = data.result[mapping.providerSymbol].c[0].toString();
            const currency = await this.currencyRepository.findByCode(mapping.currencyCode);

            if (currency) {
              await this.currencyRatesHistoryRepository.createEntry(
                currency.id,
                provider,
                toDbString(rate, 8),
                config?.reliability ?? 90,
              );

              await this.updateCurrencyRate(mapping.currencyCode);
            }
          }
        }),
      );

      this.logger.log('Rates fetched', { provider });
    } catch (error) {
      this.logger.error('Provider fetch failed', { provider, error });
    }
  }

  private async fetchCoinCodexRates(): Promise<void> {
    const provider = RateProvider.CoinCodex;
    const mappings = this.getCurrencyMappings(provider);
    if (mappings.length === 0) {
      return;
    }

    try {
      const ids = mappings.map((m) => m.providerSymbol).join(',');
      const response = await this.fetchWithTimeout(`https://coincodex.com/api/coincodex/get_coin_ranges/${ids}`);

      if (!response.ok) {
        throw new Error(`CoinCodex API error: ${response.status}`);
      }

      const data = await response.json();
      const config = this.providerConfigs.find((c) => c.name === provider);

      await Promise.all(
        mappings.map(async (mapping) => {
          const coinData = data[mapping.providerSymbol];
          if (coinData?.['1H']) {
            const { min, max } = coinData['1H'];
            if (min && max) {
              const rate = toDbString(divide(add(min, max), 2), 8);

              if (!this.validateStablecoinRate(mapping.currencyCode, rate)) {
                return;
              }

              const currency = await this.currencyRepository.findByCode(mapping.currencyCode);
              if (currency) {
                await this.currencyRatesHistoryRepository.createEntry(
                  currency.id,
                  provider,
                  rate,
                  config?.reliability ?? 85,
                );

                await this.updateCurrencyRate(mapping.currencyCode);
              }
            }
          }
        }),
      );

      this.logger.log('Rates fetched', { provider });
    } catch (error) {
      this.logger.error('Provider fetch failed', { provider, error });
    }
  }

  private async fetchHuobiRates(): Promise<void> {
    const provider = RateProvider.Huobi;
    const mappings = this.getCurrencyMappings(provider);
    if (mappings.length === 0) {
      return;
    }

    try {
      const config = this.providerConfigs.find((c) => c.name === provider);

      await Promise.all(
        mappings.map(async (mapping) => {
          try {
            const response = await this.fetchWithTimeout(
              `https://api.huobi.pro/market/trade?symbol=${mapping.providerSymbol}`,
            );

            if (response.ok) {
              const data = await response.json();
              if (data?.tick?.data?.[0]?.price) {
                const rate = String(data.tick.data[0].price);

                if (!this.validateStablecoinRate(mapping.currencyCode, rate)) {
                  return;
                }

                const currency = await this.currencyRepository.findByCode(mapping.currencyCode);
                if (currency) {
                  await this.currencyRatesHistoryRepository.createEntry(
                    currency.id,
                    provider,
                    toDbString(rate, 8),
                    config?.reliability ?? 85,
                  );

                  await this.updateCurrencyRate(mapping.currencyCode);
                }
              }
            }
          } catch {
            // Individual symbol fetch failed, continue with others
          }
        }),
      );

      this.logger.log('Rates fetched', { provider });
    } catch (error) {
      this.logger.error('Provider fetch failed', { provider, error });
    }
  }

  private async fetchOkxRates(): Promise<void> {
    const provider = RateProvider.Okx;
    const mappings = this.getCurrencyMappings(provider);
    if (mappings.length === 0) {
      return;
    }

    try {
      const config = this.providerConfigs.find((c) => c.name === provider);

      await Promise.all(
        mappings.map(async (mapping) => {
          try {
            const response = await this.fetchWithTimeout(
              `https://www.okx.com/api/v5/market/ticker?instId=${mapping.providerSymbol}`,
            );

            if (response.ok) {
              const data = await response.json();
              if (data?.data?.[0]?.last) {
                const rate = String(data.data[0].last);

                if (!this.validateStablecoinRate(mapping.currencyCode, rate)) {
                  return;
                }

                const currency = await this.currencyRepository.findByCode(mapping.currencyCode);
                if (currency) {
                  await this.currencyRatesHistoryRepository.createEntry(
                    currency.id,
                    provider,
                    toDbString(rate, 8),
                    config?.reliability ?? 85,
                  );

                  await this.updateCurrencyRate(mapping.currencyCode);
                }
              }
            }
          } catch {
            // Individual symbol fetch failed, continue with others
          }
        }),
      );

      this.logger.log('Rates fetched', { provider });
    } catch (error) {
      this.logger.error('Provider fetch failed', { provider, error });
    }
  }

  private async fetchExchangeRateAPI(): Promise<void> {
    const provider = RateProvider.ExchangeRateApi;
    const mappings = this.getCurrencyMappings(provider);
    if (mappings.length === 0) {
      return;
    }

    try {
      const response = await this.fetchWithTimeout('https://api.exchangerate-api.com/v4/latest/USD');

      if (!response.ok) {
        throw new Error(`ExchangeRate-API error: ${response.status}`);
      }

      const data = await response.json();
      const config = this.providerConfigs.find((c) => c.name === provider);

      await Promise.all(
        mappings.map(async (mapping) => {
          const fiatRate = data.rates[mapping.providerSymbol];
          if (fiatRate) {
            const rateToUsd = toDbString(divide(1, fiatRate), 8);
            const currency = await this.currencyRepository.findByCode(mapping.currencyCode);

            if (currency) {
              await this.currencyRatesHistoryRepository.createEntry(
                currency.id,
                provider,
                rateToUsd,
                config?.reliability ?? 100,
              );

              await this.updateCurrencyRate(mapping.currencyCode);
            }
          }
        }),
      );

      this.logger.log('Fiat rates fetched', { provider });
    } catch (error) {
      this.logger.error('Provider fetch failed', { provider, error });
    }
  }

  private async fetchFrankfurterRates(): Promise<void> {
    const provider = RateProvider.Frankfurter;
    const mappings = this.getCurrencyMappings(provider);
    if (mappings.length === 0) {
      return;
    }

    try {
      const currencies = mappings.map((m) => m.providerSymbol).join(',');
      const response = await this.fetchWithTimeout(`https://api.frankfurter.app/latest?from=USD&to=${currencies}`);

      if (!response.ok) {
        throw new Error(`Frankfurter API error: ${response.status}`);
      }

      const data = await response.json();
      const config = this.providerConfigs.find((c) => c.name === provider);

      await Promise.all(
        mappings.map(async (mapping) => {
          const fiatRate = data.rates[mapping.providerSymbol];
          if (fiatRate) {
            const rateToUsd = toDbString(divide(1, fiatRate), 8);
            const currency = await this.currencyRepository.findByCode(mapping.currencyCode);

            if (currency) {
              await this.currencyRatesHistoryRepository.createEntry(
                currency.id,
                provider,
                rateToUsd,
                config?.reliability ?? 95,
              );

              await this.updateCurrencyRate(mapping.currencyCode);
            }
          }
        }),
      );

      this.logger.log('Fiat rates fetched', { provider });
    } catch (error) {
      this.logger.error('Provider fetch failed', { provider, error });
    }
  }

  private async fetchFreeCurrencyRates(): Promise<void> {
    const provider = RateProvider.FreeCurrencyApi;
    const apiKey = this.configService.get<string>('FREECURRENCY_API_KEY');
    if (!apiKey) {
      return;
    }

    const mappings = this.getCurrencyMappings(provider);
    if (mappings.length === 0) {
      return;
    }

    try {
      const currencies = mappings.map((m) => m.providerSymbol).join(',');
      const url = `https://api.freecurrencyapi.com/v1/latest?apikey=${apiKey}&base_currency=USD&currencies=${currencies}`;
      const response = await this.fetchWithTimeout(url);

      if (!response.ok) {
        throw new Error(`FreeCurrency API error: ${response.status}`);
      }

      const data = await response.json();
      const config = this.providerConfigs.find((c) => c.name === provider);

      await Promise.all(
        mappings.map(async (mapping) => {
          const fiatRate = data.data[mapping.providerSymbol];
          if (fiatRate) {
            const rateToUsd = toDbString(divide(1, fiatRate), 8);
            const currency = await this.currencyRepository.findByCode(mapping.currencyCode);

            if (currency) {
              await this.currencyRatesHistoryRepository.createEntry(
                currency.id,
                provider,
                rateToUsd,
                config?.reliability ?? 85,
              );

              await this.updateCurrencyRate(mapping.currencyCode);
            }
          }
        }),
      );

      this.logger.log('Fiat rates fetched', { provider });
    } catch (error) {
      this.logger.error('Provider fetch failed', { provider, error });
    }
  }

  private async fetchCoinbaseRates(): Promise<void> {
    const provider = RateProvider.Coinbase;
    const mappings = this.getCurrencyMappings(provider);
    if (mappings.length === 0) {
      return;
    }

    try {
      const response = await this.fetchWithTimeout('https://api.coinbase.com/v2/exchange-rates?currency=USD');

      if (!response.ok) {
        throw new Error(`Coinbase API error: ${response.status}`);
      }

      const data = await response.json();
      const config = this.providerConfigs.find((c) => c.name === provider);

      await Promise.all(
        mappings.map(async (mapping) => {
          const fiatRate = data?.data?.rates?.[mapping.providerSymbol];
          if (fiatRate) {
            const rateToUsd = toDbString(divide(1, fiatRate), 8);
            const currency = await this.currencyRepository.findByCode(mapping.currencyCode);

            if (currency) {
              await this.currencyRatesHistoryRepository.createEntry(
                currency.id,
                provider,
                rateToUsd,
                config?.reliability ?? 95,
              );

              await this.updateCurrencyRate(mapping.currencyCode);
            }
          }
        }),
      );

      this.logger.log('Fiat rates fetched', { provider });
    } catch (error) {
      this.logger.error('Provider fetch failed', { provider, error });
    }
  }

  private async fetchOpenExchangeRates(): Promise<void> {
    const provider = RateProvider.OpenExchangeRates;
    const apiKey = this.configService.get<string>('OPEN_EXCHANGE_RATES_API_KEY');
    if (!apiKey) {
      return;
    }

    const mappings = this.getCurrencyMappings(provider);
    if (mappings.length === 0) {
      return;
    }

    try {
      const url = `https://openexchangerates.org/api/latest.json?app_id=${apiKey}`;
      const response = await this.fetchWithTimeout(url);

      if (!response.ok) {
        throw new Error(`OpenExchangeRates API error: ${response.status}`);
      }

      const data = await response.json();
      const config = this.providerConfigs.find((c) => c.name === provider);

      await Promise.all(
        mappings.map(async (mapping) => {
          const fiatRate = data?.rates?.[mapping.providerSymbol];
          if (fiatRate) {
            const rateToUsd = toDbString(divide(1, fiatRate), 8);
            const currency = await this.currencyRepository.findByCode(mapping.currencyCode);

            if (currency) {
              await this.currencyRatesHistoryRepository.createEntry(
                currency.id,
                provider,
                rateToUsd,
                config?.reliability ?? 90,
              );

              await this.updateCurrencyRate(mapping.currencyCode);
            }
          }
        }),
      );

      this.logger.log('Fiat rates fetched', { provider });
    } catch (error) {
      this.logger.error('Provider fetch failed', { provider, error });
    }
  }

  private async updateCurrencyRate(code: CurrencyCode): Promise<void> {
    const weightedRate = await this.currencyRatesHistoryRepository.getWeightedAverageRate(code);

    if (weightedRate) {
      await this.currencyRepository.updateRate(code, weightedRate);
    }
  }

  private async verifyMinimumProviders(): Promise<void> {
    const allCurrencies = await this.currencyRepository.findAllActive();

    await Promise.all(
      allCurrencies
        .filter((currency) => currency.code !== CurrencyCode.Usd)
        .map(async (currency) => {
          const rates = await this.currencyRatesHistoryRepository.getLatestRatesByProvider(currency.code);

          if (rates.length < 2) {
            this.logger.warn('Insufficient providers for currency', {
              currency: currency.code,
              count: rates.length,
              minimum: 2,
            });
          }
        }),
    );
  }
}
