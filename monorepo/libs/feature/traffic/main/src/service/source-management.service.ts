import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { getErrorMessage } from '@app/common-shared';
import {
  CreateSourceDto,
  RegenerateApiKeyResponseDto,
  SourceDetailsDto,
  SourceResponseDto,
  UpdateSourceDto,
} from '@app/feature-traffic-shared';
import { TrafficSourceEntity, TrafficSourceRepository, TrafficSourceType } from '@app/database';
import { ModerationService } from './moderation.service';
import { TelegramModerationNotifier } from '@app/feature-bot-main';
import * as crypto from 'crypto';

/**
 * Service for Private Traffic Source Management API
 * Handles creation, updating, and management of traffic sources
 */
@Injectable()
export class SourceManagementService {
  private readonly logger = new Logger(SourceManagementService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly trafficSourceRepository: TrafficSourceRepository,
    private readonly moderationService: ModerationService,
    private readonly telegramModerationNotifier: TelegramModerationNotifier,
  ) {}

  /**
   * Create new traffic source
   * PRIVATE API with JWT auth
   */
  async createSource(dto: CreateSourceDto, userId: string): Promise<SourceResponseDto> {
    this.logger.log(`Creating traffic source for user ${userId}`);

    try {
      return await this.em.transactional(async () => {
        // Validate bot token format
        if (!this.isValidTelegramBotToken(dto.botToken)) {
          throw new BadRequestException('Invalid bot token format');
        }

        // Extract bot ID from token
        const [botId] = dto.botToken.split(':');

        if (!botId) {
          throw new BadRequestException('Invalid bot token format');
        }

        // Check if bot already exists
        const existingSource = await this.trafficSourceRepository.findByTelegramId(botId);

        if (existingSource) {
          throw new BadRequestException('Bot already registered');
        }

        // Create traffic source (initially inactive, pending moderation)
        const source = new TrafficSourceEntity({
          name: dto.name,
          description: dto.description,
          type: TrafficSourceType.BotWithToken,
          botToken: dto.botToken,
          botUsername: dto.botUsername,
          telegramId: botId,
          isActive: false, // Inactive until approved
          managedById: userId,
        });

        await this.em.persistAndFlush(source);

        // Generate and securely store API key
        const apiKey = await this.trafficSourceRepository.regenerateApiKey(source.id);

        this.logger.log(`Traffic source created: ${source.id}`);

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
        return {
          ...this.mapSourceToResponseDto(source),
          apiKey, // Override with real API key
        };
      });
    } catch (err: unknown) {
      this.logger.error(`Create source failed: ${getErrorMessage(err)}`);

      if (err instanceof BadRequestException) {
        throw err;
      }

      throw new BadRequestException('Failed to create traffic source');
    }
  }

  /**
   * Update traffic source
   * PRIVATE API with JWT auth
   */
  async updateSource(sourceId: string, dto: UpdateSourceDto, userId: string): Promise<SourceResponseDto> {
    this.logger.log(`Updating traffic source: ${sourceId}`);

    try {
      return await this.em.transactional(async () => {
        const source = await this.trafficSourceRepository.findById(sourceId);

        if (!source) {
          throw new NotFoundException('Traffic source not found');
        }

        // Check access
        await this.validateSourceAccess(source, userId);

        // Update fields
        if (dto.name !== undefined) {
          source.name = dto.name;
        }

        if (dto.description !== undefined) {
          source.description = dto.description;
        }

        if (dto.isActive !== undefined) {
          source.isActive = dto.isActive;
        }

        if (dto.botUsername !== undefined) {
          source.botUsername = dto.botUsername;
        }

        await this.em.flush();

        this.logger.log(`Traffic source updated: ${sourceId}`);

        return this.mapSourceToResponseDto(source);
      });
    } catch (err: unknown) {
      this.logger.error(`Update source failed: ${getErrorMessage(err)}`);

      if (err instanceof NotFoundException || err instanceof ForbiddenException) {
        throw err;
      }

      throw new BadRequestException('Failed to update traffic source');
    }
  }

  /**
   * Delete traffic source
   * PRIVATE API with JWT auth
   */
  async deleteSource(sourceId: string, userId: string): Promise<{ message: string }> {
    this.logger.log(`Deleting traffic source: ${sourceId}`);

    try {
      return await this.em.transactional(async () => {
        const source = await this.trafficSourceRepository.findById(sourceId);

        if (!source) {
          throw new NotFoundException('Traffic source not found');
        }

        // Check access
        await this.validateSourceAccess(source, userId);

        // Soft delete by deactivating
        await this.trafficSourceRepository.deactivate(sourceId);

        this.logger.log(`Traffic source deleted: ${sourceId}`);

        return { message: 'Traffic source deleted successfully' };
      });
    } catch (err: unknown) {
      this.logger.error(`Delete source failed: ${getErrorMessage(err)}`);

      if (err instanceof NotFoundException || err instanceof ForbiddenException) {
        throw err;
      }

      throw new BadRequestException('Failed to delete traffic source');
    }
  }

  /**
   * Get traffic source details
   * PRIVATE API with JWT auth
   */
  async getSourceDetails(sourceId: string, userId: string): Promise<SourceDetailsDto> {
    this.logger.log(`Getting source details: ${sourceId}`);

    try {
      const source = await this.trafficSourceRepository.findById(sourceId);

      if (!source) {
        throw new NotFoundException('Traffic source not found');
      }

      // Check access
      await this.validateSourceAccess(source, userId);

      // TODO: Add statistics from TrafficActions, TrafficUsers
      // For now, return basic details
      const response = this.mapSourceToResponseDto(source);

      return {
        ...response,
        totalTasksCompleted: 0,
        activeUsersCount: 0,
        totalEarnings: '0.00',
        categories: [],
      };
    } catch (err: unknown) {
      this.logger.error(`Get source details failed: ${getErrorMessage(err)}`);

      if (err instanceof NotFoundException || err instanceof ForbiddenException) {
        throw err;
      }

      throw new BadRequestException('Failed to get source details');
    }
  }

  /**
   * List user's traffic sources
   * PRIVATE API with JWT auth
   */
  async listUserSources(userId: string): Promise<SourceResponseDto[]> {
    this.logger.log(`Listing sources for user: ${userId}`);

    try {
      const sources = await this.trafficSourceRepository.findByManager(userId);

      return sources.map((source: TrafficSourceEntity) => this.mapSourceToResponseDto(source));
    } catch (err: unknown) {
      this.logger.error(`List sources failed: ${getErrorMessage(err)}`);
      throw new BadRequestException('Failed to list traffic sources');
    }
  }

  /**
   * Regenerate API key for source
   * PRIVATE API with JWT auth
   * Uses repository's secure method to generate, hash, and store API key
   */
  async regenerateApiKey(sourceId: string, userId: string): Promise<RegenerateApiKeyResponseDto> {
    this.logger.log(`Regenerating API key for source: ${sourceId}`);

    try {
      return await this.em.transactional(async () => {
        const source = await this.trafficSourceRepository.findOne({ id: sourceId });

        if (!source) {
          throw new NotFoundException('Traffic source not found');
        }

        // Check access
        await this.validateSourceAccess(source, userId);

        // Generate and securely store new API key using repository method
        // This automatically hashes the key and stores the prefix for fast lookup
        const newApiKey = await this.trafficSourceRepository.regenerateApiKey(sourceId);

        this.logger.log(`API key regenerated for source: ${sourceId}`);

        return {
          apiKey: newApiKey,
          message: 'API key regenerated successfully. Update your application with the new key.',
        };
      });
    } catch (err: unknown) {
      this.logger.error(`Regenerate API key failed: ${getErrorMessage(err)}`);

      if (err instanceof NotFoundException || err instanceof ForbiddenException) {
        throw err;
      }

      throw new BadRequestException('Failed to regenerate API key');
    }
  }

  // =====================================
  // PRIVATE HELPER METHODS
  // =====================================

  /**
   * Validate user has access to source
   */
  private async validateSourceAccess(source: TrafficSourceEntity, userId: string): Promise<void> {
    const managedBy = await source.managedBy?.load();

    if (!managedBy || managedBy.id !== userId) {
      throw new ForbiddenException('You do not have access to this traffic source');
    }
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
      isActive: source.isActive,
      apiKey: '***HIDDEN***', // Never expose API key after creation
      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString(),
    };
  }
}
