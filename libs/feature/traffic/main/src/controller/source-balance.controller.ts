import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiProperty, ApiTags } from '@nestjs/swagger';
import { ApiProblemExceptions, InternalException, UnauthorizedException } from '@app/common-exception';
import { ClientDataProblemValidationException } from '@app/common-validation';
import { AsyncResult, Err, Ok } from '@app/common-shared';
import { CurrentUserId, JwtAuthGuard } from '@app/feature-auth-shared';
import { SourceBalanceDto, SourceBalanceService, TransferResultDto } from '@app/feature-traffic-shared';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CurrencyCode } from '@app/database';

export class TransferToWalletDto {
  @ApiProperty({ description: 'Source ID to transfer from', example: '01234567-89ab-cdef-0123-456789abcdef' })
  @IsString()
  @IsNotEmpty()
  sourceId!: string;

  @ApiProperty({ description: 'Amount to transfer (optional, transfers all if not provided)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0.00000001)
  amount?: number;
}

export class SourceBalanceResponseDto {
  @ApiProperty({ description: 'Source ID' })
  sourceId!: string;

  @ApiProperty({ description: 'Source name' })
  sourceName!: string;

  @ApiProperty({ description: 'Available balance' })
  available!: number;

  @ApiProperty({ description: 'Pending balance (awaiting verification)' })
  pending!: number;

  @ApiProperty({ description: 'Total earned all time' })
  totalEarned!: number;

  @ApiProperty({ description: 'Total withdrawn all time' })
  totalWithdrawn!: number;

  @ApiProperty({ description: 'Currency code' })
  currency!: string;
}

export class SourceTransferResponseDto {
  @ApiProperty({ description: 'Transfer ID' })
  transferId!: string;

  @ApiProperty({ description: 'Amount transferred' })
  amount!: number;

  @ApiProperty({ description: 'Source balance after transfer' })
  sourceBalanceAfter!: number;

  @ApiProperty({ description: 'User wallet balance after transfer' })
  userBalanceAfter!: number;
}

/**
 * Source Balance API Controller
 * For managing traffic source earnings and transfers
 * Uses JWT authentication
 */
@ApiTags('Traffic Source - Balance')
@Controller('traffic-sources/balance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiProblemExceptions([
  [InternalException, { description: 'Internal server error occurred' }],
  [ClientDataProblemValidationException, { description: 'Request validation failed' }],
  [UnauthorizedException, { description: 'Not authorized to access this source' }],
])
export class SourceBalanceController {
  constructor(private readonly sourceBalanceService: SourceBalanceService) {}

  /**
   * Get all source balances for the current user
   */
  @Get()
  @ApiOperation({
    summary: 'Get all source balances',
    description: 'Get balances for all traffic sources owned by the current user.',
  })
  @ApiOkResponse({
    description: 'Source balances retrieved successfully',
    type: [SourceBalanceResponseDto],
  })
  async getAllSourceBalances(@CurrentUserId() userId: string): AsyncResult<SourceBalanceDto[], Error> {
    const balances = await this.sourceBalanceService.getUserSourceBalances(userId);

    return Ok(balances);
  }

  /**
   * Get balance for a specific source
   */
  @Get(':sourceId')
  @ApiOperation({
    summary: 'Get source balance',
    description: 'Get balance for a specific traffic source.',
  })
  @ApiParam({
    name: 'sourceId',
    description: 'Traffic source ID',
    type: String,
    example: '01234567-89ab-cdef-0123-456789abcdef',
  })
  @ApiOkResponse({
    description: 'Source balance retrieved successfully',
    type: SourceBalanceResponseDto,
  })
  async getSourceBalance(
    @Param('sourceId') sourceId: string,
    @CurrentUserId() userId: string,
  ): AsyncResult<SourceBalanceDto | null, Error> {
    const isOwner = await this.sourceBalanceService.verifySourceOwnership(sourceId, userId);
    if (!isOwner) {
      return Err(new UnauthorizedException('Not authorized to access this source'));
    }

    const balance = await this.sourceBalanceService.getSourceBalance(sourceId, CurrencyCode.Rub);

    return Ok(balance);
  }

  /**
   * Transfer funds from source balance to user wallet
   */
  @Post('transfer')
  @ApiOperation({
    summary: 'Transfer to wallet',
    description: 'Transfer earnings from a traffic source to your personal wallet balance.',
  })
  @ApiOkResponse({
    description: 'Transfer completed successfully',
    type: SourceTransferResponseDto,
  })
  async transferToWallet(
    @Body() dto: TransferToWalletDto,
    @CurrentUserId() userId: string,
  ): AsyncResult<TransferResultDto, Error> {
    const isOwner = await this.sourceBalanceService.verifySourceOwnership(dto.sourceId, userId);
    if (!isOwner) {
      return Err(new UnauthorizedException('Not authorized to access this source'));
    }

    if (dto.amount) {
      return this.sourceBalanceService.transferToUserBalance(
        dto.sourceId,
        userId,
        dto.amount.toString(),
        CurrencyCode.Rub,
      );
    }

    return this.sourceBalanceService.transferAllToUserBalance(dto.sourceId, userId, CurrencyCode.Rub);
  }
}
