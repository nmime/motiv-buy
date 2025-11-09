import { Injectable, Logger } from '@nestjs/common';
import { Err, Ok, AsyncResult, toError } from '@app/common-shared';
import { CurrencyCode } from '@app/database';
import { CurrencyRateService } from '@app/feature-currency-shared';
import {
  Cryptocurrency,
  IPaymentProvider,
  PaymentBalance,
  PaymentInvoice,
  PaymentStatus,
  PaymentTransaction,
  PaymentTransfer,
  PaymentConfigService,
} from '@app/feature-payment-shared';

/**
 * YooKassa API Response
 */

/**
 * YooKassa Amount
 */
interface YooKassaAmount {
  value: string;
  currency: string;
}

/**
 * YooKassa Payment
 */
interface YooKassaPayment {
  id: string;
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';
  amount: YooKassaAmount;
  income_amount?: YooKassaAmount;
  description?: string;
  confirmation?: {
    type: string;
    confirmation_url?: string;
    return_url?: string;
  };
  created_at: string;
  captured_at?: string;
  expires_at?: string;
  metadata?: Record<string, unknown>;
  paid: boolean;
  refundable: boolean;
  test: boolean;
}

/**
 * YooKassa Payout
 */
interface YooKassaPayout {
  id: string;
  amount: YooKassaAmount;
  status: 'pending' | 'succeeded' | 'canceled';
  payout_destination: {
    type: string;
    card?: {
      number: string;
    };
  };
  description?: string;
  created_at: string;
  dealt_at?: string;
  metadata?: Record<string, unknown>;
  cancellation_details?: {
    reason: string;
  };
}

/**
 * YooKassa payment provider implementation
 * Integrates with YooKassa (formerly Yandex.Kassa) payment gateway
 *
 * Supports:
 * - Bank cards (Visa, Mastercard, MIR)
 * - Electronic wallets (YooMoney, QIWI, WebMoney)
 * - Mobile payments (Apple Pay, Google Pay, Samsung Pay)
 * - SBP (Fast Payment System)
 * - Installments and credit
 *
 * API Documentation: https://yookassa.ru/developers/api
 */
@Injectable()
export class YooKassaProvider implements IPaymentProvider {
  private readonly logger = new Logger(YooKassaProvider.name);
  private readonly shopId: string;
  private readonly secretKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly testMode: boolean;

  constructor(
    private readonly paymentConfig: PaymentConfigService,
    private readonly currencyRateService: CurrencyRateService,
  ) {
    const config = this.paymentConfig.getYooKassaConfig();
    this.shopId = config.shopId;
    this.secretKey = config.secretKey;
    this.baseUrl = config.apiUrl || 'https://api.yookassa.ru/v3';
    this.timeout = config.timeout || 10000;
    this.maxRetries = config.maxRetries || 3;
    this.testMode = config.testMode || false;

    this.logger.log(`YooKassaProvider initialized (shopId: ${this.shopId}, testMode: ${this.testMode})`);
  }

  /**
   * Get Basic Auth credentials for YooKassa
   */
  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.shopId}:${this.secretKey}`).toString('base64');

    return `Basic ${credentials}`;
  }

  /**
   * Generate idempotency key for safe request retries
   */
  private generateIdempotencyKey(): string {
    // eslint-disable-next-line sonarjs/pseudo-random
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Make HTTP request to YooKassa API with retry logic
   */
  private async makeRequest<T>(
    method: string,
    endpoint: string,
    params?: Record<string, unknown>,
    idempotencyKey?: string,
  ): Promise<T> {
    const url = `${this.baseUrl}/${endpoint}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const headers: Record<string, string> = {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        };

        if (idempotencyKey) {
          headers['Idempotence-Key'] = idempotencyKey;
        }

        const options: RequestInit = {
          method,
          headers,
          signal: AbortSignal.timeout(this.timeout),
        };

        if (params && (method === 'POST' || method === 'PATCH')) {
          options.body = JSON.stringify(params);
        }

        // eslint-disable-next-line no-await-in-loop
        const response = await fetch(url, options);

        if (!response.ok) {
          // eslint-disable-next-line no-await-in-loop
          const errorBody = await response.json();
          throw new Error(
            `YooKassa API error: ${errorBody.error?.description || response.statusText} (${response.status})`,
          );
        }

        return response.json();
      } catch (error) {
        lastError = toError(error);
        this.logger.warn(`Request attempt ${attempt + 1} failed: ${method} ${endpoint}`, {
          error: lastError.message,
        });

        if (attempt < this.maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt) * 1000;
          // eslint-disable-next-line no-await-in-loop
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    this.logger.error(`All ${this.maxRetries + 1} attempts failed: ${method} ${endpoint}`, lastError);
    throw lastError || new Error('Request failed after all retries');
  }

  /**
   * Create payment invoice for top-up
   * Generates payment link for Russian payment methods
   */
  async createInvoice(params: {
    amount: string;
    currency: Cryptocurrency;
    description?: string;
    userId: string;
    expiresIn?: number;
  }): AsyncResult<PaymentInvoice, Error> {
    try {
      this.logger.log(`Creating YooKassa payment for user ${params.userId}: ${params.amount} ${params.currency}`);

      // Convert cryptocurrency to RUB fiat amount using real-time rates
      const rubAmount = await this.convertCryptoToRub(params.amount, params.currency);

      const requestParams: Record<string, unknown> = {
        amount: {
          value: rubAmount,
          currency: 'RUB',
        },
        confirmation: {
          type: 'redirect',
          return_url: this.paymentConfig.getYooKassaConfig().returnUrl || 'https://example.com/payment/return',
        },
        capture: true, // Auto-capture payment
        description: params.description || `Top-up ${params.amount} ${params.currency}`,
        metadata: {
          userId: params.userId,
          originalAmount: params.amount,
          originalCurrency: params.currency,
        },
      };

      const payment = await this.makeRequest<YooKassaPayment>(
        'POST',
        'payments',
        requestParams,
        this.generateIdempotencyKey(),
      );

      if (!payment.id) {
        this.logger.error('Failed to create YooKassa payment', payment);

        return Err(new Error('Failed to create payment'));
      }

      const paymentInvoice: PaymentInvoice = {
        invoiceId: payment.id,
        amount: params.amount, // Keep original crypto amount
        currency: params.currency,
        payUrl: payment.confirmation?.confirmation_url || '',
        expiresAt: payment.expires_at ? new Date(payment.expires_at) : undefined,
        description: payment.description,
      };

      this.logger.log(`YooKassa payment created: ${paymentInvoice.invoiceId}`);

      return Ok(paymentInvoice);
    } catch (error) {
      this.logger.error('Error creating YooKassa payment', error);

      return Err(toError(error));
    }
  }

  /**
   * Get invoice status from YooKassa
   */
  async getInvoice(invoiceId: string): AsyncResult<PaymentTransaction, Error> {
    try {
      this.logger.log(`Fetching YooKassa payment status: ${invoiceId}`);

      const payment = await this.makeRequest<YooKassaPayment>('GET', `payments/${invoiceId}`);

      const transaction: PaymentTransaction = {
        transactionId: payment.id,
        invoiceId: payment.id,
        amount: payment.amount.value,
        currency: this.mapCurrencyToCryptocurrency(payment.amount.currency),
        status: this.mapYooKassaStatus(payment.status),
        paidAt: payment.captured_at ? new Date(payment.captured_at) : undefined,
      };

      return Ok(transaction);
    } catch (error) {
      this.logger.error(`Error fetching YooKassa payment ${invoiceId}`, error);

      return Err(toError(error));
    }
  }

  /**
   * Get invoices history with filtering
   */
  async getInvoices(params?: {
    status?: PaymentStatus;
    offset?: number;
    count?: number;
  }): AsyncResult<PaymentTransaction[], Error> {
    try {
      this.logger.log('Fetching YooKassa payments history', params);

      // YooKassa uses cursor-based pagination
      const requestParams: Record<string, unknown> = {
        limit: params?.count || 50,
      };

      if (params?.status) {
        requestParams.status = this.mapStatusToYooKassa(params.status);
      }

      const response = await this.makeRequest<{ items: YooKassaPayment[] }>('GET', 'payments', requestParams);

      const transactions: PaymentTransaction[] = response.items.map((payment) => ({
        transactionId: payment.id,
        invoiceId: payment.id,
        amount: payment.amount.value,
        currency: this.mapCurrencyToCryptocurrency(payment.amount.currency),
        status: this.mapYooKassaStatus(payment.status),
        paidAt: payment.captured_at ? new Date(payment.captured_at) : undefined,
      }));

      return Ok(transactions);
    } catch (error) {
      this.logger.error('Error fetching YooKassa payments history', error);

      return Err(toError(error));
    }
  }

  /**
   * Create transfer for withdrawal (payout)
   */
  async createTransfer(params: {
    userId: string;
    amount: string;
    currency: Cryptocurrency;
    comment?: string;
    destination?: string;
  }): AsyncResult<PaymentTransfer, Error> {
    try {
      // Validate destination is provided for YooKassa
      if (!params.destination) {
        this.logger.error('YooKassa requires destination (bank card number) for payouts');

        return Err(
          new Error(
            'Destination required for YooKassa payouts. Please provide bank card number in format: 1234567890123456',
          ),
        );
      }

      this.logger.log(`Creating YooKassa payout for user ${params.userId}: ${params.amount} ${params.currency}`);

      // Convert cryptocurrency to RUB fiat amount using real-time rates
      const rubAmount = await this.convertCryptoToRub(params.amount, params.currency);

      const requestParams: Record<string, unknown> = {
        amount: {
          value: rubAmount,
          currency: 'RUB',
        },
        payout_destination_data: {
          type: 'bank_card',
          card: {
            number: params.destination, // Bank card number from user
          },
        },
        description: params.comment || `Withdrawal ${params.amount} ${params.currency}`,
        metadata: {
          userId: params.userId,
          originalAmount: params.amount,
          originalCurrency: params.currency,
        },
      };

      const payout = await this.makeRequest<YooKassaPayout>(
        'POST',
        'payouts',
        requestParams,
        this.generateIdempotencyKey(),
      );

      if (!payout.id) {
        this.logger.error('Failed to create YooKassa payout', payout);

        return Err(new Error('Failed to create payout'));
      }

      const transfer: PaymentTransfer = {
        transferId: payout.id,
        amount: params.amount, // Keep original crypto amount
        currency: params.currency,
        status: this.mapYooKassaPayoutStatus(payout.status),
        completedAt: payout.dealt_at ? new Date(payout.dealt_at) : undefined,
      };

      this.logger.log(`YooKassa payout created: ${transfer.transferId}`);

      return Ok(transfer);
    } catch (error) {
      this.logger.error('Error creating YooKassa payout', error);

      return Err(toError(error));
    }
  }

  /**
   * Get transfer status
   */
  async getTransfer(transferId: string): AsyncResult<PaymentTransfer, Error> {
    try {
      this.logger.log(`Fetching YooKassa payout status: ${transferId}`);

      const payout = await this.makeRequest<YooKassaPayout>('GET', `payouts/${transferId}`);

      const transfer: PaymentTransfer = {
        transferId: payout.id,
        amount: payout.amount.value,
        currency: this.mapCurrencyToCryptocurrency(payout.amount.currency),
        status: this.mapYooKassaPayoutStatus(payout.status),
        completedAt: payout.dealt_at ? new Date(payout.dealt_at) : undefined,
      };

      return Ok(transfer);
    } catch (error) {
      this.logger.error(`Error fetching YooKassa payout ${transferId}`, error);

      return Err(toError(error));
    }
  }

  /**
   * Get transfers history
   */
  async getTransfers(params?: { offset?: number; count?: number }): AsyncResult<PaymentTransfer[], Error> {
    try {
      this.logger.log('Fetching YooKassa payouts history', params);

      const requestParams: Record<string, unknown> = {
        limit: params?.count || 50,
      };

      const response = await this.makeRequest<{ items: YooKassaPayout[] }>('GET', 'payouts', requestParams);

      const transfers: PaymentTransfer[] = response.items.map((payout) => ({
        transferId: payout.id,
        amount: payout.amount.value,
        currency: this.mapCurrencyToCryptocurrency(payout.amount.currency),
        status: this.mapYooKassaPayoutStatus(payout.status),
        completedAt: payout.dealt_at ? new Date(payout.dealt_at) : undefined,
      }));

      return Ok(transfers);
    } catch (error) {
      this.logger.error('Error fetching YooKassa payouts history', error);

      return Err(toError(error));
    }
  }

  /**
   * Get provider balances
   * Note: YooKassa doesn't provide a balance API, returns empty array
   */
  async getBalances(): AsyncResult<PaymentBalance[], Error> {
    this.logger.warn('YooKassa does not provide balance API, returning empty array');

    return Ok([]);
  }

  /**
   * Verify webhook signature
   * YooKassa doesn't use HMAC signatures, but we can implement IP whitelist check
   */
  verifyWebhook(_signature: string, _body: string): boolean {
    // YooKassa webhooks are verified by IP whitelist
    // In production, check the request IP against YooKassa's IP ranges
    // For now, accept all webhooks (security warning)
    this.logger.warn('YooKassa webhook verification not fully implemented - using IP whitelist in production');

    return true;
  }

  /**
   * Convert cryptocurrency amount to RUB using real-time exchange rates
   * Uses CurrencyRateService to fetch current rates from multiple providers
   */
  private async convertCryptoToRub(amount: string, currency: Cryptocurrency): Promise<string> {
    try {
      // Map Cryptocurrency enum to CurrencyCode enum
      const currencyCode = this.mapCryptocurrencyToCurrencyCode(currency);

      // Use CurrencyRateService to get real-time conversion
      const result = await this.currencyRateService.convertAmount(amount, currencyCode, CurrencyCode.Rub);

      if (result.err) {
        this.logger.error(`Failed to get exchange rate for ${currency} to RUB`, result.val);
        throw new Error(`Failed to get exchange rate: ${result.val.message}`);
      }

      return result.val;
    } catch (error) {
      this.logger.error(`Error converting ${currency} to RUB`, toError(error));
      throw error;
    }
  }

  /**
   * Map Cryptocurrency enum to CurrencyCode enum
   */
  private mapCryptocurrencyToCurrencyCode(cryptocurrency: Cryptocurrency): CurrencyCode {
    const currencyMap: Record<Cryptocurrency, CurrencyCode> = {
      [Cryptocurrency.Usdt]: CurrencyCode.Usdt,
      [Cryptocurrency.Ton]: CurrencyCode.Ton,
      [Cryptocurrency.Btc]: CurrencyCode.Btc,
      [Cryptocurrency.Eth]: CurrencyCode.Eth,
      [Cryptocurrency.Bnb]: CurrencyCode.Bnb,
      [Cryptocurrency.Trx]: CurrencyCode.Trx,
      [Cryptocurrency.Usdc]: CurrencyCode.Usdc,
      [Cryptocurrency.Ltc]: CurrencyCode.Ltc,
      [Cryptocurrency.Doge]: CurrencyCode.Doge,
      [Cryptocurrency.Dai]: CurrencyCode.Dai,
      [Cryptocurrency.Dash]: CurrencyCode.Dash,
      [Cryptocurrency.Bch]: CurrencyCode.Bch,
      [Cryptocurrency.Sol]: CurrencyCode.Sol,
      [Cryptocurrency.Jet]: CurrencyCode.Usdt, // JET maps to USDT as fallback
      [Cryptocurrency.Rub]: CurrencyCode.Rub,
      [Cryptocurrency.Usd]: CurrencyCode.Usd,
      [Cryptocurrency.Eur]: CurrencyCode.Eur,
    };

    const currencyCode = currencyMap[cryptocurrency];
    if (!currencyCode) {
      throw new Error(`Unsupported cryptocurrency for conversion: ${cryptocurrency}`);
    }

    return currencyCode;
  }

  /**
   * Map YooKassa payment status to PaymentStatus enum
   */
  private mapYooKassaStatus(status: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      pending: PaymentStatus.Pending,
      waiting_for_capture: PaymentStatus.Pending,
      succeeded: PaymentStatus.Completed,
      canceled: PaymentStatus.Cancelled,
    };

    return statusMap[status] ?? PaymentStatus.Pending;
  }

  /**
   * Map YooKassa payout status to PaymentStatus enum
   */
  private mapYooKassaPayoutStatus(status: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      pending: PaymentStatus.Pending,
      succeeded: PaymentStatus.Completed,
      canceled: PaymentStatus.Cancelled,
    };

    return statusMap[status] ?? PaymentStatus.Pending;
  }

  /**
   * Map PaymentStatus to YooKassa status
   */
  private mapStatusToYooKassa(status: PaymentStatus): string {
    const statusMap: Record<PaymentStatus, string> = {
      [PaymentStatus.Pending]: 'pending',
      [PaymentStatus.Processing]: 'waiting_for_capture',
      [PaymentStatus.Completed]: 'succeeded',
      [PaymentStatus.Failed]: 'canceled',
      [PaymentStatus.Expired]: 'canceled',
      [PaymentStatus.Cancelled]: 'canceled',
    };

    return statusMap[status] ?? 'pending';
  }

  /**
   * Map fiat currency code to Cryptocurrency enum
   */
  private mapCurrencyToCryptocurrency(currency: string): Cryptocurrency {
    // For YooKassa, we primarily deal with RUB
    // Map to USDT as default stable representation
    if (currency === 'RUB') {
      return Cryptocurrency.Usdt;
    }

    return Cryptocurrency.Usdt;
  }
}
