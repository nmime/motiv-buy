import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiProblemExceptions, InternalException } from '@app/common-exception';
import { ClientDataProblemValidationException } from '@app/common-validation';
import { AsyncResult } from '@app/common-shared';
import { Ok } from 'ts-results';
import { CurrentUserId, JwtAuthGuard } from '@app/feature-auth-shared';
import {
  CreateSourceDto,
  RegenerateApiKeyResponseDto,
  SourceDetailsDto,
  SourceResponseDto,
  UpdateSourceDto,
} from '@app/feature-traffic-shared';
import { SourceManagementService } from '../service/source-management.service';

/**
 * PRIVATE Traffic Source Management API Controller
 * For users/admins to create and manage their traffic sources
 * Uses JWT authentication
 */
@ApiTags('Traffic Source - Management API')
@Controller('traffic-sources')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiProblemExceptions([
  [InternalException, { description: 'Internal server error occurred' }],
  [ClientDataProblemValidationException, { description: 'Request validation failed' }],
])
export class TrafficSourceManagementController {
  constructor(private readonly sourceManagementService: SourceManagementService) {}

  /**
   * Create new traffic source
   */
  @Post()
  @ApiOperation({
    summary: 'Create traffic source',
    description: 'Create a new traffic source by registering a Telegram bot. Requires JWT authentication.',
  })
  @ApiOkResponse({
    description: 'Traffic source created successfully',
    type: SourceResponseDto,
  })
  async createSource(
    @Body() dto: CreateSourceDto,
    @CurrentUserId() userId: string,
  ): Promise<AsyncResult<SourceResponseDto, Error>> {
    const result = await this.sourceManagementService.createSource(dto, userId);

    return Ok(result);
  }

  /**
   * List user's traffic sources
   */
  @Get()
  @ApiOperation({
    summary: 'List traffic sources',
    description: 'Get all traffic sources owned by the current user. Requires JWT authentication.',
  })
  @ApiOkResponse({
    description: 'Traffic sources retrieved successfully',
    type: [SourceResponseDto],
  })
  async listSources(@CurrentUserId() userId: string): Promise<AsyncResult<SourceResponseDto[], Error>> {
    const result = await this.sourceManagementService.listUserSources(userId);

    return Ok(result);
  }

  /**
   * Get traffic source details
   */
  @Get(':sourceId')
  @ApiOperation({
    summary: 'Get traffic source details',
    description: 'Get detailed information about a specific traffic source. Requires JWT authentication.',
  })
  @ApiParam({
    name: 'sourceId',
    description: 'Traffic source ID',
    type: String,
    example: '01234567-89ab-cdef-0123-456789abcdef',
  })
  @ApiOkResponse({
    description: 'Traffic source details retrieved successfully',
    type: SourceDetailsDto,
  })
  async getSourceDetails(
    @Param('sourceId') sourceId: string,
    @CurrentUserId() userId: string,
  ): Promise<AsyncResult<SourceDetailsDto, Error>> {
    const result = await this.sourceManagementService.getSourceDetails(sourceId, userId);

    return Ok(result);
  }

  /**
   * Update traffic source
   */
  @Put(':sourceId')
  @ApiOperation({
    summary: 'Update traffic source',
    description: 'Update traffic source configuration and settings. Requires JWT authentication.',
  })
  @ApiParam({
    name: 'sourceId',
    description: 'Traffic source ID',
    type: String,
    example: '01234567-89ab-cdef-0123-456789abcdef',
  })
  @ApiOkResponse({
    description: 'Traffic source updated successfully',
    type: SourceResponseDto,
  })
  async updateSource(
    @Param('sourceId') sourceId: string,
    @Body() dto: UpdateSourceDto,
    @CurrentUserId() userId: string,
  ): Promise<AsyncResult<SourceResponseDto, Error>> {
    const result = await this.sourceManagementService.updateSource(sourceId, dto, userId);

    return Ok(result);
  }

  /**
   * Delete traffic source
   */
  @Delete(':sourceId')
  @ApiOperation({
    summary: 'Delete traffic source',
    description: 'Delete a traffic source. This will deactivate the source. Requires JWT authentication.',
  })
  @ApiParam({
    name: 'sourceId',
    description: 'Traffic source ID',
    type: String,
    example: '01234567-89ab-cdef-0123-456789abcdef',
  })
  @ApiOkResponse({
    description: 'Traffic source deleted successfully',
  })
  async deleteSource(
    @Param('sourceId') sourceId: string,
    @CurrentUserId() userId: string,
  ): Promise<AsyncResult<{ message: string }, Error>> {
    const result = await this.sourceManagementService.deleteSource(sourceId, userId);

    return Ok(result);
  }

  /**
   * Regenerate API key
   */
  @Post(':sourceId/regenerate-key')
  @ApiOperation({
    summary: 'Regenerate API key',
    description:
      'Generate a new API key for the traffic source. Old key will be invalidated. Requires JWT authentication.',
  })
  @ApiParam({
    name: 'sourceId',
    description: 'Traffic source ID',
    type: String,
    example: '01234567-89ab-cdef-0123-456789abcdef',
  })
  @ApiOkResponse({
    description: 'API key regenerated successfully',
    type: RegenerateApiKeyResponseDto,
  })
  async regenerateApiKey(
    @Param('sourceId') sourceId: string,
    @CurrentUserId() userId: string,
  ): Promise<AsyncResult<RegenerateApiKeyResponseDto, Error>> {
    const result = await this.sourceManagementService.regenerateApiKey(sourceId, userId);

    return Ok(result);
  }
}
