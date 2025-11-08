import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { getErrorMessage } from '@app/common-shared';
import { IModerationService } from '@app/feature-traffic-shared';
import {
  ModerationRequestEntity,
  ModerationRequestRepository,
  ModerationEntityType,
  ModerationStatus,
  TrafficSourceEntity,
  TrafficSourceRepository,
  TrafficOrderEntity,
  TrafficOrderRepository,
  TrafficOrderStatus,
} from '@app/database';

/**
 * Moderation Service
 * Handles approval workflow for traffic sources and orders via Telegram channel
 *
 * Implements IModerationService interface to allow bot-main to use it without circular dependency.
 */
@Injectable()
export class ModerationService implements IModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly moderationRequestRepository: ModerationRequestRepository,
    private readonly trafficSourceRepository: TrafficSourceRepository,
    private readonly trafficOrderRepository: TrafficOrderRepository,
  ) {}

  /**
   * Create moderation request for traffic source
   * Called after source creation
   */
  async createSourceModerationRequest(sourceId: string): Promise<ModerationRequestEntity> {
    this.logger.log(`Creating moderation request for source: ${sourceId}`);

    try {
      return await this.em.transactional(async () => {
        // Verify source exists
        const source = await this.trafficSourceRepository.findById(sourceId);

        if (!source) {
          throw new NotFoundException('Traffic source not found');
        }

        // Create moderation request
        const request = await this.moderationRequestRepository.createRequest({
          entityType: ModerationEntityType.TrafficSource,
          entityId: sourceId,
        });

        return request;
      });
    } catch (err: unknown) {
      this.logger.error(`Create source moderation request failed: ${getErrorMessage(err)}`);
      throw err;
    }
  }

  /**
   * Create moderation request for traffic order
   * Called after order creation
   */
  async createOrderModerationRequest(orderId: string): Promise<ModerationRequestEntity> {
    this.logger.log(`Creating moderation request for order: ${orderId}`);

    try {
      return await this.em.transactional(async () => {
        // Verify order exists
        const order = await this.trafficOrderRepository.findOne({ id: orderId });

        if (!order) {
          throw new NotFoundException('Traffic order not found');
        }

        // Create moderation request
        const request = await this.moderationRequestRepository.createRequest({
          entityType: ModerationEntityType.TrafficOrder,
          entityId: orderId,
        });

        return request;
      });
    } catch (err: unknown) {
      this.logger.error(`Create order moderation request failed: ${getErrorMessage(err)}`);
      throw err;
    }
  }

  /**
   * Approve traffic source
   * Updates source status to active and moderation request to approved
   */
  async approveSource(requestId: string, reviewedByUserId: string, reviewNote?: string): Promise<void> {
    this.logger.log(`Approving source moderation request: ${requestId}`);

    try {
      await this.em.transactional(async () => {
        // Update moderation request
        const request = await this.moderationRequestRepository.approve(requestId, reviewedByUserId, reviewNote);

        if (!request) {
          throw new NotFoundException('Moderation request not found');
        }

        // Activate the traffic source
        await this.trafficSourceRepository.activateSource(request.entityId);

        this.logger.log(`Source approved: ${request.entityId}`);
      });
    } catch (err: unknown) {
      this.logger.error(`Approve source failed: ${getErrorMessage(err)}`);
      throw err;
    }
  }

  /**
   * Decline traffic source
   * Deactivates source and updates moderation request
   */
  async declineSource(requestId: string, reviewedByUserId: string, reviewNote?: string): Promise<void> {
    this.logger.log(`Declining source moderation request: ${requestId}`);

    try {
      await this.em.transactional(async () => {
        // Update moderation request
        const request = await this.moderationRequestRepository.decline(requestId, reviewedByUserId, reviewNote);

        if (!request) {
          throw new NotFoundException('Moderation request not found');
        }

        // Deactivate the traffic source
        await this.trafficSourceRepository.deactivateSource(request.entityId);

        this.logger.log(`Source declined: ${request.entityId}`);
      });
    } catch (err: unknown) {
      this.logger.error(`Decline source failed: ${getErrorMessage(err)}`);
      throw err;
    }
  }

  /**
   * Approve traffic order
   * Updates order status to active and moderation request to approved
   */
  async approveOrder(requestId: string, reviewedByUserId: string, reviewNote?: string): Promise<void> {
    this.logger.log(`Approving order moderation request: ${requestId}`);

    try {
      await this.em.transactional(async () => {
        // Update moderation request
        const request = await this.moderationRequestRepository.approve(requestId, reviewedByUserId, reviewNote);

        if (!request) {
          throw new NotFoundException('Moderation request not found');
        }

        // Activate the traffic order
        const order = await this.trafficOrderRepository.findOne({ id: request.entityId });

        if (order) {
          order.status = TrafficOrderStatus.Active;
          await this.em.flush();
        }

        this.logger.log(`Order approved: ${request.entityId}`);
      });
    } catch (err: unknown) {
      this.logger.error(`Approve order failed: ${getErrorMessage(err)}`);
      throw err;
    }
  }

  /**
   * Decline traffic order
   * Updates order status to cancelled and moderation request to declined
   */
  async declineOrder(requestId: string, reviewedByUserId: string, reviewNote?: string): Promise<void> {
    this.logger.log(`Declining order moderation request: ${requestId}`);

    try {
      await this.em.transactional(async () => {
        // Update moderation request
        const request = await this.moderationRequestRepository.decline(requestId, reviewedByUserId, reviewNote);

        if (!request) {
          throw new NotFoundException('Moderation request not found');
        }

        // Cancel the traffic order
        const order = await this.trafficOrderRepository.findOne({ id: request.entityId });

        if (order) {
          order.status = TrafficOrderStatus.Cancelled;
          await this.em.flush();
        }

        this.logger.log(`Order declined: ${request.entityId}`);
      });
    } catch (err: unknown) {
      this.logger.error(`Decline order failed: ${getErrorMessage(err)}`);
      throw err;
    }
  }

  /**
   * Get moderation request by entity
   */
  async getModerationRequest(entityType: ModerationEntityType, entityId: string): Promise<ModerationRequestEntity | null> {
    return this.moderationRequestRepository.findByEntity(entityType, entityId);
  }

  /**
   * Get all pending moderation requests
   */
  async getPendingRequests(): Promise<ModerationRequestEntity[]> {
    return this.moderationRequestRepository.findPending();
  }

  /**
   * Update Telegram message info after notification sent
   * @param messageId - Telegram message ID (number from API)
   */
  async updateTelegramMessage(requestId: string, chatId: string, messageId: number): Promise<void> {
    await this.moderationRequestRepository.updateTelegramMessage(requestId, chatId, messageId);
  }

  /**
   * Get moderation statistics
   */
  async getStatistics(): Promise<{
    total: number;
    pending: number;
    approved: number;
    declined: number;
  }> {
    return this.moderationRequestRepository.getStats();
  }
}
