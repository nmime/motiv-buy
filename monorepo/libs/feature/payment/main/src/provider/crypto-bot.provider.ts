import { Injectable, Logger } from '@nestjs/common';
import { ClientEmitter } from 'crypto-bot-api';
import { createHash, createHmac } from 'crypto';
import { Err, Ok, Result, AsyncResult, toError } from '@app/common-shared';
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
 * CryptoBot payment provider implementation
 * Integrates with CryptoPay API for cryptocurrency payments
 *
 * Uses centralized PaymentConfigService for configuration management.
 */
@Injectable()
export class CryptoBotProvider implements IPaymentProvider {
  private readonly logger = new Logger(CryptoBotProvider.name);
  private readonly client: ClientEmitter;
  private readonly apiToken: string;

  constructor(private readonly paymentConfig: PaymentConfigService) {
    this.apiToken = this.paymentConfig.getCryptoBotApiToken();
    this.client = new ClientEmitter(this.apiToken);

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

      const response = await this.client.createInvoice({
        asset: this.mapCryptocurrencyToAsset(params.currency),
        amount: params.amount,
        description: params.description,
        expires_in: params.expiresIn,
      });

      if (!response.ok || !response.result) {
        this.logger.error('Failed to create invoice', response);

        return Err(new Error('Failed to create invoice'));
      }

      const invoice = response.result;
      const paymentInvoice: PaymentInvoice = {
        invoiceId: invoice.invoice_id.toString(),
        amount: invoice.amount,
        currency: this.mapAssetToCryptocurrency(invoice.asset),
        payUrl: invoice.pay_url,
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

      const response = await this.client.getInvoices({
        invoice_ids: [parseInt(invoiceId, 10)],
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
        currency: this.mapAssetToCryptocurrency(invoice.asset),
        status: this.mapStatusToPaymentStatus(invoice.status),
        paidAt: invoice.paid_at ? new Date(invoice.paid_at) : undefined,
        fee: invoice.fee,
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

      const response = await this.client.getInvoices({
        status: params?.status ? this.mapPaymentStatusToApiStatus(params.status) : undefined,
        offset: params?.offset,
        count: params?.count ?? 100,
      });

      if (!response.ok || !response.result) {
        this.logger.error('Failed to get invoices', response);

        return Err(new Error('Failed to get invoices'));
      }

      const transactions: PaymentTransaction[] = response.result.items.map((invoice: any) => ({
        transactionId: invoice.invoice_id.toString(),
        invoiceId: invoice.invoice_id.toString(),
        amount: invoice.amount,
        currency: this.mapAssetToCryptocurrency(invoice.asset),
        status: this.mapStatusToPaymentStatus(invoice.status),
        paidAt: invoice.paid_at ? new Date(invoice.paid_at) : undefined,
        fee: invoice.fee,
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

      const response = await this.client.transfer({
        user_id: parseInt(params.userId, 10),
        asset: this.mapCryptocurrencyToAsset(params.currency),
        amount: params.amount,
        comment: params.comment,
      });

      if (!response.ok || !response.result) {
        this.logger.error('Failed to create transfer', response);

        return Err(new Error('Failed to create transfer'));
      }

      const transfer = response.result;
      const paymentTransfer: PaymentTransfer = {
        transferId: transfer.transfer_id.toString(),
        amount: transfer.amount,
        currency: this.mapAssetToCryptocurrency(transfer.asset),
        status: this.mapTransferStatusToPaymentStatus(transfer.status),
        completedAt: transfer.completed_at ? new Date(transfer.completed_at) : undefined,
        fee: transfer.fee,
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

      const response = await this.client.getTransfers({
        transfer_id: parseInt(transferId, 10),
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
        fee: transfer.fee,
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

      const response = await this.client.getTransfers({
        offset: params?.offset,
        count: params?.count ?? 100,
      });

      if (!response.ok || !response.result) {
        this.logger.error('Failed to get transfers', response);

        return Err(new Error('Failed to get transfers'));
      }

      const transfers: PaymentTransfer[] = response.result.items.map((transfer: any) => ({
        transferId: transfer.transfer_id.toString(),
        amount: transfer.amount,
        currency: this.mapAssetToCryptocurrency(transfer.asset),
        status: this.mapTransferStatusToPaymentStatus(transfer.status),
        completedAt: transfer.completed_at ? new Date(transfer.completed_at) : undefined,
        fee: transfer.fee,
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

      const response = await this.client.getBalance();

      if (!response.ok || !response.result) {
        this.logger.error('Failed to get balances', response);

        return Err(new Error('Failed to get balances'));
      }

      const balances: PaymentBalance[] = (Array.isArray(response.result) ? response.result : [response.result]).map(
        (balance: any) => ({
          currency: this.mapAssetToCryptocurrency(balance.currency_code),
          available: balance.available,
          onHold: balance.onhold || '0',
        }),
      );

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
