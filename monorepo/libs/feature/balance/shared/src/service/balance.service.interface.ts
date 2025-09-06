import { BalanceDto, TransactionDto, TransactionFilterDto, DepositRequestDto, WithdrawalRequestDto } from '../dto';

export interface IBalanceService {
  /**
   * Get user balance
   */
  getBalance(userId: string): Promise<BalanceDto>;

  /**
   * Get transaction history
   */
  getTransactionHistory(userId: string, filter: TransactionFilterDto): Promise<TransactionDto[]>;

  /**
   * Request deposit
   */
  requestDeposit(userId: string, request: DepositRequestDto): Promise<{ paymentUrl: string }>;

  /**
   * Request withdrawal
   */
  requestWithdrawal(userId: string, request: WithdrawalRequestDto): Promise<{ transactionId: string }>;
}
