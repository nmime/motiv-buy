import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiProblemExceptions, InternalException } from '@app/common-exception';
import { ClientDataProblemValidationException } from '@app/common-validation';
import { AsyncResult } from '@app/common-shared';
import { Ok } from 'ts-results';
import {
  ApiKey,
  ApiKeyGuard,
  CheckTaskStatusRequestDto,
  CheckTaskStatusResponseDto,
  CompleteTaskRequestDto,
  CompleteTaskResponseDto,
  GetFiltersResponseDto,
  GetTasksRequestDto,
  GetTasksResponseDto,
} from '@app/feature-traffic-shared';
import { SourceTaskService } from '../service/source-task.service';

/**
 * PUBLIC Traffic Source Task API Controller
 * For traffic sources to get tasks and complete them (FlyerService/SubGram pattern)
 * Uses API key authentication
 */
@ApiTags('Traffic Source - Public Task API')
@Controller('source/v1')
@ApiProblemExceptions([
  [InternalException, { description: 'Internal server error occurred' }],
  [ClientDataProblemValidationException, { description: 'Request validation failed' }],
])
export class TrafficSourcePublicController {
  constructor(private readonly sourceTaskService: SourceTaskService) {}

  /**
   * Get available filters (PUBLIC - no auth)
   */
  @Get('filters')
  @ApiOperation({
    summary: 'Get available filters',
    description:
      'Get targeting filter options for tasks (genders, age ranges, countries, languages). No authentication required.',
  })
  @ApiOkResponse({
    description: 'Available filters retrieved successfully',
    type: GetFiltersResponseDto,
  })
  async getFilters(): Promise<AsyncResult<GetFiltersResponseDto, Error>> {
    const result = await this.sourceTaskService.getFilters();

    return Ok(result);
  }

  /**
   * Get available tasks (API key auth)
   */
  @Get('tasks')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('apiKey')
  @ApiOperation({
    summary: 'Get available tasks',
    description:
      'Get list of available tasks for your traffic source. Filter by user demographics to get relevant tasks. Requires API key authentication.',
  })
  @ApiQuery({ name: 'userId', required: false, type: Number, description: 'User Telegram ID' })
  @ApiQuery({ name: 'languageCode', required: false, type: String, description: 'User language code (e.g., en, ru)' })
  @ApiQuery({ name: 'gender', required: false, enum: ['male', 'female'], description: 'User gender' })
  @ApiQuery({ name: 'age', required: false, type: Number, description: 'User age' })
  @ApiQuery({ name: 'country', required: false, type: String, description: 'User country code (e.g., US, GB)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of tasks to return' })
  @ApiOkResponse({
    description: 'Available tasks retrieved successfully',
    type: GetTasksResponseDto,
  })
  async getTasks(
    @ApiKey() apiKey: string,
    @Query() query: GetTasksRequestDto,
  ): Promise<AsyncResult<GetTasksResponseDto, Error>> {
    const result = await this.sourceTaskService.getAvailableTasks(apiKey, query);

    return Ok(result);
  }

  /**
   * Complete task (API key auth)
   */
  @Post('tasks/:taskId/complete')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('apiKey')
  @ApiOperation({
    summary: 'Complete task',
    description:
      'Submit task completion for a user. Task will be verified and reward will be credited. Requires API key authentication.',
  })
  @ApiParam({
    name: 'taskId',
    description: 'Task ID to complete',
    type: String,
    example: 'ORD-1234567890',
  })
  @ApiOkResponse({
    description: 'Task completion submitted successfully',
    type: CompleteTaskResponseDto,
  })
  async completeTask(
    @ApiKey() apiKey: string,
    @Param('taskId') taskId: string,
    @Body() dto: CompleteTaskRequestDto,
  ): Promise<AsyncResult<CompleteTaskResponseDto, Error>> {
    const result = await this.sourceTaskService.completeTask(apiKey, taskId, dto);

    return Ok(result);
  }

  /**
   * Check task status (API key auth)
   */
  @Get('tasks/:taskId/status')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('apiKey')
  @ApiOperation({
    summary: 'Check task status',
    description: 'Check the completion status of a task for a specific user. Requires API key authentication.',
  })
  @ApiParam({
    name: 'taskId',
    description: 'Task ID to check',
    type: String,
    example: 'ORD-1234567890',
  })
  @ApiQuery({ name: 'userId', required: true, type: Number, description: 'User Telegram ID' })
  @ApiOkResponse({
    description: 'Task status retrieved successfully',
    type: CheckTaskStatusResponseDto,
  })
  async checkTaskStatus(
    @ApiKey() apiKey: string,
    @Param('taskId') taskId: string,
    @Query() query: CheckTaskStatusRequestDto,
  ): Promise<AsyncResult<CheckTaskStatusResponseDto, Error>> {
    const result = await this.sourceTaskService.checkTaskStatus(apiKey, taskId, query);

    return Ok(result);
  }
}
