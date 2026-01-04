import { Injectable, Logger } from '@nestjs/common';
import { createHash, createHmac } from 'crypto';
import { AsyncResult, Err, Ok, toError } from '@app/common-shared';
import { Cryptocurrency, PaymentStatus } from '@app/database';
import { IPaymentProvider, PaymentBalance, PaymentInvoice, PaymentTransaction, PaymentTransfer } from '../interface';
import { PaymentConfigService } from '../config';

interface CryptoPayResponse<T> {
  ok: boolean;
  result?: T;
  error?: { code: number; name: string };
}

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

interface CryptoPayBalance {
  currency_code: string;
  available: string;
  onhold: string;
}

const invoiceStatusMap: Record<string, PaymentStatus> = {
  active: PaymentStatus.Pending,
  paid: PaymentStatus.Completed,
  expired: PaymentStatus.Expired,
};

const transferStatusMap: Record<string, PaymentStatus> = {
  completed: PaymentStatus.Completed,
  pending: PaymentStatus.Pending,
};

const assetToCrypto: Record<string, Cryptocurrency> = {
  USDT: Cryptocurrency.Usdt,
  TON: Cryptocurrency.Ton,
  BTC: Cryptocurrency.Btc,
  ETH: Cryptocurrency.Eth,
  BNB: Cryptocurrency.Bnb,
  TRX: Cryptocurrency.Trx,
  USDC: Cryptocurrency.Usdc,
  JET: Cryptocurrency.Jet,
};

/**
 * CryptoBot payment provider (@CryptoBot / @CryptoTestnetBot on Telegram).
 * API docs: https://help.send.tg/en/articles/10279948-crypto-pay-api
 */
@Injectable()
export class CryptoBotProvider implements IPaymentProvider {
  private readonly logger = new Logger(CryptoBotProvider.name);
  private readonly apiToken?: string;
  private readonly baseUrl: string;

  constructor(private readonly paymentConfig: PaymentConfigService) {
    this.apiToken = this.paymentConfig.getCryptoBotApiToken();
    this.baseUrl = this.paymentConfig.getCryptoBotApiUrl();

    if (!this.apiToken) {
      this.logger.warn('No API token configured - provider disabled. Set CRYPTO_BOT_API_TOKEN.');
    } else {
      this.logger.log(`Initialized (url: ${this.baseUrl})`);
    }
  }

  async createInvoice(params: {
    amount: string;
    currency: Cryptocurrency;
    description?: string;
    userId: string;
    expiresIn?: number;
  }): AsyncResult<PaymentInvoice, Error> {
    try {
      this.logger.log(`Creating invoice: ${params.amount} ${params.currency} for user ${params.userId}`);

      const requestParams: Record<string, unknown> = {
        currency_type: 'crypto',
        asset: params.currency,
        amount: params.amount,
        ...(params.description && { description: params.description }),
        ...(params.expiresIn && { expires_in: params.expiresIn }),
      };

      const response = await this.request<CryptoPayInvoice>('POST', 'createInvoice', requestParams);

      if (!response.ok || !response.result) {
        this.logger.error('Failed to create invoice', response);

        return Err(new Error(response.error?.name || 'Failed to create invoice'));
      }

      const invoice = response.result;
      const result: PaymentInvoice = {
        invoiceId: invoice.invoice_id.toString(),
        amount: invoice.amount,
        currency: this.mapAsset(invoice.asset || 'USDT'),
        payUrl: invoice.bot_invoice_url || invoice.mini_app_invoice_url || invoice.web_app_invoice_url || '',
        expiresAt: invoice.expiration_date ? new Date(invoice.expiration_date) : undefined,
        description: invoice.description,
      };

      this.logger.log(`Invoice created: ${result.invoiceId}`);

      return Ok(result);
    } catch (error) {
      this.logger.error('Error creating invoice', error);

      return Err(toError(error));
    }
  }

  async getInvoice(invoiceId: string): AsyncResult<PaymentTransaction, Error> {
    try {
      const response = await this.request<{ items: CryptoPayInvoice[] }>('GET', 'getInvoices', {
        invoice_ids: invoiceId,
      });

      if (!response.ok || !response.result?.items?.length) {
        return Err(new Error(`Invoice not found: ${invoiceId}`));
      }

      const [invoice] = response.result.items;

      return Ok({
        transactionId: invoice.invoice_id.toString(),
        invoiceId: invoice.invoice_id.toString(),
        amount: invoice.amount,
        currency: this.mapAsset(invoice.asset || invoice.paid_asset || 'USDT'),
        status: invoiceStatusMap[invoice.status] || PaymentStatus.Pending,
        paidAt: invoice.paid_at ? new Date(invoice.paid_at) : undefined,
        fee: invoice.fee_amount,
      });
    } catch (error) {
      this.logger.error(`Error getting invoice ${invoiceId}`, error);

      return Err(toError(error));
    }
  }

  async getInvoices(params?: {
    status?: PaymentStatus;
    offset?: number;
    count?: number;
  }): AsyncResult<PaymentTransaction[], Error> {
    try {
      const statusMap: Partial<Record<PaymentStatus, string>> = {
        [PaymentStatus.Pending]: 'active',
        [PaymentStatus.Processing]: 'active',
        [PaymentStatus.Completed]: 'paid',
        [PaymentStatus.Expired]: 'expired',
      };

      const requestParams: Record<string, unknown> = {
        offset: params?.offset || 0,
        count: params?.count || 100,
        ...(params?.status && statusMap[params.status] && { status: statusMap[params.status] }),
      };

      const response = await this.request<{ items: CryptoPayInvoice[] }>('GET', 'getInvoices', requestParams);

      if (!response.ok || !response.result) {
        return Err(new Error(response.error?.name || 'Failed to get invoices'));
      }

      const transactions = response.result.items.map((inv) => ({
        transactionId: inv.invoice_id.toString(),
        invoiceId: inv.invoice_id.toString(),
        amount: inv.amount,
        currency: this.mapAsset(inv.asset || inv.paid_asset || 'USDT'),
        status: invoiceStatusMap[inv.status] || PaymentStatus.Pending,
        paidAt: inv.paid_at ? new Date(inv.paid_at) : undefined,
        fee: inv.fee_amount,
      }));

      return Ok(transactions);
    } catch (error) {
      this.logger.error('Error getting invoices', error);

      return Err(toError(error));
    }
  }

  async createTransfer(params: {
    userId: string;
    amount: string;
    currency: Cryptocurrency;
    comment?: string;
  }): AsyncResult<PaymentTransfer, Error> {
    try {
      this.logger.log(`Creating transfer: ${params.amount} ${params.currency} to user ${params.userId}`);

      const requestParams: Record<string, unknown> = {
        user_id: parseInt(params.userId, 10),
        asset: params.currency,
        amount: params.amount,
        spend_id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, // eslint-disable-line sonarjs/pseudo-random
        ...(params.comment && { comment: params.comment }),
      };

      const response = await this.request<CryptoPayTransfer>('POST', 'transfer', requestParams);

      if (!response.ok || !response.result) {
        this.logger.error('Failed to create transfer', response);

        return Err(new Error(response.error?.name || 'Failed to create transfer'));
      }

      const transfer = response.result;
      const result: PaymentTransfer = {
        transferId: transfer.transfer_id.toString(),
        amount: transfer.amount,
        currency: this.mapAsset(transfer.asset),
        status: transferStatusMap[transfer.status] || PaymentStatus.Pending,
        completedAt: transfer.completed_at ? new Date(transfer.completed_at) : undefined,
      };

      this.logger.log(`Transfer created: ${result.transferId}`);

      return Ok(result);
    } catch (error) {
      this.logger.error('Error creating transfer', error);

      return Err(toError(error));
    }
  }

  async getTransfer(transferId: string): AsyncResult<PaymentTransfer, Error> {
    try {
      const response = await this.request<{ items: CryptoPayTransfer[] }>('GET', 'getTransfers', {
        transfer_ids: transferId,
      });

      if (!response.ok || !response.result?.items?.length) {
        return Err(new Error(`Transfer not found: ${transferId}`));
      }

      const [transfer] = response.result.items;

      return Ok({
        transferId: transfer.transfer_id.toString(),
        amount: transfer.amount,
        currency: this.mapAsset(transfer.asset),
        status: transferStatusMap[transfer.status] || PaymentStatus.Pending,
        completedAt: transfer.completed_at ? new Date(transfer.completed_at) : undefined,
      });
    } catch (error) {
      this.logger.error(`Error getting transfer ${transferId}`, error);

      return Err(toError(error));
    }
  }

  async getTransfers(params?: { offset?: number; count?: number }): AsyncResult<PaymentTransfer[], Error> {
    try {
      const response = await this.request<{ items: CryptoPayTransfer[] }>('GET', 'getTransfers', {
        offset: params?.offset || 0,
        count: params?.count || 100,
      });

      if (!response.ok || !response.result) {
        return Err(new Error(response.error?.name || 'Failed to get transfers'));
      }

      const transfers = response.result.items.map((t) => ({
        transferId: t.transfer_id.toString(),
        amount: t.amount,
        currency: this.mapAsset(t.asset),
        status: transferStatusMap[t.status] || PaymentStatus.Pending,
        completedAt: t.completed_at ? new Date(t.completed_at) : undefined,
      }));

      return Ok(transfers);
    } catch (error) {
      this.logger.error('Error getting transfers', error);

      return Err(toError(error));
    }
  }

  async getBalances(): AsyncResult<PaymentBalance[], Error> {
    try {
      const response = await this.request<CryptoPayBalance[]>('GET', 'getBalance');

      if (!response.ok || !response.result) {
        return Err(new Error(response.error?.name || 'Failed to get balances'));
      }

      const balances = response.result.map((b) => ({
        currency: this.mapAsset(b.currency_code),
        available: b.available,
        onHold: b.onhold || '0',
      }));

      return Ok(balances);
    } catch (error) {
      this.logger.error('Error getting balances', error);

      return Err(toError(error));
    }
  }

  /**
   * Verify webhook signature using HMAC-SHA256.
   * Secret = SHA256(token), Signature = HMAC-SHA256(body, secret)
   */
  verifyWebhook(signature: string, body: string): boolean {
    if (!this.apiToken) {
      this.logger.warn('Cannot verify webhook - no API token configured');

      return false;
    }

    try {
      const secret = createHash('sha256').update(this.apiToken).digest();
      const expected = createHmac('sha256', secret).update(body).digest('hex');
      const isValid = signature === expected;

      if (!isValid) {
        this.logger.warn('Invalid webhook signature');
      }

      return isValid;
    } catch (error) {
      this.logger.error('Error verifying webhook', error);

      return false;
    }
  }

  private async request<T>(
    method: string,
    endpoint: string,
    params?: Record<string, unknown>,
  ): Promise<CryptoPayResponse<T>> {
    if (!this.apiToken) {
      throw new Error('CryptoBot API token not configured. Set CRYPTO_BOT_API_TOKEN.');
    }

    const url = `${this.baseUrl}/${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Crypto-Pay-API-Token': this.apiToken,
        'Content-Type': 'application/json',
      },
    };

    try {
      if (params && method === 'POST') {
        options.body = JSON.stringify(params);
        const response = await fetch(url, options);

        return response.json();
      }

      if (params && method === 'GET') {
        const query = new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([k, v]) => [k, String(v)]),
        ).toString();

        const fullUrl = query ? `${url}?${query}` : url;
        const response = await fetch(fullUrl, options);

        return response.json();
      }

      const response = await fetch(url, options);

      return response.json();
    } catch (error) {
      this.logger.error(`Request failed: ${method} ${endpoint}`, error);
      throw error;
    }
  }

  private mapAsset(asset: string): Cryptocurrency {
    return assetToCrypto[asset] || Cryptocurrency.Usdt;
  }
}
