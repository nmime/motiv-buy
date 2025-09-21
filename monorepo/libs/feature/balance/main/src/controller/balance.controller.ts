import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { BalanceService } from '../service';
import { BalanceDto, TransactionDto, TransactionFilterDto, DepositRequestDto, WithdrawalRequestDto } from '../dto';
import { ApiProblemExceptions, InternalException } from '@app/common-exception';
import { ClientDataProblemValidationException } from '@app/common-validation';
import { Ok } from 'ts-results';
import { AsyncResult } from '@app/common-shared';

// Local guards and decorators to avoid cross-library imports
export const JwtAuthGuard = AuthGuard('jwt');

export const CurrentUserId = createParamDecorator((data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<{ user?: { id?: string } }>();
  const userId = request.user?.id;
  if (!userId) {
    throw new UnauthorizedException('User not authenticated');
  }

  return userId;
});

@ApiTags('balance')
@Controller('balance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiProblemExceptions([
  [InternalException, { description: 'Internal server error occurred' }],
  [ClientDataProblemValidationException, { description: 'Request validation failed' }],
])
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
  })
  async getBalance(
    @CurrentUserId() userId: string,
  ): AsyncResult<BalanceDto, UnauthorizedException | InternalException> {
    const result = await this.balanceService.getBalance(userId);

    return Ok(result);
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
  })
  async getTransactionHistory(
    @Query() filter: TransactionFilterDto,
    @CurrentUserId() userId: string,
  ): AsyncResult<TransactionDto[], UnauthorizedException | ClientDataProblemValidationException | InternalException> {
    const result = await this.balanceService.getTransactionHistory(userId, filter);

    return Ok(result);
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
    @CurrentUserId() userId: string,
  ): AsyncResult<
    { paymentUrl: string },
    UnauthorizedException | ClientDataProblemValidationException | InternalException
  > {
    const result = await this.balanceService.requestDeposit(userId, request);

    return Ok(result);
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
    @CurrentUserId() userId: string,
  ): AsyncResult<
    { transactionId: string },
    UnauthorizedException | ClientDataProblemValidationException | InternalException
  > {
    const result = await this.balanceService.requestWithdrawal(userId, request);

    return Ok(result);
  }
}
