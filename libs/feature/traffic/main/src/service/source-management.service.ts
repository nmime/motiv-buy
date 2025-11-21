import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { AsyncResult, getErrorMessage } from '@app/common-shared';
import { Err, Ok } from 'ts-results';
import {
  CreateSourceDto,
  RegenerateApiKeyResponseDto,
  SourceDetailsDto,
  SourceResponseDto,
  UpdateSourceDto,
} from '@app/feature-traffic-shared';
import { TrafficSourceEntity, TrafficSourceRepository, TrafficSourceType, TrafficSourceStatus } from '@app/database';
import { BotFactoryService, TelegramModerationNotifier } from '@app/feature-bot-shared';
import { ModerationService } from './moderation.service';

/**
 * Service for Private Traffic Source Management API
 * Handles creation, updating, and management of traffic sources
 *
 * Supports two creation flows:
 * 1. WITH Token: Validates bot token via Telegram API (automated)
 * 2. WITHOUT Token: Validates bot username format only (manual moderation)
 *
 * Uses ts-results pattern - returns Err() instead of throwing exceptions
 */
@Injectable()
export class SourceManagementService {
  private readonly logger = new Logger(SourceManagementService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly trafficSourceRepository: TrafficSourceRepository,
    private readonly moderationService: ModerationService,
    private readonly telegramModerationNotifier: TelegramModerationNotifier,
    private readonly botTokenValidator: BotFactoryService,
  ) {}

  /**
   * Create new traffic source
   * PRIVATE API with JWT auth
   *
   * Supports two flows:
   * 1. WITH Token: Validates bot token via Telegram API, auto-extracts bot info
   * 2. WITHOUT Token: Validates bot username format, requires manual moderation
   */
  async createSource(dto: CreateSourceDto, userId: string): AsyncResult<SourceResponseDto, BadRequestException> {
    this.logger.log(`Creating traffic source for user ${userId}`);

    try {
      // Validate that at least one of botToken or botUsername is provided
      if (!dto.botToken && !dto.botUsername) {
        return Err(new BadRequestException({ detail: 'Either botToken or botUsername must be provided' }));
      }

      // Determine creation flow and validate accordingly
      if (dto.botToken) {
        // WITH Token flow: Validate token via Telegram API
        return await this.createSourceWithToken(dto, userId);
      }

      // WITHOUT Token flow: Validate username format only
      return await this.createSourceWithoutToken(dto, userId);
    } catch (err: unknown) {
      this.logger.error(`Create source failed: ${getErrorMessage(err)}`);

      return Err(new BadRequestException({ detail: 'Failed to create traffic source' }));
    }
  }

  /**
   * Create traffic source WITH bot token (automated validation)
   * @private
   */
  private async createSourceWithToken(
    dto: CreateSourceDto,
    userId: string,
  ): AsyncResult<SourceResponseDto, BadRequestException> {
    this.logger.log('Creating traffic source WITH token (automated validation flow)');

    return this.em.transactional(async () => {
      // Extract and validate bot token existence
      const { botToken } = dto;
      if (!botToken) {
        return Err(new BadRequestException({ detail: 'Bot token is required for WITH token flow' }));
      }

      // Validate bot token format
      if (!this.isValidTelegramBotToken(botToken)) {
        return Err(new BadRequestException({ detail: 'Invalid bot token format' }));
      }

      // Validate token via Telegram API
      const validationResult = await this.botTokenValidator.validateBotToken(botToken);

      if (!validationResult.isValid) {
        return Err(new BadRequestException({ detail: validationResult.error || 'Invalid bot token' }));
      }

      const { botInfo } = validationResult;
      if (!botInfo) {
        return Err(new BadRequestException({ detail: 'Failed to retrieve bot information' }));
      }

      const botId = String(botInfo.id);

      // Check if bot already exists
      const existingSource = await this.trafficSourceRepository.findByTelegramId(botId);

      if (existingSource) {
        return Err(new BadRequestException({ detail: 'Bot already registered' }));
      }

      // Create traffic source (initially Pending status, awaiting moderation)
      const source = new TrafficSourceEntity({
        name: dto.name,
        description: dto.description,
        type: TrafficSourceType.BotWithToken,
        status: TrafficSourceStatus.Pending, // Awaiting moderation
        botToken: dto.botToken,
        botUsername: botInfo.username || dto.botUsername,
        telegramId: botId,
        managedById: userId,
      });

      await this.em.persistAndFlush(source);

      // Generate and securely store API key
      const apiKey = await this.trafficSourceRepository.regenerateApiKey(source.id);

      this.logger.log(`Traffic source created WITH token: ${source.id} (@${botInfo.username})`);

      // Create moderation request
      const moderationRequest = await this.moderationService.createSourceModerationRequest(source.id);

      // Send notification to Telegram moderation channel
      const notification = await this.telegramModerationNotifier.notifySourceCreated(source, moderationRequest);

      // Update moderation request with Telegram message info
      if (notification) {
        await this.moderationService.updateTelegramMessage(
          moderationRequest.id,
          notification.chatId,
          notification.messageId,
        );
      }

      // Return response with plain text API key (ONLY time it's visible)
      return Ok({
        ...this.mapSourceToResponseDto(source),
        apiKey, // Override with real API key
      });
    });
  }

  /**
   * Create traffic source WITHOUT bot token (manual validation)
   * @private
   */
  private async createSourceWithoutToken(
    dto: CreateSourceDto,
    userId: string,
  ): AsyncResult<SourceResponseDto, BadRequestException> {
    this.logger.log('Creating traffic source WITHOUT token (manual moderation flow)');

    return this.em.transactional(async () => {
      const { botUsername } = dto;
      if (!botUsername) {
        return Err(new BadRequestException({ detail: 'Bot username is required when bot token is not provided' }));
      }

      // Validate bot username format
      const usernameValidation = await this.botTokenValidator.validateBotUsername(botUsername);

      if (!usernameValidation.isValid) {
        return Err(new BadRequestException({ detail: usernameValidation.error || 'Invalid bot username' }));
      }

      const { username: cleanUsername } = usernameValidation;
      if (!cleanUsername) {
        return Err(new BadRequestException({ detail: 'Failed to extract bot username' }));
      }

      // Check if bot username already exists
      const existingSource = await this.trafficSourceRepository.findByBotUsername(cleanUsername);

      if (existingSource) {
        return Err(new BadRequestException({ detail: 'Bot username already registered' }));
      }

      // Create traffic source (initially Pending status, awaiting MANUAL moderation)
      const source = new TrafficSourceEntity({
        name: dto.name,
        description: dto.description,
        type: TrafficSourceType.Bot, // WITHOUT token type
        status: TrafficSourceStatus.Pending, // Awaiting moderation
        botToken: undefined, // No token provided
        botUsername: cleanUsername,
        telegramId: undefined, // Will be set after manual verification
        managedById: userId,
      });

      await this.em.persistAndFlush(source);

      // Generate and securely store API key
      const apiKey = await this.trafficSourceRepository.regenerateApiKey(source.id);

      this.logger.log(`Traffic source created WITHOUT token: ${source.id} (@${cleanUsername})`);

      // Create moderation request
      const moderationRequest = await this.moderationService.createSourceModerationRequest(source.id);

      // Send notification to Telegram moderation channel
      const notification = await this.telegramModerationNotifier.notifySourceCreated(source, moderationRequest);

      // Update moderation request with Telegram message info
      if (notification) {
        await this.moderationService.updateTelegramMessage(
          moderationRequest.id,
          notification.chatId,
          notification.messageId,
        );
      }

      // Return response with plain text API key (ONLY time it's visible)
      return Ok({
        ...this.mapSourceToResponseDto(source),
        apiKey, // Override with real API key
      });
    });
  }

  /**
   * Update traffic source
   * PRIVATE API with JWT auth
   */
  async updateSource(
    sourceId: string,
    dto: UpdateSourceDto,
    userId: string,
  ): AsyncResult<SourceResponseDto, NotFoundException | ForbiddenException | BadRequestException> {
    this.logger.log(`Updating traffic source: ${sourceId}`);

    try {
      return await this.em.transactional(async () => {
        const source = await this.trafficSourceRepository.findById(sourceId);

        if (!source) {
          return Err(new NotFoundException('Traffic source not found'));
        }

        // Check access
        const accessCheck = await this.validateSourceAccess(source, userId);
        if (accessCheck.err) {
          return accessCheck;
        }

        // Update fields
        if (dto.name !== undefined) {
          source.name = dto.name;
        }

        if (dto.description !== undefined) {
          source.description = dto.description;
        }

        // Handle isActive for backwards compatibility - convert to status
        if (dto.isActive !== undefined) {
          source.status = dto.isActive ? TrafficSourceStatus.Active : TrafficSourceStatus.Inactive;
        }

        if (dto.botUsername !== undefined) {
          source.botUsername = dto.botUsername;
        }

        await this.em.flush();

        this.logger.log(`Traffic source updated: ${sourceId}`);

        return Ok(this.mapSourceToResponseDto(source));
      });
    } catch (err: unknown) {
      this.logger.error(`Update source failed: ${getErrorMessage(err)}`);

      return Err(new BadRequestException({ detail: 'Failed to update traffic source' }));
    }
  }

  /**
   * Delete traffic source
   * PRIVATE API with JWT auth
   */
  async deleteSource(
    sourceId: string,
    userId: string,
  ): AsyncResult<{ message: string }, NotFoundException | ForbiddenException | BadRequestException> {
    this.logger.log(`Deleting traffic source: ${sourceId}`);

    try {
      return await this.em.transactional(async () => {
        const source = await this.trafficSourceRepository.findById(sourceId);

        if (!source) {
          return Err(new NotFoundException('Traffic source not found'));
        }

        // Check access
        const accessCheck = await this.validateSourceAccess(source, userId);
        if (accessCheck.err) {
          return accessCheck;
        }

        // Soft delete by deactivating
        await this.trafficSourceRepository.deactivate(sourceId);

        this.logger.log(`Traffic source deleted: ${sourceId}`);

        return Ok({ message: 'Traffic source deleted successfully' });
      });
    } catch (err: unknown) {
      this.logger.error(`Delete source failed: ${getErrorMessage(err)}`);

      return Err(new BadRequestException({ detail: 'Failed to delete traffic source' }));
    }
  }

  /**
   * Get traffic source details
   * PRIVATE API with JWT auth
   */
  async getSourceDetails(
    sourceId: string,
    userId: string,
  ): AsyncResult<SourceDetailsDto, NotFoundException | ForbiddenException | BadRequestException> {
    this.logger.log(`Getting source details: ${sourceId}`);

    try {
      const source = await this.trafficSourceRepository.findById(sourceId);

      if (!source) {
        return Err(new NotFoundException('Traffic source not found'));
      }

      // Check access
      const accessCheck = await this.validateSourceAccess(source, userId);
      if (accessCheck.err) {
        return accessCheck;
      }

      // Return basic source details
      const response = this.mapSourceToResponseDto(source);

      return Ok({
        ...response,
        totalTasksCompleted: 0,
        activeUsersCount: 0,
        totalEarnings: '0.00',
        categories: [],
      });
    } catch (err: unknown) {
      this.logger.error(`Get source details failed: ${getErrorMessage(err)}`);

      return Err(new BadRequestException({ detail: 'Failed to get source details' }));
    }
  }

  /**
   * List user's traffic sources
   * PRIVATE API with JWT auth
   */
  async listUserSources(userId: string): AsyncResult<SourceResponseDto[], BadRequestException> {
    this.logger.log(`Listing sources for user: ${userId}`);

    try {
      const sources = await this.trafficSourceRepository.findByManager(userId);

      return Ok(sources.map((source: TrafficSourceEntity) => this.mapSourceToResponseDto(source)));
    } catch (err: unknown) {
      this.logger.error(`List sources failed: ${getErrorMessage(err)}`);

      return Err(new BadRequestException({ detail: 'Failed to list traffic sources' }));
    }
  }

  /**
   * Regenerate API key for source
   * PRIVATE API with JWT auth
   * Uses repository's secure method to generate, hash, and store API key
   */
  async regenerateApiKey(
    sourceId: string,
    userId: string,
  ): AsyncResult<RegenerateApiKeyResponseDto, NotFoundException | ForbiddenException | BadRequestException> {
    this.logger.log(`Regenerating API key for source: ${sourceId}`);

    try {
      return await this.em.transactional(async () => {
        const source = await this.trafficSourceRepository.findOne({ id: sourceId });

        if (!source) {
          return Err(new NotFoundException('Traffic source not found'));
        }

        // Check access
        const accessCheck = await this.validateSourceAccess(source, userId);
        if (accessCheck.err) {
          return accessCheck;
        }

        // Generate and securely store new API key using repository method
        // This automatically hashes the key and stores the prefix for fast lookup
        const newApiKey = await this.trafficSourceRepository.regenerateApiKey(sourceId);

        this.logger.log(`API key regenerated for source: ${sourceId}`);

        return Ok({
          apiKey: newApiKey,
          message: 'API key regenerated successfully. Update your application with the new key.',
        });
      });
    } catch (err: unknown) {
      this.logger.error(`Regenerate API key failed: ${getErrorMessage(err)}`);

      return Err(new BadRequestException({ detail: 'Failed to regenerate API key' }));
    }
  }

  // =====================================
  // PRIVATE HELPER METHODS
  // =====================================

  /**
   * Validate user has access to source
   */
  private async validateSourceAccess(
    source: TrafficSourceEntity,
    userId: string,
  ): AsyncResult<void, ForbiddenException> {
    const managedBy = await source.managedBy?.load();

    if (!managedBy || managedBy.id !== userId) {
      return Err(new ForbiddenException('You do not have access to this traffic source'));
    }

    return Ok(undefined);
  }

  /**
   * Validate Telegram bot token format
   */
  private isValidTelegramBotToken(token: string): boolean {
    // Telegram bot token format: <bot_id>:<random_string>
    const tokenRegex = /^\d+:[A-Za-z0-9_-]+$/;

    return tokenRegex.test(token);
  }

  /**
   * Map source entity to response DTO
   * Note: API key is NEVER included in regular responses (security)
   * Only returned once during creation/regeneration
   */
  private mapSourceToResponseDto(source: TrafficSourceEntity): SourceResponseDto {
    return {
      id: source.id,
      name: source.name,
      description: source.description,
      type: source.type,
      botUsername: source.botUsername,
      telegramId: source.telegramId,
      isActive: source.status === TrafficSourceStatus.Active, // Map status to isActive for backwards compatibility
      apiKey: '***HIDDEN***', // Never expose API key after creation
      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString(),
    };
  }
}
