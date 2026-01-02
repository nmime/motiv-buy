import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiSecurity, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiProblemExceptions, InternalException } from '@app/common-exception';
import { ClientDataProblemValidationException } from '@app/common-validation';
import { AsyncResult } from '@app/common-shared';
import { Ok } from 'ts-results';
import {
  ApiKey,
  ApiKeyGuard,
  ApiKeyThrottlerGuard,
  CheckTaskStatusRequestDto,
  CheckTaskStatusResponseDto,
  GetTasksRequestDto,
  GetTasksResponseDto,
} from '@app/feature-traffic-shared';
import { SourcePublicApiService } from '../service/source-public-api.service';

/**
 * PUBLIC Traffic Source API Controller
 * API for traffic source integration - handles task discovery and completion checking
 * API key is passed via X-API-Key header
 *
 * Endpoints:
 * - POST /source/tasks - Get available tasks for user (with targeting)
 * - POST /source/tasks/check - Check task completion status and get reward
 *
 * Flow:
 * 1. Source calls /tasks to get available tasks for a user
 * 2. Source shows tasks to user, user completes action (join channel, etc.)
 * 3. Bot detects completion and marks action as completed
 * 4. Source calls /tasks/check to verify completion and get reward amount
 * 5. Source rewards user with the returned amount
 *
 * Rate Limiting:
 * - 10000 requests per minute per API key (166 req/sec sustained)
 * - Supports high-volume traffic sources (up to 1k RPS burst)
 * - Fallback to IP-based limiting if no API key provided
 */
@ApiTags('Traffic Source - External API')
@ApiSecurity('X-API-Key')
@Controller('source')
@UseGuards(ApiKeyThrottlerGuard)
@Throttle({ default: { limit: 10000, ttl: 60000 } }) // 10000 req/min = 166 req/sec per API key
@ApiProblemExceptions([
  [InternalException, { description: 'Internal server error occurred' }],
  [ClientDataProblemValidationException, { description: 'Request validation failed' }],
])
export class TrafficSourcePublicController {
  constructor(private readonly sourcePublicApiService: SourcePublicApiService) {}

  /**
   * POST /source/tasks - Get available tasks for user
   */
  @Post('tasks')
  @UseGuards(ApiKeyGuard)
  @ApiOperation({
    summary: 'Get available tasks',
    description:
      'Get list of available tasks for a specific user. Tasks are filtered by targeting requirements (age, gender, country, language, region). ' +
      'Returns tasks the user has not yet completed.',
  })
  @ApiHeader({
    name: 'X-API-Key',
    description: 'Traffic source API key',
    required: true,
  })
  @ApiOkResponse({
    description: 'Tasks retrieved successfully',
    type: GetTasksResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing API key' })
  async getTasks(@ApiKey() apiKey: string, @Body() dto: GetTasksRequestDto): AsyncResult<GetTasksResponseDto, Error> {
    const result = await this.sourcePublicApiService.getTasks(apiKey, dto);

    return Ok(result);
  }

  /**
   * POST /source/tasks/check - Check task completion status and get reward
   */
  @Post('tasks/check')
  @UseGuards(ApiKeyGuard)
  @ApiOperation({
    summary: 'Check task completion and get reward',
    description:
      'Check if a task has been completed by the user. If completed, returns the reward amount to pay the user. ' +
      'Status can be: not_started (user has not performed action), pending (action in progress), completed (done, includes reward), failed.',
  })
  @ApiHeader({
    name: 'X-API-Key',
    description: 'Traffic source API key',
    required: true,
  })
  @ApiOkResponse({
    description: 'Task status retrieved successfully',
    type: CheckTaskStatusResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing API key' })
  async checkTaskStatus(
    @ApiKey() apiKey: string,
    @Body() dto: CheckTaskStatusRequestDto,
  ): AsyncResult<CheckTaskStatusResponseDto, Error> {
    const result = await this.sourcePublicApiService.checkTaskStatus(apiKey, dto);

    return Ok(result);
  }
}
