import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import { Err, Ok, AsyncResult, toError } from '@app/common-shared';
import { decimal, toDbString } from '@app/common-shared/util';
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
 * Heleket API Response
 */
interface HelekeResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Heleket Payment Order
 */
interface HelekePaymentOrder {
  orderId: string;
  merchantId: string;
  amount: string;
  currency: string;
  status: 'pending' | 'success' | 'failed' | 'expired' | 'cancelled';
  paymentUrl: string;
  createdAt: string;
  paidAt?: string;
  expiredAt?: string;
  description?: string;
  customerEmail?: string;
  customerPhone?: string;
}

/**
 * Heleket Payout
 */
interface HelekePayout {
  payoutId: string;
  merchantId: string;
  amount: string;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  cardNumber?: string;
  sbpPhone?: string;
  walletId?: string;
  createdAt: string;
  completedAt?: string;
  failureReason?: string;
}

/**
 * Heleket Balance
 */
interface HelekeBalance {
  currency: string;
  available: string;
  frozen: string;
}

/**
 * Heleket payment provider implementation
 * Integrates with Heleket cryptocurrency payment gateway
 *
 * Heleket is a CRYPTO-NATIVE gateway that accepts cryptocurrencies directly
 * on multiple blockchain networks without fiat conversion.
 *
 * Supported Cryptocurrencies:
 * - BTC, ETH, USDT, USDC (major cryptocurrencies)
 * - BNB, TRX, TON (alt coins)
 * - LTC, DOGE, DAI, DASH, BCH, SOL (additional coins)
 *
 * Multi-chain support:
 * - USDT: Tron (TRC-20), Ethereum (ERC-20), TON
 * - USDC: Ethereum (ERC-20), BSC (BEP-20)
 *
 * API Documentation: https://doc.heleket.com/
 */
@Injectable()
export class HelekeProvider implements IPaymentProvider {
  private readonly logger = new Logger(HelekeProvider.name);
  private readonly apiToken: string;
  private readonly merchantId: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor(private readonly paymentConfig: PaymentConfigService) {
    const config = this.paymentConfig.getHelekeConfig();
    this.apiToken = config.apiToken;
    this.merchantId = config.merchantId;
    this.baseUrl = config.apiUrl || 'https://api.heleket.com/v1';
    this.timeout = config.timeout || 10000;
    this.maxRetries = config.maxRetries || 3;

    this.logger.log(
      `HelekeProvider initialized (merchantId: ${this.merchantId}, testMode: ${config.testMode || false})`,
    );
  }

  /**
   * Make HTTP request to Heleket API with retry logic
   */
  private async makeRequest<T>(
    method: string,
    endpoint: string,
    params?: Record<string, unknown>,
  ): Promise<HelekeResponse<T>> {
    const url = `${this.baseUrl}/${endpoint}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const options: RequestInit = {
          method,
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
            'X-Merchant-Id': this.merchantId,
          },
          signal: AbortSignal.timeout(this.timeout),
        };

        if (params && method === 'POST') {
          options.body = JSON.stringify(params);
        } else if (params && method === 'GET') {
          const queryString = new URLSearchParams(
            Object.entries(params).reduce(
              (acc, [key, value]) => {
                if (value !== undefined && value !== null) {
                  return { ...acc, [key]: String(value) };
                }

                return acc;
              },
              {} as Record<string, string>,
            ),
          ).toString();

          const fullUrl = queryString ? `${url}?${queryString}` : url;
          const response = await fetch(fullUrl, options);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          return response.json();
        }

        const response = await fetch(url, options);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
      this.logger.log(`Creating Heleket payment for user ${params.userId}: ${params.amount} ${params.currency}`);

      // Heleket is a crypto-native gateway - accept cryptocurrencies directly
      const network = this.selectNetwork(params.currency);

      const requestParams: Record<string, unknown> = {
        merchantId: this.merchantId,
        amount: params.amount,
        currency: params.currency,
        network,
        orderId: `USER_${params.userId}_${Date.now()}`,
        description: params.description || `Top-up ${params.amount} ${params.currency}`,
        expiresIn: params.expiresIn || 3600, // 1 hour default
      };

      const response = await this.makeRequest<HelekePaymentOrder>('POST', 'payments/create', requestParams);

      if (!response.success || !response.data) {
        this.logger.error('Failed to create Heleket payment', response.error);

        return Err(new Error(response.error?.message || 'Failed to create payment'));
      }

      const order = response.data;
      const paymentInvoice: PaymentInvoice = {
        invoiceId: order.orderId,
        amount: params.amount,
        currency: params.currency,
        payUrl: order.paymentUrl,
        expiresAt: order.expiredAt ? new Date(order.expiredAt) : undefined,
        description: order.description,
      };

      this.logger.log(`Heleket payment created: ${paymentInvoice.invoiceId} on ${network} network`);

      return Ok(paymentInvoice);
    } catch (error) {
      this.logger.error('Error creating Heleket payment', error);

      return Err(toError(error));
    }
  }

  /**
   * Get invoice status from Heleket
   */
  async getInvoice(invoiceId: string): AsyncResult<PaymentTransaction, Error> {
    try {
      this.logger.log(`Fetching Heleket payment status: ${invoiceId}`);

      const response = await this.makeRequest<HelekePaymentOrder>('GET', `payments/${invoiceId}`);

      if (!response.success || !response.data) {
        this.logger.error('Failed to get Heleket payment', response.error);

        return Err(new Error(response.error?.message || 'Failed to get payment status'));
      }

      const order = response.data;
      const transaction: PaymentTransaction = {
        transactionId: order.orderId,
        invoiceId: order.orderId,
        amount: order.amount,
        currency: this.mapCurrencyToCryptocurrency(order.currency),
        status: this.mapHelekeStatus(order.status),
        paidAt: order.paidAt ? new Date(order.paidAt) : undefined,
      };

      return Ok(transaction);
    } catch (error) {
      this.logger.error(`Error fetching Heleket payment ${invoiceId}`, error);

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
      this.logger.log('Fetching Heleket payments history', params);

      const requestParams: Record<string, unknown> = {
        limit: params?.count || 50,
        offset: params?.offset || 0,
      };

      if (params?.status) {
        requestParams.status = this.mapStatusToHeleke(params.status);
      }

      const response = await this.makeRequest<HelekePaymentOrder[]>('GET', 'payments', requestParams);

      if (!response.success || !response.data) {
        this.logger.error('Failed to get Heleket payments history', response.error);

        return Err(new Error(response.error?.message || 'Failed to get payments history'));
      }

      const transactions: PaymentTransaction[] = response.data.map((order) => ({
        transactionId: order.orderId,
        invoiceId: order.orderId,
        amount: order.amount,
        currency: this.mapCurrencyToCryptocurrency(order.currency),
        status: this.mapHelekeStatus(order.status),
        paidAt: order.paidAt ? new Date(order.paidAt) : undefined,
      }));

      return Ok(transactions);
    } catch (error) {
      this.logger.error('Error fetching Heleket payments history', error);

      return Err(toError(error));
    }
  }

  /**
   * Create transfer for withdrawal
   * Heleket supports payouts to cards, SBP, and wallets
   */
  async createTransfer(params: {
    userId: string;
    amount: string;
    currency: Cryptocurrency;
    comment?: string;
  }): AsyncResult<PaymentTransfer, Error> {
    try {
      this.logger.log(`Creating Heleket payout for user ${params.userId}: ${params.amount} ${params.currency}`);

      // Heleket is crypto-native - send cryptocurrencies directly
      const network = this.selectNetwork(params.currency);

      const requestParams: Record<string, unknown> = {
        merchantId: this.merchantId,
        amount: params.amount,
        currency: params.currency,
        network,
        payoutId: `PAYOUT_${params.userId}_${Date.now()}`,
        comment: params.comment,
      };

      const response = await this.makeRequest<HelekePayout>('POST', 'payouts/create', requestParams);

      if (!response.success || !response.data) {
        this.logger.error('Failed to create Heleket payout', response.error);

        return Err(new Error(response.error?.message || 'Failed to create payout'));
      }

      const payout = response.data;
      const transfer: PaymentTransfer = {
        transferId: payout.payoutId,
        amount: params.amount,
        currency: params.currency,
        status: this.mapHelekePayoutStatus(payout.status),
        completedAt: payout.completedAt ? new Date(payout.completedAt) : undefined,
      };

      this.logger.log(`Heleket payout created: ${transfer.transferId} on ${network} network`);

      return Ok(transfer);
    } catch (error) {
      this.logger.error('Error creating Heleket payout', error);

      return Err(toError(error));
    }
  }

  /**
   * Get transfer status
   */
  async getTransfer(transferId: string): AsyncResult<PaymentTransfer, Error> {
    try {
      this.logger.log(`Fetching Heleket payout status: ${transferId}`);

      const response = await this.makeRequest<HelekePayout>('GET', `payouts/${transferId}`);

      if (!response.success || !response.data) {
        this.logger.error('Failed to get Heleket payout', response.error);

        return Err(new Error(response.error?.message || 'Failed to get payout status'));
      }

      const payout = response.data;
      const transfer: PaymentTransfer = {
        transferId: payout.payoutId,
        amount: payout.amount,
        currency: this.mapCurrencyToCryptocurrency(payout.currency),
        status: this.mapHelekePayoutStatus(payout.status),
        completedAt: payout.completedAt ? new Date(payout.completedAt) : undefined,
      };

      return Ok(transfer);
    } catch (error) {
      this.logger.error(`Error fetching Heleket payout ${transferId}`, error);

      return Err(toError(error));
    }
  }

  /**
   * Get transfers history
   */
  async getTransfers(params?: { offset?: number; count?: number }): AsyncResult<PaymentTransfer[], Error> {
    try {
      this.logger.log('Fetching Heleket payouts history', params);

      const requestParams: Record<string, unknown> = {
        limit: params?.count || 50,
        offset: params?.offset || 0,
      };

      const response = await this.makeRequest<HelekePayout[]>('GET', 'payouts', requestParams);

      if (!response.success || !response.data) {
        this.logger.error('Failed to get Heleket payouts history', response.error);

        return Err(new Error(response.error?.message || 'Failed to get payouts history'));
      }

      const transfers: PaymentTransfer[] = response.data.map((payout) => ({
        transferId: payout.payoutId,
        amount: payout.amount,
        currency: this.mapCurrencyToCryptocurrency(payout.currency),
        status: this.mapHelekePayoutStatus(payout.status),
        completedAt: payout.completedAt ? new Date(payout.completedAt) : undefined,
      }));

      return Ok(transfers);
    } catch (error) {
      this.logger.error('Error fetching Heleket payouts history', error);

      return Err(toError(error));
    }
  }

  /**
   * Get provider balances
   */
  async getBalances(): AsyncResult<PaymentBalance[], Error> {
    try {
      this.logger.log('Fetching Heleket balances');

      const response = await this.makeRequest<HelekeBalance[]>('GET', 'balance');

      if (!response.success || !response.data) {
        this.logger.error('Failed to get Heleket balances', response.error);

        return Err(new Error(response.error?.message || 'Failed to get balances'));
      }

      const balances: PaymentBalance[] = response.data.map((balance) => ({
        currency: this.mapCurrencyToCryptocurrency(balance.currency),
        available: balance.available,
        onHold: balance.frozen,
      }));

      return Ok(balances);
    } catch (error) {
      this.logger.error('Error fetching Heleket balances', error);

      return Err(toError(error));
    }
  }

  /**
   * Verify webhook signature using HMAC-SHA256
   */
  verifyWebhook(signature: string, body: string): boolean {
    try {
      const hmac = createHmac('sha256', this.apiToken);
      hmac.update(body);
      const expectedSignature = hmac.digest('hex');

      return signature === expectedSignature;
    } catch (error) {
      this.logger.error('Error verifying Heleket webhook signature', error);

      return false;
    }
  }

  /**
   * Select blockchain network for cryptocurrency
   * Heleket supports multiple networks for multi-chain assets like USDT and USDC
   */
  private selectNetwork(currency: Cryptocurrency): string {
    // Network mapping for cryptocurrencies
    // Prefer networks with lower fees and faster confirmation
    const NETWORK_MAP: Record<string, string> = {
      USDT: 'tron', // TRC-20 (lowest fees)
      USDC: 'ethereum', // ERC-20
      BTC: 'bitcoin',
      ETH: 'ethereum',
      BNB: 'bsc', // BSC (BEP-20)
      TRX: 'tron',
      TON: 'ton',
      LTC: 'litecoin',
      DOGE: 'dogecoin',
      DAI: 'ethereum',
      DASH: 'dash',
      BCH: 'bitcoin-cash',
      SOL: 'solana',
    };

    return NETWORK_MAP[currency] || currency.toLowerCase();
  }

  /**
   * Map Heleket payment status to PaymentStatus enum
   */
  private mapHelekeStatus(status: string): PaymentStatus {
    const STATUS_MAP: Record<string, PaymentStatus> = {
      pending: PaymentStatus.Pending,
      success: PaymentStatus.Completed,
      failed: PaymentStatus.Failed,
      expired: PaymentStatus.Expired,
      cancelled: PaymentStatus.Cancelled,
    };

    return STATUS_MAP[status] ?? PaymentStatus.Pending;
  }

  /**
   * Map Heleket payout status to PaymentStatus enum
   */
  private mapHelekePayoutStatus(status: string): PaymentStatus {
    const STATUS_MAP: Record<string, PaymentStatus> = {
      pending: PaymentStatus.Pending,
      processing: PaymentStatus.Processing,
      completed: PaymentStatus.Completed,
      failed: PaymentStatus.Failed,
    };

    return STATUS_MAP[status] ?? PaymentStatus.Pending;
  }

  /**
   * Map PaymentStatus to Heleket status
   */
  private mapStatusToHeleke(status: PaymentStatus): string {
    const STATUS_MAP: Record<PaymentStatus, string> = {
      [PaymentStatus.Pending]: 'pending',
      [PaymentStatus.Processing]: 'processing',
      [PaymentStatus.Completed]: 'success',
      [PaymentStatus.Failed]: 'failed',
      [PaymentStatus.Expired]: 'expired',
      [PaymentStatus.Cancelled]: 'cancelled',
    };

    return STATUS_MAP[status] ?? 'pending';
  }

  /**
   * Map currency string to Cryptocurrency enum
   * Heleket is crypto-native and returns actual cryptocurrency codes
   */
  private mapCurrencyToCryptocurrency(currency: string): Cryptocurrency {
    const CURRENCY_MAP: Record<string, Cryptocurrency> = {
      USDT: Cryptocurrency.Usdt,
      BTC: Cryptocurrency.Btc,
      ETH: Cryptocurrency.Eth,
      USDC: Cryptocurrency.Usdc,
      BNB: Cryptocurrency.Bnb,
      TRX: Cryptocurrency.Trx,
      TON: Cryptocurrency.Ton,
      LTC: Cryptocurrency.Ltc,
      DOGE: Cryptocurrency.Doge,
      DAI: Cryptocurrency.Dai,
      DASH: Cryptocurrency.Dash,
      BCH: Cryptocurrency.Bch,
      SOL: Cryptocurrency.Sol,
    };

    return CURRENCY_MAP[currency.toUpperCase()] || Cryptocurrency.Usdt;
  }
}
