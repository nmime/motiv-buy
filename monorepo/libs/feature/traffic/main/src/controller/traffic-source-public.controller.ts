import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiProblemExceptions, InternalException } from '@app/common-exception';
import { ClientDataProblemValidationException } from '@app/common-validation';
import { AsyncResult } from '@app/common-shared';
import { Ok } from 'ts-results';
import {
  CheckSubscriptionRequestDto,
  CheckSubscriptionResponseDto,
  CheckTaskStatusRequestDto,
  CheckTaskStatusResponseDto,
  CompleteTaskRequestDto,
  CompleteTaskResponseDto,
  GetCompletedTasksRequestDto,
  GetCompletedTasksResponseDto,
  GetFiltersResponseDto,
  GetSourceInfoRequestDto,
  GetSourceInfoResponseDto,
  GetTasksRequestDto,
  GetTasksResponseDto,
} from '@app/feature-traffic-shared';
import { SourcePublicApiService } from '../service/source-public-api.service';

/**
 * PUBLIC Traffic Source API Controller
 * For traffic sources to interact with the platform
 * All endpoints use POST with apiKey in request body (SubGram/FlyerService pattern)
 */
@ApiTags('Traffic Source - Public API')
@Controller('source')
@ApiProblemExceptions([
  [InternalException, { description: 'Internal server error occurred' }],
  [ClientDataProblemValidationException, { description: 'Request validation failed' }],
])
export class TrafficSourcePublicController {
  constructor(private readonly sourcePublicApiService: SourcePublicApiService) {}

  /**
   * GET /source/filters - Get available targeting filters (PUBLIC - no auth)
   */
  @Get('filters')
  @ApiOperation({
    summary: 'Get available filters',
    description: 'Get targeting filter options (genders, ages, countries, languages, actions). No authentication required.',
  })
  @ApiOkResponse({
    description: 'Filters retrieved successfully',
    type: GetFiltersResponseDto,
  })
  async getFilters(): Promise<AsyncResult<GetFiltersResponseDto, Error>> {
    const result = await this.sourcePublicApiService.getFilters();

    return Ok(result);
  }

  /**
   * POST /source/info - Get traffic source information
   */
  @Post('info')
  @ApiOperation({
    summary: 'Get source info',
    description: 'Get information about your traffic source using API key. Validates API key and returns source details.',
  })
  @ApiOkResponse({
    description: 'Source info retrieved successfully',
    type: GetSourceInfoResponseDto,
  })
  async getSourceInfo(@Body() dto: GetSourceInfoRequestDto): Promise<AsyncResult<GetSourceInfoResponseDto, Error>> {
    const result = await this.sourcePublicApiService.getSourceInfo(dto);

    return Ok(result);
  }

  /**
   * POST /source/check-subscription - Check mandatory subscription status
   */
  @Post('check-subscription')
  @ApiOperation({
    summary: 'Check subscription',
    description: 'Check if user has mandatory subscriptions required before showing tasks.',
  })
  @ApiOkResponse({
    description: 'Subscription status checked successfully',
    type: CheckSubscriptionResponseDto,
  })
  async checkSubscription(
    @Body() dto: CheckSubscriptionRequestDto,
  ): Promise<AsyncResult<CheckSubscriptionResponseDto, Error>> {
    const result = await this.sourcePublicApiService.checkSubscription(dto);

    return Ok(result);
  }

  /**
   * POST /source/tasks - Get available tasks for user
   */
  @Post('tasks')
  @ApiOperation({
    summary: 'Get available tasks',
    description:
      'Get list of available tasks for a specific user. Tasks are filtered by targeting requirements (age, gender, country, language).',
  })
  @ApiOkResponse({
    description: 'Tasks retrieved successfully',
    type: GetTasksResponseDto,
  })
  async getTasks(@Body() dto: GetTasksRequestDto): Promise<AsyncResult<GetTasksResponseDto, Error>> {
    const result = await this.sourcePublicApiService.getTasks(dto);

    return Ok(result);
  }

  /**
   * POST /source/tasks/check - Check task completion status
   */
  @Post('tasks/check')
  @ApiOperation({
    summary: 'Check task status',
    description: 'Check the completion status of a specific task.',
  })
  @ApiOkResponse({
    description: 'Task status retrieved successfully',
    type: CheckTaskStatusResponseDto,
  })
  async checkTaskStatus(
    @Body() dto: CheckTaskStatusRequestDto,
  ): Promise<AsyncResult<CheckTaskStatusResponseDto, Error>> {
    const result = await this.sourcePublicApiService.checkTaskStatus(dto);

    return Ok(result);
  }

  /**
   * POST /source/tasks/complete - Submit task completion
   */
  @Post('tasks/complete')
  @ApiOperation({
    summary: 'Complete task',
    description:
      'Submit task completion for a user. This will verify the completion, credit rewards, and update balances.',
  })
  @ApiOkResponse({
    description: 'Task completion processed successfully',
    type: CompleteTaskResponseDto,
  })
  async completeTask(@Body() dto: CompleteTaskRequestDto): Promise<AsyncResult<CompleteTaskResponseDto, Error>> {
    const result = await this.sourcePublicApiService.completeTask(dto);

    return Ok(result);
  }

  /**
   * POST /source/tasks/completed - Get user's completed tasks
   */
  @Post('tasks/completed')
  @ApiOperation({
    summary: 'Get completed tasks',
    description: "Get list of tasks completed by a specific user with their rewards and completion timestamps.",
  })
  @ApiOkResponse({
    description: 'Completed tasks retrieved successfully',
    type: GetCompletedTasksResponseDto,
  })
  async getCompletedTasks(
    @Body() dto: GetCompletedTasksRequestDto,
  ): Promise<AsyncResult<GetCompletedTasksResponseDto, Error>> {
    const result = await this.sourcePublicApiService.getCompletedTasks(dto);

    return Ok(result);
  }
}
