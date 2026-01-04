import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUserId, JwtAuthGuard } from '@app/feature-auth-shared';
import {
  CreateInvoiceDto,
  CreateTransferDto,
  InvoiceResponseDto,
  PaymentService,
  TransactionQueryOptions,
  TransferResponseDto,
} from '@app/feature-payment-shared';
import { PaymentStatus, PaymentTransactionEntity, PaymentType } from '@app/database';

/**
 * DTO for transaction list query parameters
 */
export class TransactionQueryDto {
  @ApiPropertyOptional({
    enum: PaymentType,
    description: 'Filter by transaction type',
  })
  type?: PaymentType;

  @ApiPropertyOptional({
    enum: PaymentStatus,
    description: 'Filter by transaction status',
  })
  status?: PaymentStatus;

  @ApiPropertyOptional({
    type: Number,
    description: 'Maximum number of transactions to return',
    example: 50,
  })
  limit?: number;

  @ApiPropertyOptional({
    type: Number,
    description: 'Number of transactions to skip for pagination',
    example: 0,
  })
  offset?: number;
}

/**
 * DTO for transaction list response
 */
class TransactionListResponseDto {
  @ApiProperty({
    type: [PaymentTransactionEntity],
    description: 'List of payment transactions',
  })
  transactions!: PaymentTransactionEntity[];

  @ApiProperty({
    type: Number,
    description: 'Total count of transactions',
  })
  total!: number;

  @ApiProperty({
    type: Number,
    description: 'Limit used for pagination',
  })
  limit!: number;

  @ApiProperty({
    type: Number,
    description: 'Offset used for pagination',
  })
  offset!: number;
}

/**
 * PaymentController - REST API for payment operations
 * Handles cryptocurrency payments, invoices, transfers, and transaction history
 *
 * @requires JWT authentication for all endpoints
 * @implements Rate limiting to prevent abuse
 */
@ApiTags('Payment')
@Controller('payment')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Create a top-up invoice for the authenticated user
   * Generates a payment link that users can use to deposit funds
   *
   * @param userId - Extracted from JWT token
   * @param dto - Invoice creation parameters
   * @returns Invoice details with payment URL
   */
  @Post('topup')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @ApiOperation({
    summary: 'Create top-up invoice',
    description:
      'Creates a payment invoice for depositing funds. Returns a payment URL that can be used to complete the payment.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Invoice created successfully',
    type: InvoiceResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request parameters',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Payment provider error',
  })
  async createTopUp(@CurrentUserId() userId: string, @Body() dto: CreateInvoiceDto): Promise<InvoiceResponseDto> {
    const result = await this.paymentService.createTopUp(userId, dto);

    if (result.err) {
      const error = result.val;
      throw new BadRequestException(error.message || 'Failed to create top-up invoice');
    }

    return result.val;
  }

  /**
   * Request a withdrawal from user balance
   * Deducts amount from balance and initiates cryptocurrency transfer
   *
   * @param userId - Extracted from JWT token
   * @param dto - Withdrawal parameters
   * @returns Transfer details
   */
  @Post('withdraw')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute (more restrictive)
  @ApiOperation({
    summary: 'Request withdrawal',
    description:
      'Creates a withdrawal transfer to send funds from user balance to their cryptocurrency wallet. Balance is deducted immediately.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Withdrawal initiated successfully',
    type: TransferResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request parameters or insufficient balance',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Payment provider error or database error',
  })
  async createWithdrawal(
    @CurrentUserId() userId: string,
    @Body() dto: CreateTransferDto,
  ): Promise<TransferResponseDto> {
    const result = await this.paymentService.createWithdrawal(userId, dto);

    if (result.err) {
      const error = result.val;
      throw new BadRequestException(error.message || 'Failed to create withdrawal');
    }

    return result.val;
  }

  /**
   * Get transaction history for authenticated user
   * Supports filtering by type, status, and pagination
   *
   * @param userId - Extracted from JWT token
   * @param type - Optional: Filter by transaction type
   * @param status - Optional: Filter by transaction status
   * @param limit - Optional: Maximum results (default: 50)
   * @param offset - Optional: Pagination offset (default: 0)
   * @returns Paginated transaction list
   */
  @Get('transactions')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute
  @ApiOperation({
    summary: 'Get transaction history',
    description:
      'Retrieves paginated transaction history for the authenticated user with optional filtering by type and status.',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: PaymentType,
    description: 'Filter by transaction type (TopUp or Withdraw)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: PaymentStatus,
    description: 'Filter by transaction status (Pending, Processing, Completed, Failed, etc.)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of transactions to return (default: 50, max: 100)',
    example: 50,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Number of transactions to skip for pagination (default: 0)',
    example: 0,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Transaction history retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        transactions: {
          type: 'array',
          items: { type: 'object' },
        },
        total: { type: 'number', example: 150 },
        limit: { type: 'number', example: 50 },
        offset: { type: 'number', example: 0 },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid query parameters',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded',
  })
  async getTransactions(
    @CurrentUserId() userId: string,
    @Query('type') type?: PaymentType,
    @Query('status') status?: PaymentStatus,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<TransactionListResponseDto> {
    // Validate and sanitize query parameters
    const queryOptions: TransactionQueryOptions = {};

    if (type) {
      if (!Object.values(PaymentType).includes(type)) {
        throw new BadRequestException(`Invalid transaction type: ${type}`);
      }

      queryOptions.type = type;
    }

    if (status) {
      if (!Object.values(PaymentStatus).includes(status)) {
        throw new BadRequestException(`Invalid transaction status: ${status}`);
      }

      queryOptions.status = status;
    }

    if (limit !== undefined) {
      const parsedLimit = Number(limit);
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        throw new BadRequestException('Limit must be between 1 and 100');
      }

      queryOptions.limit = parsedLimit;
    }

    if (offset !== undefined) {
      const parsedOffset = Number(offset);
      if (isNaN(parsedOffset) || parsedOffset < 0) {
        throw new BadRequestException('Offset must be non-negative');
      }

      queryOptions.offset = parsedOffset;
    }

    const result = await this.paymentService.getUserTransactions(userId, queryOptions);

    if (result.err) {
      const error = result.val;
      throw new BadRequestException(error.message || 'Failed to retrieve transactions');
    }

    return result.val;
  }

  /**
   * Get specific transaction details by ID
   * Ensures transaction belongs to authenticated user
   *
   * @param userId - Extracted from JWT token
   * @param transactionId - UUID of the transaction
   * @returns Transaction details
   */
  @Get('transactions/:id')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 requests per minute
  @ApiOperation({
    summary: 'Get transaction details',
    description: 'Retrieves detailed information about a specific transaction. User must own the transaction.',
  })
  @ApiParam({
    name: 'id',
    description: 'Transaction ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Transaction details retrieved successfully',
    type: PaymentTransactionEntity,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Transaction not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Transaction does not belong to user',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded',
  })
  async getTransaction(
    @CurrentUserId() userId: string,
    @Param('id') transactionId: string,
  ): Promise<PaymentTransactionEntity> {
    const result = await this.paymentService.getTransaction(transactionId);

    if (result.err) {
      const error = result.val;
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`Transaction not found: ${transactionId}`);
      }

      throw new BadRequestException(error.message || 'Failed to retrieve transaction');
    }

    const transaction = result.val;

    // Verify transaction belongs to authenticated user
    if (transaction.userId !== userId) {
      throw new NotFoundException(`Transaction not found: ${transactionId}`);
    }

    return transaction;
  }

  /**
   * Check invoice payment status and trigger balance credit if paid
   * Synchronizes status with payment provider
   *
   * @param userId - Extracted from JWT token
   * @param invoiceId - Provider invoice ID
   * @returns Updated transaction details
   */
  @Get('invoice/:invoiceId/status')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  @ApiOperation({
    summary: 'Check invoice payment status',
    description:
      'Checks the current status of an invoice with the payment provider. If the invoice is paid, user balance will be credited automatically.',
  })
  @ApiParam({
    name: 'invoiceId',
    description: 'Provider invoice ID (from invoice creation response)',
    example: 'INV-123456789',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invoice status retrieved successfully',
    type: PaymentTransactionEntity,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Invoice not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Invoice does not belong to user',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Payment provider error',
  })
  async getInvoiceStatus(
    @CurrentUserId() userId: string,
    @Param('invoiceId') invoiceId: string,
  ): Promise<PaymentTransactionEntity> {
    const result = await this.paymentService.getInvoiceStatus(invoiceId);

    if (result.err) {
      const error = result.val;
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`Invoice not found: ${invoiceId}`);
      }

      throw new BadRequestException(error.message || 'Failed to check invoice status');
    }

    const transaction = result.val;

    // Verify transaction belongs to authenticated user
    if (transaction.userId !== userId) {
      throw new NotFoundException(`Invoice not found: ${invoiceId}`);
    }

    return transaction;
  }
}
