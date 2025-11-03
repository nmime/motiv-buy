import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BalanceService } from '../service/balance.service';
import { CurrencyRateService } from '../service/currency-rate.service';
import { PaymentService, CreateInvoiceDto, CreateTransferDto } from '@app/feature-payment-main';
import { BalanceDto, TransactionDto, TransactionFilterDto, TopUpRequestDto, WithdrawRequestDto } from '../dto';
import { ApiProblemExceptions, InternalException, UnauthorizedException } from '@app/common-exception';
import { ClientDataProblemValidationException } from '@app/common-validation';
import { Ok } from 'ts-results';
import { AsyncResult } from '@app/common-shared';
import { JwtAuthGuard, CurrentUserId } from '@app/feature-auth-shared';
import { CurrencyCode } from '@app/database';
import { Cryptocurrency } from '@app/feature-payment-shared';

@ApiTags('balance')
@Controller('balance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiProblemExceptions([
  [InternalException, { description: 'Internal server error occurred' }],
  [ClientDataProblemValidationException, { description: 'Request validation failed' }],
])
export class BalanceController {
  constructor(
    private readonly balanceService: BalanceService,
    private readonly paymentService: PaymentService,
    private readonly currencyRateService: CurrencyRateService,
  ) {}

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

  @Post('topup')
  @ApiOperation({
    summary: 'Request top-up',
    description: 'Create cryptocurrency invoice for balance top-up and get payment URL',
  })
  @ApiResponse({
    status: 201,
    description: 'Top-up invoice created successfully',
    schema: {
      type: 'object',
      properties: {
        paymentUrl: {
          type: 'string',
          example: 'https://t.me/CryptoBot?start=invoice_abc123',
        },
        invoiceId: {
          type: 'string',
          example: 'uuid-invoice-id',
        },
        rubAmount: {
          type: 'string',
          example: '9550.00',
          description: 'Equivalent amount in RUB',
        },
      },
    },
  })
  async requestTopUp(
    @Body() request: TopUpRequestDto,
    @CurrentUserId() userId: string,
  ): AsyncResult<
    { paymentUrl: string; invoiceId: string; rubAmount: string },
    UnauthorizedException | ClientDataProblemValidationException | InternalException
  > {
    // Map Cryptocurrency enum to CurrencyCode enum
    const currencyCode = this.mapCryptocurrencyToCode(request.currency);

    // Convert crypto amount to RUB
    const rubAmountResult = await this.currencyRateService.convertAmount(
      request.amount,
      currencyCode,
      CurrencyCode.Rub,
    );

    if (rubAmountResult.err) {
      throw new InternalException('Failed to convert currency', { cause: rubAmountResult.val });
    }

    const rubAmount = rubAmountResult.val;

    // Create invoice via payment service
    const invoiceDto: CreateInvoiceDto = {
      amount: request.amount,
      currency: request.currency,
      description: request.description || `Balance top-up ${request.amount} ${request.currency}`,
      expiresIn: 3600, // 1 hour
    };

    const invoiceResult = await this.paymentService.createTopUp(userId, invoiceDto);

    if (invoiceResult.err) {
      throw new InternalException('Failed to create top-up invoice', { cause: invoiceResult.val });
    }

    const invoice = invoiceResult.val;

    return Ok({
      paymentUrl: invoice.payUrl,
      invoiceId: invoice.id,
      rubAmount,
    });
  }

  @Post('withdraw')
  @ApiOperation({
    summary: 'Request withdrawal',
    description: 'Create withdrawal to cryptocurrency wallet via Telegram',
  })
  @ApiResponse({
    status: 201,
    description: 'Withdrawal request created successfully',
    schema: {
      type: 'object',
      properties: {
        transferId: {
          type: 'string',
          example: 'uuid-transfer-id',
        },
        cryptoAmount: {
          type: 'string',
          example: '100.50000000',
          description: 'Amount in cryptocurrency',
        },
      },
    },
  })
  async requestWithdraw(
    @Body() request: WithdrawRequestDto,
    @CurrentUserId() userId: string,
  ): AsyncResult<
    { transferId: string; cryptoAmount: string },
    UnauthorizedException | ClientDataProblemValidationException | InternalException
  > {
    // Check balance
    const balance = await this.balanceService.getBalance(userId);

    if (balance.availableAmount < request.amount) {
      throw new InternalException(
        `Insufficient balance. Available: ${balance.availableAmount} RUB, Requested: ${request.amount} RUB`,
      );
    }

    // Map Cryptocurrency enum to CurrencyCode enum
    const currencyCode = this.mapCryptocurrencyToCode(request.currency);

    // Convert RUB to cryptocurrency
    const cryptoAmountResult = await this.currencyRateService.convertAmount(
      request.amount.toString(),
      CurrencyCode.Rub,
      currencyCode,
    );

    if (cryptoAmountResult.err) {
      throw new InternalException('Failed to convert currency', { cause: cryptoAmountResult.val });
    }

    const cryptoAmount = cryptoAmountResult.val;

    // Create transfer via payment service
    const transferDto: CreateTransferDto = {
      userId: request.telegramUserId,
      amount: cryptoAmount,
      currency: request.currency,
      comment: request.comment || `Withdrawal from balance: ${request.amount} RUB`,
    };

    const transferResult = await this.paymentService.createWithdrawal(userId, transferDto);

    if (transferResult.err) {
      throw new InternalException('Failed to create withdrawal', { cause: transferResult.val });
    }

    const transfer = transferResult.val;

    return Ok({
      transferId: transfer.id,
      cryptoAmount,
    });
  }

  /**
   * Map Cryptocurrency enum from payment-shared to CurrencyCode from database
   */
  private mapCryptocurrencyToCode(crypto: Cryptocurrency): CurrencyCode {
    switch (crypto) {
      case Cryptocurrency.Usdt:
        return CurrencyCode.Usdt;
      case Cryptocurrency.Ton:
        return CurrencyCode.Ton;
      case Cryptocurrency.Btc:
        return CurrencyCode.Btc;
      case Cryptocurrency.Eth:
        return CurrencyCode.Eth;
      case Cryptocurrency.Ltc:
        return CurrencyCode.Ltc;
      case Cryptocurrency.Bnb:
        return CurrencyCode.Bnb;
      case Cryptocurrency.Trx:
        return CurrencyCode.Trx;
      case Cryptocurrency.Usdc:
        return CurrencyCode.Usdc;
      default:
        throw new Error(`Unsupported cryptocurrency: ${crypto}`);
    }
  }
}
