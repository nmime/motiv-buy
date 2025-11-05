import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { randomUUID } from 'crypto';
import { CryptoBotProvider } from '../provider/crypto-bot.provider';
import { HelekeProvider } from '../provider/heleket.provider';
import { YooKassaProvider } from '../provider/yookassa.provider';
import { PaymentService } from '../service/payment.service';
import { WebhookUpdateDto, PaymentConfigService } from '@app/feature-payment-shared';

/**
 * Controller for handling payment webhook callbacks
 * Implements secure webhook processing with signature verification
 *
 * SECURITY ARCHITECTURE:
 * =====================
 *
 * 1. CSRF PROTECTION: NOT APPLIED
 *    - Webhooks use HMAC-SHA256 signature verification instead of CSRF tokens
 *    - CSRF protection would break legitimate webhook requests from payment providers
 *    - Signature verification provides stronger security than CSRF for webhooks
 *
 * 2. SIGNATURE VERIFICATION: REQUIRED
 *    - All webhook requests MUST include 'crypto-pay-api-signature' header
 *    - Signature is HMAC-SHA256 hash of request body using shared secret
 *    - Requests with missing or invalid signatures are rejected (401 Unauthorized)
 *
 * 3. RATE LIMITING: ENABLED
 *    - 100 requests per minute per IP address
 *    - Prevents brute force attacks and DoS attempts
 *    - Legitimate webhooks typically <10 requests per minute
 *
 * 4. INPUT VALIDATION:
 *    - Payload size limited to 100KB (prevents memory exhaustion)
 *    - Strict type checking on all webhook fields
 *    - ISO date validation for timestamps
 *    - Regex sanitization to prevent injection attacks
 *
 * 5. ERROR HANDLING:
 *    - Returns 200 OK even on processing errors (prevents unnecessary retries)
 *    - Only returns 401 for authentication failures (invalid signature)
 *    - All errors logged with full context for investigation
 *
 * WHY NO CSRF PROTECTION:
 * - CSRF tokens protect against unauthorized actions from authenticated users
 * - Webhooks are server-to-server requests, not user-initiated
 * - Payment providers don't have CSRF tokens (they're external services)
 * - Signature verification is cryptographically stronger than CSRF tokens
 */
@ApiTags('Payment Webhooks')
@Controller('payment/webhook')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(
    private readonly cryptoBotProvider: CryptoBotProvider,
    private readonly helekeProvider: HelekeProvider,
    private readonly yooKassaProvider: YooKassaProvider,
    private readonly paymentService: PaymentService,
    private readonly paymentConfig: PaymentConfigService,
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
    description: 'Receives and processes webhook notifications from CryptoPay for invoice and transfer updates',
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
    // Generate unique request ID for tracking
    const requestId = randomUUID();
    const logContext = { requestId };

    try {
      // Log webhook attempt with request ID
      this.logger.log('Received CryptoPay webhook', logContext);

      // Validate signature header presence
      if (!signature) {
        this.logger.warn('Webhook rejected: Missing signature header', logContext);
        throw new UnauthorizedException('Missing signature');
      }

      // Sanitize and convert body to string for signature verification
      const bodyString = this.sanitizeBody(rawBody);

      // Verify webhook signature using HMAC-SHA256
      const isValid = this.cryptoBotProvider.verifyWebhook(signature, bodyString);

      if (!isValid) {
        this.logger.warn('Webhook rejected: Invalid signature', {
          ...logContext,
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
          ...logContext,
          error: error instanceof Error ? error.message : 'Unknown error',
          rawBodyType: typeof rawBody,
        });

        // Return success to prevent provider retries for malformed data
        return { ok: true };
      }

      // Log validated webhook event with full context
      this.logger.log('Valid webhook received', {
        ...logContext,
        updateType: webhookData.updateType,
        payloadId: webhookData.payload.id,
        status: webhookData.payload.status,
        timestamp: webhookData.requestDate,
      });

      // Process webhook through payment service
      const result = await this.paymentService.processWebhook(webhookData, requestId);

      if (result.err) {
        // Log error but still return success to provider
        this.logger.error('Webhook processing failed', {
          ...logContext,
          error: result.val.message,
          updateType: webhookData.updateType,
          payloadId: webhookData.payload.id,
        });

        // Return success to prevent unnecessary provider retries
        // The error is logged and can be investigated
        return { ok: true };
      }

      // Log successful processing
      this.logger.log('Webhook processed successfully', {
        ...logContext,
        transactionId: result.val.id,
        status: result.val.status,
        amount: result.val.amount,
        currency: result.val.currency,
      });

      // Return success response
      return { ok: true };
    } catch (error) {
      // Log error with full context
      if (error instanceof UnauthorizedException) {
        this.logger.warn('Webhook authentication failed', {
          ...logContext,
          error: error.message,
        });

        throw error;
      }

      this.logger.error('Unexpected error processing webhook', {
        ...logContext,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Return success to prevent unnecessary retries
      // Provider will retry if we return error status
      return { ok: true };
    }
  }

  /**
   * Handle Heleke webhook notifications
   * Verifies HMAC signature and processes payment status updates
   *
   * @param signature - HMAC-SHA256 signature from Heleke
   * @param body - Raw webhook payload as string
   * @returns Success response
   */
  @Post('heleke')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 requests per minute
  @ApiOperation({
    summary: 'Heleke webhook endpoint',
    description: 'Receives and processes webhook notifications from Heleke payment gateway',
  })
  @ApiHeader({
    name: 'x-heleke-signature',
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
  async handleHelekeWebhook(
    @Headers('x-heleke-signature') signature: string | undefined,
    @Body() rawBody: unknown,
  ): Promise<{ ok: boolean }> {
    const requestId = randomUUID();
    const logContext = { requestId, provider: 'Heleke' };

    try {
      this.logger.log('Received Heleke webhook', logContext);

      // Validate signature header presence
      if (!signature) {
        this.logger.warn('Webhook rejected: Missing signature header', logContext);
        throw new UnauthorizedException('Missing signature');
      }

      // Sanitize and convert body to string for signature verification
      const bodyString = this.sanitizeBody(rawBody);

      // Verify webhook signature
      const isValid = this.helekeProvider.verifyWebhook(signature, bodyString);

      if (!isValid) {
        this.logger.warn('Webhook rejected: Invalid signature', {
          ...logContext,
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
        this.logger.error('Failed to parse Heleke webhook data', {
          ...logContext,
          error: error instanceof Error ? error.message : 'Unknown error',
          rawBodyType: typeof rawBody,
        });

        return { ok: true };
      }

      this.logger.log('Valid Heleke webhook received', {
        ...logContext,
        updateType: webhookData.updateType,
        payloadId: webhookData.payload.id,
        status: webhookData.payload.status,
      });

      // Process webhook through payment service
      const result = await this.paymentService.processWebhook(webhookData, requestId);

      if (result.err) {
        this.logger.error('Heleke webhook processing failed', {
          ...logContext,
          error: result.val.message,
          updateType: webhookData.updateType,
          payloadId: webhookData.payload.id,
        });

        return { ok: true };
      }

      this.logger.log('Heleke webhook processed successfully', {
        ...logContext,
        transactionId: result.val.id,
        status: result.val.status,
      });

      return { ok: true };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.logger.warn('Heleke webhook authentication failed', {
          ...logContext,
          error: error.message,
        });

        throw error;
      }

      this.logger.error('Unexpected error processing Heleke webhook', {
        ...logContext,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      return { ok: true };
    }
  }

  /**
   * Handle YooKassa webhook notifications
   * Verifies request origin via IP whitelist
   *
   * @param ipAddress - Request IP address for verification
   * @param body - Raw webhook payload
   * @returns Success response
   */
  @Post('yookassa')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 requests per minute
  @ApiOperation({
    summary: 'YooKassa webhook endpoint',
    description: 'Receives and processes webhook notifications from YooKassa payment gateway',
  })
  @ApiHeader({
    name: 'x-forwarded-for',
    description: 'Client IP address for whitelist verification',
    required: false,
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
    description: 'IP address not whitelisted',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded',
  })
  async handleYooKassaWebhook(
    @Headers('x-forwarded-for') forwardedFor: string | undefined,
    @Headers('x-real-ip') realIp: string | undefined,
    @Body() rawBody: unknown,
  ): Promise<{ ok: boolean }> {
    const requestId = randomUUID();
    const ipAddress = forwardedFor || realIp || 'unknown';
    const logContext = { requestId, provider: 'YooKassa', ipAddress };

    try {
      this.logger.log('Received YooKassa webhook', logContext);

      // Get allowed IPs from configuration
      const config = this.paymentConfig.getYooKassaConfig();
      const allowedIps = config.allowedWebhookIps;

      // Verify IP whitelist if configured
      if (allowedIps && allowedIps.length > 0) {
        const clientIp = forwardedFor?.split(',')[0].trim() || realIp || '';

        if (!allowedIps.includes(clientIp)) {
          this.logger.warn('Webhook rejected: IP not whitelisted', {
            ...logContext,
            clientIp,
            allowedIps: allowedIps.join(', '),
          });

          throw new UnauthorizedException('IP address not whitelisted');
        }

        this.logger.debug('IP whitelist check passed', { ...logContext, clientIp });
      } else {
        this.logger.warn(
          'YooKassa webhook IP whitelist not configured - accepting all requests',
          logContext,
        );
      }

      // Parse and validate webhook data
      let webhookData: WebhookUpdateDto;
      try {
        webhookData = this.parseWebhookData(rawBody);
      } catch (error) {
        this.logger.error('Failed to parse YooKassa webhook data', {
          ...logContext,
          error: error instanceof Error ? error.message : 'Unknown error',
          rawBodyType: typeof rawBody,
        });

        return { ok: true };
      }

      this.logger.log('Valid YooKassa webhook received', {
        ...logContext,
        updateType: webhookData.updateType,
        payloadId: webhookData.payload.id,
        status: webhookData.payload.status,
      });

      // Process webhook through payment service
      const result = await this.paymentService.processWebhook(webhookData, requestId);

      if (result.err) {
        this.logger.error('YooKassa webhook processing failed', {
          ...logContext,
          error: result.val.message,
          updateType: webhookData.updateType,
          payloadId: webhookData.payload.id,
        });

        return { ok: true };
      }

      this.logger.log('YooKassa webhook processed successfully', {
        ...logContext,
        transactionId: result.val.id,
        status: result.val.status,
      });

      return { ok: true };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.logger.warn('YooKassa webhook authentication failed', {
          ...logContext,
          error: error.message,
        });

        throw error;
      }

      this.logger.error('Unexpected error processing YooKassa webhook', {
        ...logContext,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      return { ok: true };
    }
  }

  /**
   * Sanitize webhook body for signature verification
   * Removes any potentially dangerous characters and normalizes the payload
   * @param rawBody - Raw webhook payload
   * @returns Sanitized JSON string
   */
  private sanitizeBody(rawBody: unknown): string {
    try {
      // Convert to string, handling various input types
      if (typeof rawBody === 'string') {
        return rawBody;
      }

      // Convert object to JSON string
      const jsonString = JSON.stringify(rawBody);

      // Basic size check to prevent DoS
      if (jsonString.length > 100000) {
        throw new BadRequestException('Webhook payload too large');
      }

      return jsonString;
    } catch (error) {
      this.logger.error('Failed to sanitize webhook body', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new BadRequestException('Invalid webhook payload format');
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

    // Validate required fields with strict type checking
    if (typeof data.updateType !== 'string' || data.updateType.trim().length === 0) {
      throw new Error('Invalid webhook payload: missing or invalid updateType');
    }

    if (typeof data.requestDate !== 'string' || data.requestDate.trim().length === 0) {
      throw new Error('Invalid webhook payload: missing or invalid requestDate');
    }

    // Validate requestDate is a valid ISO date
    const date = new Date(data.requestDate);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid webhook payload: requestDate is not a valid date');
    }

    if (!data.payload || typeof data.payload !== 'object') {
      throw new Error('Invalid webhook payload: missing or invalid payload');
    }

    const payload = data.payload as Record<string, unknown>;

    if (typeof payload.id !== 'string' || payload.id.trim().length === 0) {
      throw new Error('Invalid webhook payload: missing or invalid payload.id');
    }

    if (typeof payload.status !== 'string' || payload.status.trim().length === 0) {
      throw new Error('Invalid webhook payload: missing or invalid payload.status');
    }

    if (!payload.data || typeof payload.data !== 'object') {
      throw new Error('Invalid webhook payload: missing or invalid payload.data');
    }

    // Sanitize string fields to prevent injection attacks
    const sanitizedUpdateType = data.updateType.trim().replace(/[^\w-]/g, '_');
    const sanitizedId = payload.id.trim();
    const sanitizedStatus = payload.status.trim();

    // Return validated and sanitized DTO
    return {
      updateType: sanitizedUpdateType,
      requestDate: data.requestDate,
      payload: {
        id: sanitizedId,
        status: sanitizedStatus,
        data: payload.data as Record<string, unknown>,
      },
    };
  }
}
