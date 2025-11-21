import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from '@mikro-orm/postgresql';
import { MikroORM, RequestContext } from '@mikro-orm/core';
import {
  CurrencyCode,
  CurrencyRatesHistoryRepository,
  CurrencyRepository,
  CurrencyRateProviderRepository,
  CurrencyRateProviderEntity,
  CurrencyType,
  RateProvider,
} from '@app/database';
import { abs, decimal, Decimal, divide, Err, multiply, Ok, Result, subtract, toDbString } from '@app/common-shared';

/**
 * Circuit breaker state for provider health tracking
 */
interface CircuitBreakerState {
  failures: number;
  lastFailure: Date | null;
  isOpen: boolean;
  successCount: number;
}

/**
 * Provider configuration with quota limits
 */
interface ProviderConfig {
  name: RateProvider;
  reliability: number;
  enabled: boolean;
  quotaPerMinute?: number;
  quotaPerMonth?: number;
  requiresAuth: boolean;
}

/**
 * Production-ready currency rate service
 * - Multi-provider support with minimum 2 providers per currency type
 * - Retry logic with exponential backoff
 * - Circuit breaker pattern for failing providers
 * - Rate limit and quota management
 * - Provider health monitoring
 * - Stablecoin validation
 */
@Injectable()
export class CurrencyRateService implements OnModuleInit {
  private readonly logger = new Logger(CurrencyRateService.name);
  private readonly circuitBreakers = new Map<RateProvider, CircuitBreakerState>();
  private readonly requestCounts = new Map<RateProvider, { count: number; resetAt: Date }>();

  // Provider configurations loaded from database (cached)
  private providerConfigs: ProviderConfig[] = [];
  private providerConfigsLoaded = false;

  // Stablecoin tolerance (3% deviation)
  private readonly stablecoinTolerance = 0.03;
  private readonly stablecoins = [CurrencyCode.Usdt, CurrencyCode.Usdc];

  // Circuit breaker thresholds
  private readonly circuitBreakerThreshold = 5; // failures before opening
  private readonly circuitBreakerTimeout = 5 * 60 * 1000; // 5 minutes
  private readonly circuitBreakerSuccessThreshold = 2; // successes to close

  // Retry configuration
  private readonly maxRetries = 3;
  private readonly initialRetryDelay = 2000; // 2 seconds

  constructor(
    private readonly orm: MikroORM,
    private readonly em: EntityManager,
    private readonly currencyRepository: CurrencyRepository,
    private readonly currencyRatesHistoryRepository: CurrencyRatesHistoryRepository,
    private readonly currencyRateProviderRepository: CurrencyRateProviderRepository,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Load provider configurations from database
   */
  private async loadProviderConfigs(): Promise<void> {
    if (this.providerConfigsLoaded) {
      return;
    }

    try {
      const providers = await this.currencyRateProviderRepository.findAllEnabled();

      this.providerConfigs = providers.map((p) => ({
        name: p.name,
        reliability: p.reliability,
        enabled: p.isEnabled,
        quotaPerMinute: p.quotaPerMinute ?? undefined,
        quotaPerMonth: p.quotaPerMonth ?? undefined,
        requiresAuth: p.requiresAuth,
      }));

      this.initializeCircuitBreakers();
      this.providerConfigsLoaded = true;
      this.logger.log(`Loaded ${this.providerConfigs.length} provider configurations from database`);
    } catch (error) {
      this.logger.error(`Failed to load provider configs from database: ${error}`);
      // Use fallback defaults if DB load fails
      this.useFallbackConfigs();
    }
  }

  /**
   * Fallback provider configs if database is unavailable
   */
  private useFallbackConfigs(): void {
    this.providerConfigs = [
      { name: RateProvider.CoinGecko, reliability: 95, enabled: true, quotaPerMinute: 50, requiresAuth: false },
      { name: RateProvider.Binance, reliability: 90, enabled: true, quotaPerMinute: 2400, requiresAuth: false },
      { name: RateProvider.CoinCap, reliability: 80, enabled: true, requiresAuth: false },
      { name: RateProvider.Kraken, reliability: 90, enabled: true, requiresAuth: false },
      { name: RateProvider.ExchangeRateApi, reliability: 100, enabled: true, quotaPerMonth: 1500, requiresAuth: false },
      { name: RateProvider.Frankfurter, reliability: 95, enabled: true, requiresAuth: false },
    ];
    this.initializeCircuitBreakers();
    this.logger.warn('Using fallback provider configurations');
  }

  /**
   * Execute a function within a request context (required for background tasks)
   * This ensures EntityManager operations have proper context
   */
  private async executeInContext<T>(fn: () => Promise<T>): Promise<T> {
    return RequestContext.create(this.orm.em, fn);
  }

  /**
   * Convert amount from one currency to another
   */
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
   * Update all rates from all providers
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async updateAllRates(): Promise<void> {
    await this.executeInContext(async () => {
      // Ensure provider configs are loaded
      await this.loadProviderConfigs();

      this.logger.log('🔄 Starting rate update from all providers');

      const startTime = Date.now();
      const results = await Promise.allSettled([
        // Crypto providers (minimum 2)
        this.fetchCoinGeckoRates(),
        this.fetchBinanceRates(),
        this.fetchCryptoCompareRates(),
        this.fetchCoinCapRates(),
        this.fetchKrakenRates(),

        // Fiat providers (minimum 2)
        this.fetchExchangeRateAPI(),
        this.fetchFrankfurterRates(),
        this.fetchFreeCurrencyRates(),
      ]);

      const duration = Date.now() - startTime;
      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      this.logger.log(
        `✅ Rate update completed in ${duration}ms - Success: ${successful}, Failed: ${failed}, Total: ${results.length}`,
      );

      // Check if we have minimum providers
      await this.verifyMinimumProviders();
    });
  }

  /**
   * Get provider health status
   */
  async getProviderHealthStatus(): Promise<
    Array<{
      provider: RateProvider;
      isAvailable: boolean;
      failures: number;
      lastFailure: Date | null;
    }>
  > {
    const status = [];

    for (const [provider, breaker] of this.circuitBreakers.entries()) {
      status.push({
        provider,
        isAvailable: !breaker.isOpen,
        failures: breaker.failures,
        lastFailure: breaker.lastFailure,
      });
    }

    return status;
  }

  /**
   * Retry logic with exponential backoff
   * Note: Sequential await in loop is intentional for retry logic with delays
   */

  /**
   * Cleanup old rates daily
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldRates(): Promise<void> {
    await this.executeInContext(async () => {
      this.logger.log('🧹 Cleaning up old rates');

      try {
        const deletedCount = await this.currencyRatesHistoryRepository.cleanupOldRates(7);
        this.logger.log(`✅ Cleaned up ${deletedCount} old rate entries`);
      } catch (error) {
        this.logger.error(`Error cleaning up rates: ${error}`);
      }
    });
  }

  /**
   * Initialize currencies and fetch initial rates
   * Note: Database initialization is deferred to avoid EntityManager context issues during module init.
   * Currency data will be lazily initialized on first use or via cron jobs.
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('🚀 Currency rate service initialized (initialization deferred)');
    // Schedule initial currency load and rate update after a short delay
    // to ensure EntityManager context is properly established
    setTimeout(() => {
      this.performInitialization().catch((error) => {
        this.logger.error(`Deferred initialization failed: ${error}`);
      });
    }, 1000);
  }

  /**
   * Perform deferred initialization (provider configs + currencies + initial rates)
   */
  private async performInitialization(): Promise<void> {
    await this.executeInContext(async () => {
      try {
        // Load provider configs from database first
        await this.loadProviderConfigs();
        this.logger.log('✅ Provider configs loaded from database');

        // Initialize currencies
        await this.initializeCurrencies();
        this.logger.log('✅ Currencies initialized, starting rate update...');
      } catch (error) {
        this.logger.error(`Error in deferred initialization: ${error}`);
      }
    });

    // Rate update is already wrapped in executeInContext
    await this.updateAllRates();
    this.logger.log('✅ Currency rate service fully initialized');
  }

  /**
   * Initialize circuit breakers for all providers
   */
  private initializeCircuitBreakers(): void {
    for (const config of this.providerConfigs) {
      this.circuitBreakers.set(config.name, {
        failures: 0,
        lastFailure: null,
        isOpen: false,
        successCount: 0,
      });
    }
  }

  /**
   * Check if provider is available (circuit breaker and rate limits)
   */
  private async isProviderAvailable(provider: RateProvider): Promise<boolean> {
    const breaker = this.circuitBreakers.get(provider);
    if (!breaker) {
      return false;
    }

    // Check circuit breaker
    if (breaker.isOpen) {
      const now = Date.now();
      const timeSinceLastFailure = breaker.lastFailure ? now - breaker.lastFailure.getTime() : 0;

      if (timeSinceLastFailure > this.circuitBreakerTimeout) {
        // Try half-open state
        this.logger.log(`Circuit breaker for ${provider} entering half-open state`);
        breaker.isOpen = false;
        breaker.successCount = 0;
      } else {
        this.logger.warn(`Circuit breaker for ${provider} is OPEN, skipping`);

        return false;
      }
    }

    // Check rate limits
    const rateLimit = this.requestCounts.get(provider);
    const config = this.providerConfigs.find((c) => c.name === provider);

    if (config?.quotaPerMinute && rateLimit) {
      const now = new Date();
      if (now < rateLimit.resetAt && rateLimit.count >= config.quotaPerMinute) {
        this.logger.warn(`Rate limit reached for ${provider}, skipping`);

        return false;
      }

      if (now >= rateLimit.resetAt) {
        // Reset counter
        this.requestCounts.set(provider, { count: 0, resetAt: new Date(now.getTime() + 60000) });
      }
    }

    return true;
  }

  /**
   * Record provider success
   */
  private recordSuccess(provider: RateProvider): void {
    const breaker = this.circuitBreakers.get(provider);
    if (breaker) {
      breaker.failures = 0;
      breaker.successCount++;

      if (breaker.successCount >= this.circuitBreakerSuccessThreshold) {
        breaker.isOpen = false;
        this.logger.log(`Circuit breaker for ${provider} closed after successful requests`);
      }
    }

    // Increment request count
    const rateLimit = this.requestCounts.get(provider);
    if (rateLimit) {
      rateLimit.count++;
    } else {
      this.requestCounts.set(provider, { count: 1, resetAt: new Date(Date.now() + 60000) });
    }
  }

  /**
   * Record provider failure
   */
  private recordFailure(provider: RateProvider, error: Error): void {
    const breaker = this.circuitBreakers.get(provider);
    if (breaker) {
      breaker.failures++;
      breaker.lastFailure = new Date();
      breaker.successCount = 0;

      if (breaker.failures >= this.circuitBreakerThreshold) {
        breaker.isOpen = true;
        this.logger.error(
          `Circuit breaker for ${provider} OPENED after ${breaker.failures} failures. Last error: ${error.message}`,
        );
      }
    }
  }

  /* eslint-disable no-await-in-loop */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    provider: RateProvider,
    retries = this.maxRetries,
  ): Promise<T> {
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await fn();
        this.recordSuccess(provider);

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < retries) {
          const delay = this.initialRetryDelay * Math.pow(2, attempt);
          this.logger.warn(
            `${provider} attempt ${attempt + 1} failed: ${lastError.message}. Retrying in ${delay}ms...`,
          );

          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    this.recordFailure(provider, lastError);
    throw lastError;
  }

  /**
   * Fetch with timeout
   */
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

  /**
   * Validate stablecoin rate
   */
  private validateStablecoinRate(currencyCode: CurrencyCode, rate: Decimal.Value): boolean {
    if (!this.stablecoins.includes(currencyCode)) {
      return true;
    }

    const rateDecimal = decimal(rate);
    const deviation = abs(subtract(rateDecimal, 1.0));
    const isValid = deviation.lessThanOrEqualTo(this.stablecoinTolerance);

    if (!isValid) {
      this.logger.warn(
        `Stablecoin ${currencyCode} rate ${rateDecimal.toString()} deviates ${toDbString(multiply(deviation, 100), 2)}% from $1.00 peg`,
      );
    }

    return isValid;
  }

  /**
   * Fetch rates from CoinGecko API
   */
  private async fetchCoinGeckoRates(): Promise<void> {
    const provider = RateProvider.CoinGecko;
    if (!(await this.isProviderAvailable(provider))) {
      return;
    }

    const cryptoMapping: Record<string, string> = {
      [CurrencyCode.Btc]: 'bitcoin',
      [CurrencyCode.Eth]: 'ethereum',
      [CurrencyCode.Usdt]: 'tether',
      [CurrencyCode.Usdc]: 'usd-coin',
      [CurrencyCode.Bnb]: 'binancecoin',
      [CurrencyCode.Ton]: 'the-open-network',
      [CurrencyCode.Trx]: 'tron',
      [CurrencyCode.Ltc]: 'litecoin',
      [CurrencyCode.Doge]: 'dogecoin',
      [CurrencyCode.Dai]: 'dai',
      [CurrencyCode.Dash]: 'dash',
      [CurrencyCode.Bch]: 'bitcoin-cash',
      [CurrencyCode.Sol]: 'solana',
    };

    await this.retryWithBackoff(async () => {
      const ids = Object.values(cryptoMapping).join(',');
      const response = await this.fetchWithTimeout(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const config = this.providerConfigs.find((c) => c.name === provider);

      // Process all currencies in parallel
      const promises = Object.entries(cryptoMapping).map(async ([currencyCode, coinId]) => {
        if (data[coinId]?.usd) {
          const rate = data[coinId].usd.toString();

          // Validate stablecoin rates
          if (!this.validateStablecoinRate(currencyCode as CurrencyCode, rate)) {
            this.logger.warn(`Skipping suspicious ${currencyCode} rate from ${provider}: ${rate}`);

            return;
          }

          const currency = await this.currencyRepository.findByCode(currencyCode as CurrencyCode);

          if (currency) {
            await this.currencyRatesHistoryRepository.createEntry(
              currency.id,
              provider,
              toDbString(rate, 8),
              config?.reliability || 95,
            );

            await this.updateCurrencyRate(currencyCode as CurrencyCode);
          }
        }
      });

      await Promise.all(promises);

      this.logger.log(`✅ Successfully fetched rates from ${provider}`);
    }, provider);
  }

  /**
   * Fetch rates from Binance API
   */
  private async fetchBinanceRates(): Promise<void> {
    const provider = RateProvider.Binance;
    if (!(await this.isProviderAvailable(provider))) {
      return;
    }

    const pairs = [
      { code: CurrencyCode.Btc, symbol: 'BTCUSDT' },
      { code: CurrencyCode.Eth, symbol: 'ETHUSDT' },
      { code: CurrencyCode.Bnb, symbol: 'BNBUSDT' },
    ];

    await this.retryWithBackoff(async () => {
      const config = this.providerConfigs.find((c) => c.name === provider);

      // Process all pairs in parallel
      const promises = pairs.map(async (pair) => {
        const response = await this.fetchWithTimeout(
          `https://api.binance.com/api/v3/ticker/price?symbol=${pair.symbol}`,
        );

        if (response.ok) {
          const data = await response.json();
          const rate = data.price.toString();
          const currency = await this.currencyRepository.findByCode(pair.code);

          if (currency) {
            await this.currencyRatesHistoryRepository.createEntry(
              currency.id,
              provider,
              toDbString(rate, 8),
              config?.reliability || 90,
            );

            await this.updateCurrencyRate(pair.code);
          }
        }
      });

      await Promise.all(promises);

      this.logger.log(`✅ Successfully fetched rates from ${provider}`);
    }, provider);
  }

  /**
   * Fetch rates from CryptoCompare API
   */
  private async fetchCryptoCompareRates(): Promise<void> {
    const provider = RateProvider.CryptoCompare;
    if (!(await this.isProviderAvailable(provider))) {
      return;
    }

    const apiKey = this.configService.get<string>('CRYPTOCOMPARE_API_KEY');
    if (!apiKey) {
      this.logger.warn(`${provider} API key not configured, skipping`);

      return;
    }

    const symbols = ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'TON', 'TRX', 'LTC', 'DOGE', 'DAI', 'DASH', 'BCH', 'SOL'];

    await this.retryWithBackoff(async () => {
      const fsyms = symbols.join(',');
      const url = `https://min-api.cryptocompare.com/data/pricemulti?fsyms=${fsyms}&tsyms=USD&api_key=${apiKey}`;
      const response = await this.fetchWithTimeout(url);

      if (!response.ok) {
        throw new Error(`CryptoCompare API error: ${response.status}`);
      }

      const data = await response.json();
      const config = this.providerConfigs.find((c) => c.name === provider);

      // Process all symbols in parallel
      const promises = symbols.map(async (symbol) => {
        if (data[symbol]?.USD) {
          const rate = data[symbol].USD.toString();
          const currencyCode = symbol === 'USDT' ? CurrencyCode.Usdt : (symbol as CurrencyCode);

          if (!this.validateStablecoinRate(currencyCode, rate)) {
            return;
          }

          const currency = await this.currencyRepository.findByCode(currencyCode);
          if (currency) {
            await this.currencyRatesHistoryRepository.createEntry(
              currency.id,
              provider,
              toDbString(rate, 8),
              config?.reliability || 85,
            );

            await this.updateCurrencyRate(currencyCode);
          }
        }
      });

      await Promise.all(promises);

      this.logger.log(`✅ Successfully fetched rates from ${provider}`);
    }, provider);
  }

  /**
   * Fetch rates from CoinCap API
   */
  private async fetchCoinCapRates(): Promise<void> {
    const provider = RateProvider.CoinCap;
    if (!(await this.isProviderAvailable(provider))) {
      return;
    }

    const mapping: Record<string, string> = {
      'bitcoin': CurrencyCode.Btc,
      'ethereum': CurrencyCode.Eth,
      'tether': CurrencyCode.Usdt,
      'usd-coin': CurrencyCode.Usdc,
      'binance-coin': CurrencyCode.Bnb,
      'toncoin': CurrencyCode.Ton,
      'tron': CurrencyCode.Trx,
      'litecoin': CurrencyCode.Ltc,
      'dogecoin': CurrencyCode.Doge,
      'multi-collateral-dai': CurrencyCode.Dai,
      'dash': CurrencyCode.Dash,
      'bitcoin-cash': CurrencyCode.Bch,
      'solana': CurrencyCode.Sol,
    };

    await this.retryWithBackoff(async () => {
      const config = this.providerConfigs.find((c) => c.name === provider);

      // Process all currencies in parallel
      const promises = Object.entries(mapping).map(async ([coinCapId, currencyCode]) => {
        const response = await this.fetchWithTimeout(`https://api.coincap.io/v2/assets/${coinCapId}`);

        if (response.ok) {
          const data = await response.json();
          const rate = data.data.priceUsd.toString();

          if (!this.validateStablecoinRate(currencyCode as CurrencyCode, rate)) {
            return;
          }

          const currency = await this.currencyRepository.findByCode(currencyCode as CurrencyCode);
          if (currency) {
            await this.currencyRatesHistoryRepository.createEntry(
              currency.id,
              provider,
              toDbString(rate, 8),
              config?.reliability || 80,
            );

            await this.updateCurrencyRate(currencyCode as CurrencyCode);
          }
        }
      });

      await Promise.all(promises);

      this.logger.log(`✅ Successfully fetched rates from ${provider}`);
    }, provider);
  }

  /**
   * Fetch rates from Kraken API
   */
  private async fetchKrakenRates(): Promise<void> {
    const provider = RateProvider.Kraken;
    if (!(await this.isProviderAvailable(provider))) {
      return;
    }

    const pairs = [
      { code: CurrencyCode.Btc, pair: 'XXBTZUSD' },
      { code: CurrencyCode.Eth, pair: 'XETHZUSD' },
    ];

    await this.retryWithBackoff(async () => {
      const config = this.providerConfigs.find((c) => c.name === provider);

      // Process all pairs in parallel
      const promises = pairs.map(async ({ code, pair }) => {
        const response = await this.fetchWithTimeout(`https://api.kraken.com/0/public/Ticker?pair=${pair}`);

        if (response.ok) {
          const data = await response.json();
          if (data.result?.[pair]) {
            const rate = data.result[pair].c[0].toString(); // Last trade price

            const currency = await this.currencyRepository.findByCode(code);
            if (currency) {
              await this.currencyRatesHistoryRepository.createEntry(
                currency.id,
                provider,
                toDbString(rate, 8),
                config?.reliability || 90,
              );

              await this.updateCurrencyRate(code);
            }
          }
        }
      });

      await Promise.all(promises);

      this.logger.log(`✅ Successfully fetched rates from ${provider}`);
    }, provider);
  }

  /**
   * Fetch fiat rates from ExchangeRate-API
   */
  private async fetchExchangeRateAPI(): Promise<void> {
    const provider = RateProvider.ExchangeRateApi;
    if (!(await this.isProviderAvailable(provider))) {
      return;
    }

    await this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout('https://api.exchangerate-api.com/v4/latest/USD');

      if (!response.ok) {
        throw new Error(`ExchangeRate-API error: ${response.status}`);
      }

      const data = await response.json();
      const config = this.providerConfigs.find((c) => c.name === provider);

      // EUR: 1 USD = X EUR, so rate to USD = 1/X
      if (data.rates.EUR) {
        const eurToUsd = toDbString(divide(1, data.rates.EUR), 8);
        const eurCurrency = await this.currencyRepository.findByCode(CurrencyCode.Eur);

        if (eurCurrency) {
          await this.currencyRatesHistoryRepository.createEntry(
            eurCurrency.id,
            provider,
            eurToUsd,
            config?.reliability || 100,
          );

          await this.updateCurrencyRate(CurrencyCode.Eur);
        }
      }

      // RUB: 1 USD = X RUB, so rate to USD = 1/X
      if (data.rates.RUB) {
        const rubToUsd = toDbString(divide(1, data.rates.RUB), 8);
        const rubCurrency = await this.currencyRepository.findByCode(CurrencyCode.Rub);

        if (rubCurrency) {
          await this.currencyRatesHistoryRepository.createEntry(
            rubCurrency.id,
            provider,
            rubToUsd,
            config?.reliability || 100,
          );

          await this.updateCurrencyRate(CurrencyCode.Rub);
        }
      }

      this.logger.log(`✅ Successfully fetched fiat rates from ${provider}`);
    }, provider);
  }

  /**
   * Fetch fiat rates from Frankfurter (ECB data)
   */
  private async fetchFrankfurterRates(): Promise<void> {
    const provider = RateProvider.Frankfurter;
    if (!(await this.isProviderAvailable(provider))) {
      return;
    }

    await this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout('https://api.frankfurter.app/latest?from=USD&to=EUR,RUB');

      if (!response.ok) {
        throw new Error(`Frankfurter API error: ${response.status}`);
      }

      const data = await response.json();
      const config = this.providerConfigs.find((c) => c.name === provider);

      if (data.rates.EUR) {
        const eurToUsd = toDbString(divide(1, data.rates.EUR), 8);
        const eurCurrency = await this.currencyRepository.findByCode(CurrencyCode.Eur);

        if (eurCurrency) {
          await this.currencyRatesHistoryRepository.createEntry(
            eurCurrency.id,
            provider,
            eurToUsd,
            config?.reliability || 95,
          );

          await this.updateCurrencyRate(CurrencyCode.Eur);
        }
      }

      if (data.rates.RUB) {
        const rubToUsd = toDbString(divide(1, data.rates.RUB), 8);
        const rubCurrency = await this.currencyRepository.findByCode(CurrencyCode.Rub);

        if (rubCurrency) {
          await this.currencyRatesHistoryRepository.createEntry(
            rubCurrency.id,
            provider,
            rubToUsd,
            config?.reliability || 95,
          );

          await this.updateCurrencyRate(CurrencyCode.Rub);
        }
      }

      this.logger.log(`✅ Successfully fetched fiat rates from ${provider}`);
    }, provider);
  }

  /**
   * Fetch fiat rates from FreeCurrency API
   */
  private async fetchFreeCurrencyRates(): Promise<void> {
    const provider = RateProvider.FreeCurrencyApi;
    if (!(await this.isProviderAvailable(provider))) {
      return;
    }

    const apiKey = this.configService.get<string>('FREECURRENCY_API_KEY');
    if (!apiKey) {
      this.logger.warn(`${provider} API key not configured, skipping`);

      return;
    }

    await this.retryWithBackoff(async () => {
      const url = `https://api.freecurrencyapi.com/v1/latest?apikey=${apiKey}&base_currency=USD&currencies=EUR,RUB`;
      const response = await this.fetchWithTimeout(url);

      if (!response.ok) {
        throw new Error(`FreeCurrency API error: ${response.status}`);
      }

      const data = await response.json();
      const config = this.providerConfigs.find((c) => c.name === provider);

      if (data.data.EUR) {
        const eurToUsd = toDbString(divide(1, data.data.EUR), 8);
        const eurCurrency = await this.currencyRepository.findByCode(CurrencyCode.Eur);

        if (eurCurrency) {
          await this.currencyRatesHistoryRepository.createEntry(
            eurCurrency.id,
            provider,
            eurToUsd,
            config?.reliability || 85,
          );

          await this.updateCurrencyRate(CurrencyCode.Eur);
        }
      }

      if (data.data.RUB) {
        const rubToUsd = toDbString(divide(1, data.data.RUB), 8);
        const rubCurrency = await this.currencyRepository.findByCode(CurrencyCode.Rub);

        if (rubCurrency) {
          await this.currencyRatesHistoryRepository.createEntry(
            rubCurrency.id,
            provider,
            rubToUsd,
            config?.reliability || 85,
          );

          await this.updateCurrencyRate(CurrencyCode.Rub);
        }
      }

      this.logger.log(`✅ Successfully fetched fiat rates from ${provider}`);
    }, provider);
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
   * Verify we have minimum 2 providers for each currency type
   */
  private async verifyMinimumProviders(): Promise<void> {
    const cryptoCurrencies = [
      CurrencyCode.Btc,
      CurrencyCode.Eth,
      CurrencyCode.Usdt,
      CurrencyCode.Usdc,
      CurrencyCode.Bnb,
      CurrencyCode.Ton,
      CurrencyCode.Trx,
      CurrencyCode.Ltc,
      CurrencyCode.Doge,
      CurrencyCode.Dai,
      CurrencyCode.Dash,
      CurrencyCode.Bch,
      CurrencyCode.Sol,
    ];

    const fiatCurrencies = [CurrencyCode.Eur, CurrencyCode.Rub];

    // Check all currencies in parallel
    const checkPromises = [...cryptoCurrencies, ...fiatCurrencies].map(async (code) => {
      const rates = await this.currencyRatesHistoryRepository.getLatestRatesByProvider(code);

      if (rates.length < 2) {
        this.logger.error(`⚠️ CRITICAL: Only ${rates.length} provider(s) for ${code}, minimum 2 required!`);
      } else {
        this.logger.debug(`✅ ${code} has ${rates.length} active providers`);
      }
    });

    await Promise.all(checkPromises);
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
      { code: CurrencyCode.Usdt, name: 'Tether', type: CurrencyType.Crypto, rate: '1.0', symbol: '₮', decimals: 6 },
      {
        code: CurrencyCode.Usdc,
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
      { code: CurrencyCode.Ltc, name: 'Litecoin', type: CurrencyType.Crypto, rate: '70', symbol: 'LTC', decimals: 8 },
      {
        code: CurrencyCode.Doge,
        name: 'Dogecoin',
        type: CurrencyType.Crypto,
        rate: '0.08',
        symbol: 'DOGE',
        decimals: 8,
      },
      { code: CurrencyCode.Dai, name: 'DAI', type: CurrencyType.Crypto, rate: '1.0', symbol: 'DAI', decimals: 6 },
      { code: CurrencyCode.Dash, name: 'Dash', type: CurrencyType.Crypto, rate: '30', symbol: 'DASH', decimals: 8 },
      {
        code: CurrencyCode.Bch,
        name: 'Bitcoin Cash',
        type: CurrencyType.Crypto,
        rate: '350',
        symbol: 'BCH',
        decimals: 8,
      },
      { code: CurrencyCode.Sol, name: 'Solana', type: CurrencyType.Crypto, rate: '100', symbol: 'SOL', decimals: 9 },
    ];

    // Process currencies in parallel
    const initPromises = currencies.map(async (curr) => {
      const existing = await this.currencyRepository.findByCode(curr.code);

      if (!existing) {
        await this.currencyRepository.upsert(curr.code, curr.name, curr.type, curr.rate, curr.symbol);

        const currency = await this.currencyRepository.findByCode(curr.code);
        if (currency) {
          currency.decimalPlaces = curr.decimals;
          await this.currencyRepository.updateRate(curr.code, curr.rate);
        }
      }
    });

    await Promise.all(initPromises);

    this.logger.log('✅ Currencies initialized');
  }
}
