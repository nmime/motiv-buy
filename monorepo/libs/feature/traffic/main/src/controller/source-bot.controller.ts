import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiProblemExceptions, InternalException } from '@app/common-exception';
import { ClientDataProblemValidationException } from '@app/common-validation';
import { AsyncResult } from '@app/common-shared';
import { Ok } from 'ts-results';
import {
  CheckStatusRequestDto,
  CheckStatusResponseDto,
  CompleteActionRequestDto,
  CompleteActionResponseDto,
  GetBotStatsResponseDto,
  GetFiltersResponseDto,
  GetOrdersRequestDto,
  GetOrdersResponseDto,
  GetUserStatsResponseDto,
  RegisterBotRequestDto,
  RegisterBotResponseDto,
} from '@app/feature-traffic-shared';
import { SourceBotService } from '../service/source-bot.service';

/**
 * Source Bot Controller
 * API for bot owners to connect their bots and manage traffic orders
 * Follows SubGram/FlyerService API patterns
 *
 * PUBLIC endpoints: No authentication required
 * PRIVATE endpoints: Bot token authentication required (key field in request body)
 */
@ApiTags('Source Bot API')
@Controller('source')
@ApiProblemExceptions([
  [InternalException, { description: 'Internal server error occurred' }],
  [ClientDataProblemValidationException, { description: 'Request validation failed' }],
])
export class SourceBotController {
  constructor(private readonly sourceBotService: SourceBotService) {}

  /**
   * PUBLIC: Get available filters
   * Returns targeting options for advertisers
   */
  @Get('filters')
  @ApiOperation({
    summary: 'Get available filters',
    description:
      'Get available targeting filters (genders, age ranges, countries, languages, traffic types). No authentication required.',
  })
  @ApiOkResponse({
    description: 'Available filters retrieved successfully',
    type: GetFiltersResponseDto,
  })
  async getFilters(): Promise<AsyncResult<GetFiltersResponseDto, Error>> {
    const result = await this.sourceBotService.getFilters();

    return Ok(result);
  }

  /**
   * PRIVATE: Register bot to the platform
   * Bot token authentication in request body
   */
  @Post('register')
  @ApiOperation({
    summary: 'Register bot',
    description: 'Register a Telegram bot to the traffic platform. Requires valid Telegram bot token in request body.',
  })
  @ApiOkResponse({
    description: 'Bot registered successfully',
    type: RegisterBotResponseDto,
  })
  async registerBot(@Body() dto: RegisterBotRequestDto): Promise<AsyncResult<RegisterBotResponseDto, Error>> {
    const result = await this.sourceBotService.registerBot(dto);

    return Ok(result);
  }

  /**
   * PRIVATE: Get available orders for user
   * Bot token authentication in request body
   */
  @Post('orders/available')
  @ApiOperation({
    summary: 'Get available orders',
    description: 'Get available traffic orders for a specific user. Requires bot token authentication.',
  })
  @ApiOkResponse({
    description: 'Available orders retrieved successfully',
    type: GetOrdersResponseDto,
  })
  async getAvailableOrders(@Body() dto: GetOrdersRequestDto): Promise<AsyncResult<GetOrdersResponseDto, Error>> {
    const result = await this.sourceBotService.getAvailableOrders(dto);

    return Ok(result);
  }

  /**
   * PRIVATE: Check subscription status
   * Bot token authentication in request body
   */
  @Post('orders/check')
  @ApiOperation({
    summary: 'Check subscription status',
    description: 'Check if user has completed subscription/join for an order. Requires bot token authentication.',
  })
  @ApiOkResponse({
    description: 'Subscription status checked successfully',
    type: CheckStatusResponseDto,
  })
  async checkStatus(@Body() dto: CheckStatusRequestDto): Promise<AsyncResult<CheckStatusResponseDto, Error>> {
    const result = await this.sourceBotService.checkSubscriptionStatus(dto);

    return Ok(result);
  }

  /**
   * PRIVATE: Complete action for order
   * Bot token authentication in request body
   */
  @Post('orders/:orderId/complete')
  @ApiOperation({
    summary: 'Complete action',
    description: 'Submit completion of an action for an order. Requires bot token authentication.',
  })
  @ApiParam({
    name: 'orderId',
    description: 'Order ID',
    type: String,
    example: 'ORD-123456',
  })
  @ApiOkResponse({
    description: 'Action completion submitted successfully',
    type: CompleteActionResponseDto,
  })
  async completeAction(
    @Param('orderId') orderId: string,
    @Body() dto: CompleteActionRequestDto,
  ): Promise<AsyncResult<CompleteActionResponseDto, Error>> {
    const result = await this.sourceBotService.submitCompletion(orderId, dto);

    return Ok(result);
  }

  /**
   * PRIVATE: Get user statistics
   * Bot token authentication in query
   */
  @Get('users/:userId/stats')
  @ApiOperation({
    summary: 'Get user statistics',
    description: 'Get earnings and statistics for a specific user. Requires bot token in query parameter.',
  })
  @ApiParam({
    name: 'userId',
    description: 'Telegram user ID',
    type: Number,
    example: 123456789,
  })
  @ApiOkResponse({
    description: 'User statistics retrieved successfully',
    type: GetUserStatsResponseDto,
  })
  async getUserStats(
    @Param('userId', ParseIntPipe) userId: number,
    @Body('key') key: string,
  ): Promise<AsyncResult<GetUserStatsResponseDto, Error>> {
    const result = await this.sourceBotService.getUserStats(userId, key);

    return Ok(result);
  }

  /**
   * PRIVATE: Get bot statistics
   * Bot token authentication in request body
   */
  @Post('stats')
  @ApiOperation({
    summary: 'Get bot statistics',
    description: 'Get aggregated statistics for the bot. Requires bot token authentication.',
  })
  @ApiOkResponse({
    description: 'Bot statistics retrieved successfully',
    type: GetBotStatsResponseDto,
  })
  async getBotStats(@Body('key') key: string): Promise<AsyncResult<GetBotStatsResponseDto, Error>> {
    const result = await this.sourceBotService.getBotStats(key);

    return Ok(result);
  }
}
