/**
 * Payment transaction status
 */
export enum PaymentStatus {
  Pending = 'PENDING',
  Processing = 'PROCESSING',
  Completed = 'COMPLETED',
  Failed = 'FAILED',
  Cancelled = 'CANCELLED',
  Expired = 'EXPIRED',
}
