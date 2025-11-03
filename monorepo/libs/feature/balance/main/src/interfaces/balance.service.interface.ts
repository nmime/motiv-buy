import { BalanceDto, TransactionDto, TransactionFilterDto } from '../dto';

export interface IBalanceService {
  getBalance(userId: string): Promise<BalanceDto>;
  getTransactionHistory(userId: string, filter: TransactionFilterDto): Promise<TransactionDto[]>;
}
