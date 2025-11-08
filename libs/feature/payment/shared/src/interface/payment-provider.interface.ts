import { AsyncResult } from '@app/common-shared';
import { Cryptocurrency, PaymentStatus } from '../enum';

/**
 * Payment provider invoice data
 */
export interface PaymentInvoice {
  invoiceId: string;
  amount: string;
  currency: Cryptocurrency;
  payUrl: string;
  expiresAt?: Date;
  description?: string;
}

/**
 * Payment provider transaction result
 */
export interface PaymentTransaction {
  transactionId: string;
  invoiceId: string;
  amount: string;
  currency: Cryptocurrency;
  status: PaymentStatus;
  paidAt?: Date;
  fee?: string;
}

/**
 * Transfer result for withdrawals
 */
export interface PaymentTransfer {
  transferId: string;
  amount: string;
  currency: Cryptocurrency;
  status: PaymentStatus;
  completedAt?: Date;
  fee?: string;
}

/**
 * Payment provider balance
 */
export interface PaymentBalance {
  currency: Cryptocurrency;
  available: string;
  onHold: string;
}

/**
 * Abstract payment provider interface
 * All payment providers must implement this interface
 */
export interface IPaymentProvider {
  /**
   * Create invoice for top-up
   */
  createInvoice(params: {
    amount: string;
    currency: Cryptocurrency;
    description?: string;
    userId: string;
    expiresIn?: number;
  }): AsyncResult<PaymentInvoice, Error>;

  /**
   * Get invoice status
   */
  getInvoice(invoiceId: string): AsyncResult<PaymentTransaction, Error>;

  /**
   * Get invoices history with filtering
   */
  getInvoices(params?: {
    status?: PaymentStatus;
    offset?: number;
    count?: number;
  }): AsyncResult<PaymentTransaction[], Error>;

  /**
   * Create transfer for withdrawal
   */
  createTransfer(params: {
    userId: string;
    amount: string;
    currency: Cryptocurrency;
    comment?: string;
    destination?: string; // For providers like YooKassa (bank card), crypto providers use userId
  }): AsyncResult<PaymentTransfer, Error>;

  /**
   * Get transfer status
   */
  getTransfer(transferId: string): AsyncResult<PaymentTransfer, Error>;

  /**
   * Get transfers history
   */
  getTransfers(params?: { offset?: number; count?: number }): AsyncResult<PaymentTransfer[], Error>;

  /**
   * Get provider balances
   */
  getBalances(): AsyncResult<PaymentBalance[], Error>;

  /**
   * Verify webhook signature
   */
  verifyWebhook(signature: string, body: string): boolean;
}
