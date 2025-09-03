export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  TRAFFIC_SALE_INCOME = 'traffic_sale_income',
  TRAFFIC_BUY_EXPENSE = 'traffic_buy_expense',
}

export enum PaymentMethod {
  CRYPTO_BOT = 'crypto_bot',
  BANK_CARD = 'bank_card',
  PAYPAL = 'paypal',
}

export interface TransactionDto {
  id: string;
  amount: number;
  type: TransactionType;
  date: Date;
  paymentMethod?: PaymentMethod;
  description: string;
  orderId?: string;
}

export interface TransactionFilterDto {
  type?: TransactionType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface DepositRequestDto {
  amount: number;
  paymentMethod: PaymentMethod;
}

export interface WithdrawalRequestDto {
  amount: number;
  destination: string;
  paymentMethod: PaymentMethod;
}