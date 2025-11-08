import { Injectable, Logger } from '@nestjs/common';
import { createHash, createHmac } from 'crypto';
import { AsyncResult, Err, Ok, toError } from '@app/common-shared';
import {
  Cryptocurrency,
  IPaymentProvider,
  PaymentBalance,
  PaymentConfigService,
  PaymentInvoice,
  PaymentStatus,
  PaymentTransaction,
  PaymentTransfer,
} from '@app/feature-payment-shared';

/**
 * CryptoBot API Response
 */
interface CryptoPayResponse<T> {
  ok: boolean;
  result?: T;
  error?: {
    code: number;
    name: string;
  };
}

/**
 * CryptoBot Invoice from API
 */
interface CryptoPayInvoice {
  invoice_id: number;
  hash: string;
  currency_type: string;
  asset?: string;
  fiat?: string;
  amount: string;
  paid_asset?: string;
  paid_amount?: string;
  fee_asset?: string;
  fee_amount?: string;
  bot_invoice_url: string;
  mini_app_invoice_url?: string;
  web_app_invoice_url?: string;
  description?: string;
  status: 'active' | 'paid' | 'expired';
  created_at: string;
  paid_at?: string;
  allow_comments: boolean;
  allow_anonymous: boolean;
  expiration_date?: string;
  paid_anonymously?: boolean;
  comment?: string;
  hidden_message?: string;
  payload?: string;
  paid_btn_name?: string;
  paid_btn_url?: string;
}

/**
 * CryptoBot Transfer from API
 */
interface CryptoPayTransfer {
  transfer_id: number;
  spend_id: string;
  user_id: string;
  asset: string;
  amount: string;
  status: 'completed';
  completed_at: string;
  comment?: string;
}

/**
 * CryptoBot Balance from API
 */
interface CryptoPayBalance {
  currency_code: string;
  available: string;
  onhold: string;
}

/**
 * CryptoBot payment provider implementation using raw HTTP requests
 * Integrates with CryptoPay API for cryptocurrency payments
 *
 * API Documentation: https://help.send.tg/en/articles/10279948-crypto-pay-api
 */
@Injectable()
export class CryptoBotProvider implements IPaymentProvider {
  private readonly logger = new Logger(CryptoBotProvider.name);
  private readonly apiToken: string;
  private readonly baseUrl: string;

  constructor(private readonly paymentConfig: PaymentConfigService) {
    this.apiToken = this.paymentConfig.getCryptoBotApiToken();
    this.baseUrl = this.paymentConfig.isTestnet() ? 'https://testnet-pay.crypt.bot/api' : 'https://pay.crypt.bot/api';

    this.logger.log(`CryptoBotProvider initialized (testnet: ${this.paymentConfig.isTestnet()})`);
  }

  /**
   * Create payment invoice for top-up
   */
  async createInvoice(params: {
    amount: string;
    currency: Cryptocurrency;
    description?: string;
    userId: string;
    expiresIn?: number;
  }): AsyncResult<PaymentInvoice, Error> {
    try {
      this.logger.log(`Creating invoice for user ${params.userId}: ${params.amount} ${params.currency}`);

      const requestParams: Record<string, unknown> = {
        currency_type: 'crypto',
        asset: this.mapCryptocurrencyToAsset(params.currency),
        amount: params.amount,
      };

      if (params.description) {
        requestParams.description = params.description;
      }

      if (params.expiresIn) {
        requestParams.expires_in = params.expiresIn;
      }

      const response = await this.makeRequest<CryptoPayInvoice>('POST', 'createInvoice', requestParams);

      if (!response.ok || !response.result) {
        this.logger.error('Failed to create invoice', response);

        return Err(new Error(response.error?.name || 'Failed to create invoice'));
      }

      const invoice = response.result;
      const paymentInvoice: PaymentInvoice = {
        invoiceId: invoice.invoice_id.toString(),
        amount: invoice.amount,
        currency: this.mapAssetToCryptocurrency(invoice.asset || 'USDT'),
        payUrl: invoice.bot_invoice_url || invoice.mini_app_invoice_url || invoice.web_app_invoice_url || '',
        expiresAt: invoice.expiration_date ? new Date(invoice.expiration_date) : undefined,
        description: invoice.description,
      };

      this.logger.log(`Invoice created: ${paymentInvoice.invoiceId}`);

      return Ok(paymentInvoice);
    } catch (error) {
      this.logger.error('Error creating invoice', error);

      return Err(toError(error));
    }
  }

  /**
   * Get invoice status by ID
   */
  async getInvoice(invoiceId: string): AsyncResult<PaymentTransaction, Error> {
    try {
      this.logger.log(`Getting invoice: ${invoiceId}`);

      const response = await this.makeRequest<{ items: CryptoPayInvoice[] }>('GET', 'getInvoices', {
        invoice_ids: invoiceId,
      });

      if (!response.ok || !response.result || response.result.items.length === 0) {
        this.logger.warn(`Invoice not found: ${invoiceId}`);

        return Err(new Error(`Invoice not found: ${invoiceId}`));
      }

      const invoice = response.result.items[0];
      const transaction: PaymentTransaction = {
        transactionId: invoice.invoice_id.toString(),
        invoiceId: invoice.invoice_id.toString(),
        amount: invoice.amount,
        currency: this.mapAssetToCryptocurrency(invoice.asset || invoice.paid_asset || 'USDT'),
        status: this.mapStatusToPaymentStatus(invoice.status),
        paidAt: invoice.paid_at ? new Date(invoice.paid_at) : undefined,
        fee: invoice.fee_amount,
      };

      return Ok(transaction);
    } catch (error) {
      this.logger.error(`Error getting invoice ${invoiceId}`, error);

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
      this.logger.log('Getting invoices history', params);

      const requestParams: Record<string, unknown> = {
        offset: params?.offset || 0,
        count: params?.count || 100,
      };

      if (params?.status) {
        const apiStatus = this.mapPaymentStatusToApiStatus(params.status);
        if (apiStatus) {
          requestParams.status = apiStatus;
        }
      }

      const response = await this.makeRequest<{ items: CryptoPayInvoice[] }>('GET', 'getInvoices', requestParams);

      if (!response.ok || !response.result) {
        this.logger.error('Failed to get invoices', response);

        return Err(new Error(response.error?.name || 'Failed to get invoices'));
      }

      const transactions: PaymentTransaction[] = response.result.items.map((invoice) => ({
        transactionId: invoice.invoice_id.toString(),
        invoiceId: invoice.invoice_id.toString(),
        amount: invoice.amount,
        currency: this.mapAssetToCryptocurrency(invoice.asset || invoice.paid_asset || 'USDT'),
        status: this.mapStatusToPaymentStatus(invoice.status),
        paidAt: invoice.paid_at ? new Date(invoice.paid_at) : undefined,
        fee: invoice.fee_amount,
      }));

      this.logger.log(`Retrieved ${transactions.length} invoices`);

      return Ok(transactions);
    } catch (error) {
      this.logger.error('Error getting invoices', error);

      return Err(toError(error));
    }
  }

  /**
   * Create transfer for withdrawal
   */
  async createTransfer(params: {
    userId: string;
    amount: string;
    currency: Cryptocurrency;
    comment?: string;
  }): AsyncResult<PaymentTransfer, Error> {
    try {
      this.logger.log(`Creating transfer for user ${params.userId}: ${params.amount} ${params.currency}`);

      const requestParams: Record<string, unknown> = {
        user_id: parseInt(params.userId, 10),
        asset: this.mapCryptocurrencyToAsset(params.currency),
        amount: params.amount,
        spend_id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      };

      if (params.comment) {
        requestParams.comment = params.comment;
      }

      const response = await this.makeRequest<CryptoPayTransfer>('POST', 'transfer', requestParams);

      if (!response.ok || !response.result) {
        this.logger.error('Failed to create transfer', response);

        return Err(new Error(response.error?.name || 'Failed to create transfer'));
      }

      const transfer = response.result;
      const paymentTransfer: PaymentTransfer = {
        transferId: transfer.transfer_id.toString(),
        amount: transfer.amount,
        currency: this.mapAssetToCryptocurrency(transfer.asset),
        status: this.mapTransferStatusToPaymentStatus(transfer.status),
        completedAt: transfer.completed_at ? new Date(transfer.completed_at) : undefined,
      };

      this.logger.log(`Transfer created: ${paymentTransfer.transferId}`);

      return Ok(paymentTransfer);
    } catch (error) {
      this.logger.error('Error creating transfer', error);

      return Err(toError(error));
    }
  }

  /**
   * Get transfer status by ID
   */
  async getTransfer(transferId: string): AsyncResult<PaymentTransfer, Error> {
    try {
      this.logger.log(`Getting transfer: ${transferId}`);

      const response = await this.makeRequest<{ items: CryptoPayTransfer[] }>('GET', 'getTransfers', {
        transfer_ids: transferId,
      });

      if (!response.ok || !response.result || response.result.items.length === 0) {
        this.logger.warn(`Transfer not found: ${transferId}`);

        return Err(new Error(`Transfer not found: ${transferId}`));
      }

      const transfer = response.result.items[0];
      const paymentTransfer: PaymentTransfer = {
        transferId: transfer.transfer_id.toString(),
        amount: transfer.amount,
        currency: this.mapAssetToCryptocurrency(transfer.asset),
        status: this.mapTransferStatusToPaymentStatus(transfer.status),
        completedAt: transfer.completed_at ? new Date(transfer.completed_at) : undefined,
      };

      return Ok(paymentTransfer);
    } catch (error) {
      this.logger.error(`Error getting transfer ${transferId}`, error);

      return Err(toError(error));
    }
  }

  /**
   * Get transfers history
   */
  async getTransfers(params?: { offset?: number; count?: number }): AsyncResult<PaymentTransfer[], Error> {
    try {
      this.logger.log('Getting transfers history', params);

      const requestParams: Record<string, unknown> = {
        offset: params?.offset || 0,
        count: params?.count || 100,
      };

      const response = await this.makeRequest<{ items: CryptoPayTransfer[] }>('GET', 'getTransfers', requestParams);

      if (!response.ok || !response.result) {
        this.logger.error('Failed to get transfers', response);

        return Err(new Error(response.error?.name || 'Failed to get transfers'));
      }

      const transfers: PaymentTransfer[] = response.result.items.map((transfer) => ({
        transferId: transfer.transfer_id.toString(),
        amount: transfer.amount,
        currency: this.mapAssetToCryptocurrency(transfer.asset),
        status: this.mapTransferStatusToPaymentStatus(transfer.status),
        completedAt: transfer.completed_at ? new Date(transfer.completed_at) : undefined,
      }));

      this.logger.log(`Retrieved ${transfers.length} transfers`);

      return Ok(transfers);
    } catch (error) {
      this.logger.error('Error getting transfers', error);

      return Err(toError(error));
    }
  }

  /**
   * Get account balances
   */
  async getBalances(): AsyncResult<PaymentBalance[], Error> {
    try {
      this.logger.log('Getting account balances');

      const response = await this.makeRequest<CryptoPayBalance[]>('GET', 'getBalance');

      if (!response.ok || !response.result) {
        this.logger.error('Failed to get balances', response);

        return Err(new Error(response.error?.name || 'Failed to get balances'));
      }

      const balances: PaymentBalance[] = response.result.map((balance) => ({
        currency: this.mapAssetToCryptocurrency(balance.currency_code),
        available: balance.available,
        onHold: balance.onhold || '0',
      }));

      this.logger.log(`Retrieved ${balances.length} balances`);

      return Ok(balances);
    } catch (error) {
      this.logger.error('Error getting balances', error);

      return Err(toError(error));
    }
  }

  /**
   * Verify webhook signature
   * According to CryptoPay documentation:
   * secret = SHA256(token)
   * signature = HMAC-SHA256(body, secret)
   */
  verifyWebhook(signature: string, body: string): boolean {
    try {
      // Create secret from API token
      const secret = createHash('sha256').update(this.apiToken).digest();

      // Create HMAC signature
      const expectedSignature = createHmac('sha256', secret).update(body).digest('hex');

      // Compare signatures
      const isValid = signature === expectedSignature;

      if (!isValid) {
        this.logger.warn('Invalid webhook signature');
      }

      return isValid;
    } catch (error) {
      this.logger.error('Error verifying webhook signature', error);

      return false;
    }
  }

  /**
   * Make HTTP request to Crypto Pay API
   */
  private async makeRequest<T>(
    method: string,
    endpoint: string,
    params?: Record<string, unknown>,
  ): Promise<CryptoPayResponse<T>> {
    const url = `${this.baseUrl}/${endpoint}`;

    try {
      const options: RequestInit = {
        method,
        headers: {
          'Crypto-Pay-API-Token': this.apiToken,
          'Content-Type': 'application/json',
        },
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

        return response.json();
      }

      const response = await fetch(url, options);

      return response.json();
    } catch (error) {
      this.logger.error(`HTTP request failed: ${method} ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * Map Cryptocurrency enum to CryptoPay asset code
   */
  private mapCryptocurrencyToAsset(currency: Cryptocurrency): string {
    return currency;
  }

  /**
   * Map CryptoPay asset code to Cryptocurrency enum
   */
  private mapAssetToCryptocurrency(asset: string): Cryptocurrency {
    const mapping: Record<string, Cryptocurrency> = {
      USDT: Cryptocurrency.Usdt,
      TON: Cryptocurrency.Ton,
      BTC: Cryptocurrency.Btc,
      ETH: Cryptocurrency.Eth,
      BNB: Cryptocurrency.Bnb,
      TRX: Cryptocurrency.Trx,
      USDC: Cryptocurrency.Usdc,
      JET: Cryptocurrency.Jet,
    };

    return mapping[asset] || Cryptocurrency.Usdt;
  }

  /**
   * Map CryptoPay invoice status to PaymentStatus enum
   */
  private mapStatusToPaymentStatus(status: string): PaymentStatus {
    const mapping: Record<string, PaymentStatus> = {
      active: PaymentStatus.Pending,
      paid: PaymentStatus.Completed,
      expired: PaymentStatus.Expired,
    };

    return mapping[status] || PaymentStatus.Pending;
  }

  /**
   * Map PaymentStatus enum to CryptoPay API status
   */
  private mapPaymentStatusToApiStatus(status: PaymentStatus): 'active' | 'paid' | 'expired' | undefined {
    const mapping: Record<PaymentStatus, 'active' | 'paid' | 'expired' | undefined> = {
      [PaymentStatus.Pending]: 'active',
      [PaymentStatus.Processing]: 'active',
      [PaymentStatus.Completed]: 'paid',
      [PaymentStatus.Failed]: undefined,
      [PaymentStatus.Cancelled]: undefined,
      [PaymentStatus.Expired]: 'expired',
    };

    return mapping[status];
  }

  /**
   * Map CryptoPay transfer status to PaymentStatus enum
   */
  private mapTransferStatusToPaymentStatus(status: string): PaymentStatus {
    const mapping: Record<string, PaymentStatus> = {
      completed: PaymentStatus.Completed,
      pending: PaymentStatus.Pending,
    };

    return mapping[status] || PaymentStatus.Pending;
  }
}
