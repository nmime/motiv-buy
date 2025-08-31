import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/feature-auth-main';
import { CurrentUser } from '@app/feature-auth-shared';
import { BalanceService } from '../service/balance.service';
import { BalanceDto, TransactionDto, TransactionFilterDto, DepositRequestDto, WithdrawalRequestDto } from '@app/feature-balance-shared';

@ApiTags('balance')
@Controller('balance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get()
  @ApiOperation({
    summary: 'Get current balance',
    description: 'Returns user current balance amount and currency',
  })
  @ApiResponse({
    status: 200,
    description: 'Balance retrieved successfully',
    type: BalanceDto,
  })
  async getBalance(@CurrentUser('id') userId: string): Promise<BalanceDto> {
    return this.balanceService.getBalance(userId);
  }

  @Get('transactions')
  @ApiOperation({
    summary: 'Get transaction history',
    description: `Get transaction history with optional filtering:
    - Filter by transaction type
    - Filter by date range
    - Includes all deposits, withdrawals, and traffic-related transactions`,
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction history retrieved successfully',
    type: [TransactionDto],
  })
  async getTransactionHistory(
    @Query() filter: TransactionFilterDto,
    @CurrentUser('id') userId: string,
  ): Promise<TransactionDto[]> {
    return this.balanceService.getTransactionHistory(userId, filter);
  }

  @Post('deposit')
  @ApiOperation({
    summary: 'Request deposit',
    description: 'Create deposit request and get payment URL for specified payment method',
  })
  @ApiResponse({
    status: 201,
    description: 'Deposit request created successfully',
    schema: {
      type: 'object',
      properties: {
        paymentUrl: {
          type: 'string',
          example: 'https://payment.gateway/deposit/abc123',
        },
      },
    },
  })
  async requestDeposit(
    @Body() request: DepositRequestDto,
    @CurrentUser('id') userId: string,
  ): Promise<{ paymentUrl: string }> {
    return this.balanceService.requestDeposit(userId, request);
  }

  @Post('withdrawal')
  @ApiOperation({
    summary: 'Request withdrawal',
    description: 'Create withdrawal request to specified destination',
  })
  @ApiResponse({
    status: 201,
    description: 'Withdrawal request created successfully',
    schema: {
      type: 'object',
      properties: {
        transactionId: {
          type: 'string',
          example: 'withdrawal-tx-456',
        },
      },
    },
  })
  async requestWithdrawal(
    @Body() request: WithdrawalRequestDto,
    @CurrentUser('id') userId: string,
  ): Promise<{ transactionId: string }> {
    return this.balanceService.requestWithdrawal(userId, request);
  }
}