import { BalanceDto, TransactionDto, TransactionFilterDto, DepositRequestDto, WithdrawalRequestDto } from '../dto';

export interface IBalanceService {
  getBalance(userId: string): Promise<BalanceDto>;
  getTransactionHistory(userId: string, filter: TransactionFilterDto): Promise<TransactionDto[]>;
  requestDeposit(userId: string, request: DepositRequestDto): Promise<{ paymentUrl: string }>;
  requestWithdrawal(userId: string, request: WithdrawalRequestDto): Promise<{ transactionId: string }>;
}