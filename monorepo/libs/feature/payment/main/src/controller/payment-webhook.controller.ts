import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CryptoBotProvider } from '../provider/crypto-bot.provider';
import { WebhookUpdateDto } from '@app/feature-payment-shared';

/**
 * Controller for handling payment webhook callbacks
 * Implements secure webhook processing with signature verification
 */
@ApiTags('Payment Webhooks')
@Controller('payment/webhook')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(
    private readonly cryptoBotProvider: CryptoBotProvider,
    // TODO: Inject PaymentService when it's created
    // private readonly paymentService: PaymentService,
  ) {}

  /**
   * Handle CryptoPay webhook notifications
   * Verifies signature and processes payment status updates
   *
   * @param signature - HMAC-SHA256 signature from CryptoPay
   * @param body - Raw webhook payload as string
   * @returns Success response
   */
  @Post('crypto-bot')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 requests per minute
  @ApiOperation({
    summary: 'CryptoPay webhook endpoint',
    description:
      'Receives and processes webhook notifications from CryptoPay for invoice and transfer updates',
  })
  @ApiHeader({
    name: 'crypto-pay-api-signature',
    description: 'HMAC-SHA256 signature for webhook verification',
    required: true,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Webhook processed successfully',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid webhook signature',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded',
  })
  async handleCryptoBotWebhook(
    @Headers('crypto-pay-api-signature') signature: string | undefined,
    @Body() rawBody: unknown,
  ): Promise<{ ok: boolean }> {
    try {
      // Log webhook attempt
      this.logger.log('Received CryptoPay webhook');

      // Validate signature header presence
      if (!signature) {
        this.logger.warn('Webhook rejected: Missing signature header');
        throw new UnauthorizedException('Missing signature');
      }

      // Convert body to string for signature verification
      const bodyString = JSON.stringify(rawBody);

      // Verify webhook signature
      const isValid = this.cryptoBotProvider.verifyWebhook(signature, bodyString);

      if (!isValid) {
        this.logger.warn('Webhook rejected: Invalid signature', {
          signatureLength: signature.length,
          bodyLength: bodyString.length,
        });
        throw new UnauthorizedException('Invalid signature');
      }

      // Parse and validate webhook data
      let webhookData: WebhookUpdateDto;
      try {
        webhookData = this.parseWebhookData(rawBody);
      } catch (error) {
        this.logger.error('Failed to parse webhook data', {
          error: error instanceof Error ? error.message : 'Unknown error',
          rawBody: typeof rawBody,
        });
        // Return success to prevent provider retries for malformed data
        return { ok: true };
      }

      // Log validated webhook event
      this.logger.log('Valid webhook received', {
        updateType: webhookData.updateType,
        payloadId: webhookData.payload.id,
        status: webhookData.payload.status,
      });

      // Process webhook through payment service
      // TODO: Uncomment when PaymentService is implemented
      // await this.paymentService.processWebhook(webhookData);

      // Temporary logging until PaymentService is ready
      this.logger.log('Webhook data ready for processing', {
        updateType: webhookData.updateType,
        id: webhookData.payload.id,
        status: webhookData.payload.status,
        timestamp: webhookData.requestDate,
      });

      // Return success response
      return { ok: true };
    } catch (error) {
      // Log error but return generic response
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error('Error processing webhook', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Return success to prevent unnecessary retries
      // Provider will retry if we return error status
      return { ok: true };
    }
  }

  /**
   * Parse and validate webhook data
   * @param rawBody - Raw webhook payload
   * @returns Validated webhook DTO
   * @throws Error if validation fails
   */
  private parseWebhookData(rawBody: unknown): WebhookUpdateDto {
    if (!rawBody || typeof rawBody !== 'object') {
      throw new Error('Invalid webhook payload: not an object');
    }

    const data = rawBody as Record<string, unknown>;

    // Validate required fields
    if (typeof data.updateType !== 'string') {
      throw new Error('Invalid webhook payload: missing or invalid updateType');
    }

    if (typeof data.requestDate !== 'string') {
      throw new Error('Invalid webhook payload: missing or invalid requestDate');
    }

    if (!data.payload || typeof data.payload !== 'object') {
      throw new Error('Invalid webhook payload: missing or invalid payload');
    }

    const payload = data.payload as Record<string, unknown>;

    if (typeof payload.id !== 'string') {
      throw new Error('Invalid webhook payload: missing or invalid payload.id');
    }

    if (typeof payload.status !== 'string') {
      throw new Error('Invalid webhook payload: missing or invalid payload.status');
    }

    if (!payload.data || typeof payload.data !== 'object') {
      throw new Error('Invalid webhook payload: missing or invalid payload.data');
    }

    // Return validated DTO
    return {
      updateType: data.updateType,
      requestDate: data.requestDate,
      payload: {
        id: payload.id,
        status: payload.status,
        data: payload.data as Record<string, unknown>,
      },
    };
  }
}
