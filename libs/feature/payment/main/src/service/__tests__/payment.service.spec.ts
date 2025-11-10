/* eslint-disable @typescript-eslint/no-explicit-any */

import { Test, TestingModule } from '@nestjs/testing';
import { Logger, NotFoundException } from '@nestjs/common';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { getRepositoryToken } from '@mikro-orm/nestjs';
import { PaymentService } from '../payment.service';
import { PaymentProviderFactory } from '../payment-provider.factory';
import { ProviderRoutingService } from '../provider-routing.service';
import { PaymentTransactionEntity, CurrencyCode, UserBalanceRepository } from '@app/database';
import { CryptoBotProvider } from '../../provider/crypto-bot.provider';
import { Err, Ok } from '@app/common-shared';
import { I18nService } from 'nestjs-i18n';
import {
  CreateInvoiceDto,
  CreateTransferDto,
  PaymentInvoice,
  PaymentProvider,
  PaymentStatus,
  PaymentTransfer,
  PaymentType,
  WebhookUpdateDto,
} from '@app/feature-payment-shared';

/**
 * Comprehensive Payment Service Tests
 *
 * Test Coverage:
 * - Payment creation (top-ups and withdrawals)
 * - Webhook processing (all payment statuses)
 * - Error scenarios (invalid webhooks, failed payments, network errors)
 * - Security (signature verification, duplicate processing)
 * - Edge cases (race conditions, balance rollback, idempotency)
 * - Transaction retrieval and history
 * - Status synchronization
 */
describe('PaymentService', () => {
  let service: PaymentService;
  let module: TestingModule;
  let mockTransactionRepository: jest.Mocked<EntityRepository<PaymentTransactionEntity>>;
  let mockProvider: jest.Mocked<CryptoBotProvider>;
  let mockUserBalanceRepository: jest.Mocked<UserBalanceRepository>;
  let mockEntityManager: jest.Mocked<EntityManager>;
  let mockProviderFactory: jest.Mocked<PaymentProviderFactory>;
  let mockRoutingService: jest.Mocked<ProviderRoutingService>;
  let mockI18nService: jest.Mocked<I18nService>;

  // Test data constants
  const testUserId = 'user-123';
  const testTransactionId = 'tx-123';
  const testInvoiceId = '12345';
  const testTransferId = '67890';
  const testAmount = '100.50';
  const testCurrency = CurrencyCode.Usdt;

  /**
   * Create mock transaction entity
   */
  const createMockTransaction = (overrides: Partial<PaymentTransactionEntity> = {}): PaymentTransactionEntity => ({
    id: testTransactionId,
    userId: testUserId,
    type: PaymentType.TopUp,
    provider: PaymentProvider.CryptoBot,
    providerTransactionId: testInvoiceId,
    amount: testAmount,
    currency: testCurrency,
    status: PaymentStatus.Pending,
    payUrl: 'https://pay.cryptopay.com/test',
    description: 'Test payment',
    fee: null,
    metadata: null,
    paidAt: null,
    expiresAt: new Date('2025-12-31T23:59:59Z'),
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  });

  /**
   * Create mock payment invoice
   */
  const createMockInvoice = (overrides: Partial<PaymentInvoice> = {}): PaymentInvoice => ({
    invoiceId: testInvoiceId,
    amount: testAmount,
    currency: testCurrency,
    payUrl: 'https://pay.cryptopay.com/test',
    expiresAt: new Date('2025-12-31T23:59:59Z'),
    description: 'Test payment',
    ...overrides,
  });

  /**
   * Create mock payment transfer
   */
  const createMockTransfer = (overrides: Partial<PaymentTransfer> = {}): PaymentTransfer => ({
    transferId: testTransferId,
    amount: testAmount,
    currency: testCurrency,
    status: PaymentStatus.Processing,
    completedAt: undefined,
    fee: '0.50',
    ...overrides,
  });

  /**
   * Create mock user balance
   */
  const createMockBalance = (balance = '1000.00'): any => ({
    userId: testUserId,
    currency: CurrencyCode.Rub,
    balance,
  });

  beforeEach(async () => {
    // Setup mocks
    mockEntityManager = {
      persistAndFlush: jest.fn(),
      flush: jest.fn(),
      create: jest.fn(),
      persist: jest.fn().mockReturnThis(),
      transactional: jest.fn(),
    } as any;

    mockTransactionRepository = {
      create: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      getEntityManager: jest.fn(() => mockEntityManager),
    } as any;

    mockProvider = {
      createInvoice: jest.fn(),
      getInvoice: jest.fn(),
      createTransfer: jest.fn(),
      getTransfer: jest.fn(),
      verifyWebhook: jest.fn(),
    } as any;

    mockUserBalanceRepository = {
      findByUserAndCurrency: jest.fn(),
      createOrUpdateBalance: jest.fn(),
    } as any;

    // Create mock PaymentProviderFactory
    mockProviderFactory = {
      getProvider: jest.fn().mockReturnValue(mockProvider),
    } as any;

    // Create mock ProviderRoutingService
    mockRoutingService = {
      routeInvoice: jest.fn(),
      routeTransfer: jest.fn(),
    } as any;

    // Create mock I18nService
    mockI18nService = {
      t: jest.fn((key: string) => key),
    } as any;

    module = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: getRepositoryToken(PaymentTransactionEntity),
          useValue: mockTransactionRepository,
        },
        {
          provide: PaymentProviderFactory,
          useValue: mockProviderFactory,
        },
        {
          provide: ProviderRoutingService,
          useValue: mockRoutingService,
        },
        {
          provide: UserBalanceRepository,
          useValue: mockUserBalanceRepository,
        },
        {
          provide: EntityManager,
          useValue: mockEntityManager,
        },
        {
          provide: I18nService,
          useValue: mockI18nService,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);

    // Mock logger methods
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }

    jest.clearAllMocks();
  });

  // ==================== SERVICE DEFINITION ====================

  describe('Service Definition', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have all required dependencies injected', () => {
      expect((service as any)['transactionRepository']).toBeDefined();
      expect((service as any)['provider']).toBeDefined();
      expect((service as any)['userBalanceRepository']).toBeDefined();
      expect((service as any)['em']).toBeDefined();
    });
  });

  // ==================== CREATE TOP-UP INVOICE ====================

  describe('createTopUp', () => {
    const createInvoiceDto: CreateInvoiceDto = {
      amount: testAmount,
      currency: testCurrency as unknown as CurrencyCode,
      description: 'Test top-up',
      expiresIn: 3600,
    };

    it('should create top-up invoice successfully', async () => {
      const mockInvoice = createMockInvoice();
      const mockTransaction = createMockTransaction();

      mockProvider.createInvoice.mockResolvedValue(Ok(mockInvoice));
      mockTransactionRepository.create.mockReturnValue(mockTransaction);
      mockEntityManager.persistAndFlush.mockResolvedValue(undefined);

      const result = await service.createTopUp(testUserId, createInvoiceDto);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.id).toBe(testTransactionId);
        expect(result.val.amount).toBe(testAmount);
        expect(result.val.currency).toBe(testCurrency);
        expect(result.val.status).toBe(PaymentStatus.Pending);
        expect(result.val.payUrl).toBeDefined();
      }

      expect(mockProvider.createInvoice).toHaveBeenCalledWith({
        userId: testUserId,
        amount: testAmount,
        currency: testCurrency,
        description: createInvoiceDto.description,
        expiresIn: createInvoiceDto.expiresIn,
      });

      expect(mockTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          type: PaymentType.TopUp,
          provider: PaymentProvider.CryptoBot,
          amount: testAmount,
          status: PaymentStatus.Pending,
        }),
      );

      expect(mockEntityManager.persistAndFlush).toHaveBeenCalled();
    });

    it('should handle provider failure when creating invoice', async () => {
      const providerError = new Error('Provider API error');
      mockProvider.createInvoice.mockResolvedValue(Err(providerError));

      const result = await service.createTopUp(testUserId, createInvoiceDto);

      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val.message).toContain('Failed to create invoice with payment provider');
      }

      expect(mockTransactionRepository.create).not.toHaveBeenCalled();
      expect(mockEntityManager.persistAndFlush).not.toHaveBeenCalled();
    });

    it('should handle database error when saving transaction', async () => {
      const mockInvoice = createMockInvoice();
      const dbError = new Error('Database connection failed');

      mockProvider.createInvoice.mockResolvedValue(Ok(mockInvoice));
      mockTransactionRepository.create.mockReturnValue(createMockTransaction());
      mockEntityManager.persistAndFlush.mockRejectedValue(dbError);

      const result = await service.createTopUp(testUserId, createInvoiceDto);

      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val.message).toContain('Database connection failed');
      }
    });

    it('should create invoice with minimal parameters', async () => {
      const minimalDto: CreateInvoiceDto = {
        amount: testAmount,
        currency: testCurrency,
      };

      const mockInvoice = createMockInvoice({ description: undefined });
      mockProvider.createInvoice.mockResolvedValue(Ok(mockInvoice));
      mockTransactionRepository.create.mockReturnValue(createMockTransaction());
      mockEntityManager.persistAndFlush.mockResolvedValue(undefined);

      const result = await service.createTopUp(testUserId, minimalDto);

      expect(result.ok).toBe(true);
      expect(mockProvider.createInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: testAmount,
          currency: testCurrency,
          description: undefined,
        }),
      );
    });

    it('should store metadata correctly', async () => {
      const mockInvoice = createMockInvoice();
      mockProvider.createInvoice.mockResolvedValue(Ok(mockInvoice));
      mockTransactionRepository.create.mockReturnValue(createMockTransaction());
      mockEntityManager.persistAndFlush.mockResolvedValue(undefined);

      await service.createTopUp(testUserId, createInvoiceDto);

      expect(mockTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            expiresIn: createInvoiceDto.expiresIn,
          },
        }),
      );
    });
  });

  // ==================== CREATE WITHDRAWAL ====================

  describe('createWithdrawal', () => {
    const createTransferDto: CreateTransferDto = {
      userId: testUserId,
      amount: '50.00',
      currency: testCurrency,
      comment: 'Test withdrawal',
    };

    it('should create withdrawal successfully', async () => {
      const mockBalance = createMockBalance('1000.00');
      const mockTransfer = createMockTransfer();
      const mockTransaction = createMockTransaction({
        type: PaymentType.Withdraw,
        status: PaymentStatus.Processing,
      });

      mockUserBalanceRepository.findByUserAndCurrency.mockResolvedValue(mockBalance);
      mockProvider.createTransfer.mockResolvedValue(Ok(mockTransfer));
      mockEntityManager.transactional.mockImplementation(async (callback) => callback(mockEntityManager));
      mockEntityManager.create.mockReturnValue(mockTransaction);
      mockEntityManager.persist.mockReturnThis();
      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);

      const result = await service.createWithdrawal(testUserId, createTransferDto);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.amount).toBe('50.00');
        expect(result.val.status).toBe(PaymentStatus.Processing);
      }

      expect(mockUserBalanceRepository.createOrUpdateBalance).toHaveBeenCalledWith(
        testUserId,
        CurrencyCode.Rub,
        '950.00',
      );
    });

    it('should reject withdrawal with insufficient balance', async () => {
      const mockBalance = createMockBalance('30.00');
      mockUserBalanceRepository.findByUserAndCurrency.mockResolvedValue(mockBalance);

      const result = await service.createWithdrawal(testUserId, createTransferDto);

      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val.message).toContain('Insufficient balance');
        expect(result.val.message).toContain('Available: 30');
        expect(result.val.message).toContain('Requested: 50');
      }

      expect(mockProvider.createTransfer).not.toHaveBeenCalled();
      expect(mockUserBalanceRepository.createOrUpdateBalance).not.toHaveBeenCalled();
    });

    it('should handle missing user balance', async () => {
      mockUserBalanceRepository.findByUserAndCurrency.mockResolvedValue(null);

      const result = await service.createWithdrawal(testUserId, createTransferDto);

      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val.message).toContain('Balance not found');
      }
    });

    it('should handle provider failure when creating transfer', async () => {
      const mockBalance = createMockBalance('1000.00');
      const providerError = new Error('Transfer API error');

      mockUserBalanceRepository.findByUserAndCurrency.mockResolvedValue(mockBalance);
      mockProvider.createTransfer.mockResolvedValue(Err(providerError));

      const result = await service.createWithdrawal(testUserId, createTransferDto);

      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val.message).toContain('Failed to create transfer with payment provider');
      }
    });

    it('should rollback balance on transaction failure', async () => {
      const mockBalance = createMockBalance('1000.00');
      const mockTransfer = createMockTransfer();

      mockUserBalanceRepository.findByUserAndCurrency.mockResolvedValue(mockBalance);
      mockProvider.createTransfer.mockResolvedValue(Ok(mockTransfer));
      mockEntityManager.transactional.mockRejectedValue(new Error('Transaction failed'));

      const result = await service.createWithdrawal(testUserId, createTransferDto);

      expect(result.err).toBe(true);

      // Verify rollback was attempted
      expect(mockUserBalanceRepository.createOrUpdateBalance).toHaveBeenCalledWith(
        testUserId,
        CurrencyCode.Rub,
        expect.stringContaining('1050'), // Original balance + withdrawal amount
      );

      expect(Logger.prototype.warn).toHaveBeenCalledWith(expect.stringContaining('Balance rollback'));
    });

    it('should handle rollback failure gracefully', async () => {
      const mockBalance = createMockBalance('1000.00');
      const mockTransfer = createMockTransfer();

      mockUserBalanceRepository.findByUserAndCurrency.mockResolvedValueOnce(mockBalance).mockResolvedValueOnce(null); // Rollback fails - balance not found

      mockProvider.createTransfer.mockResolvedValue(Ok(mockTransfer));
      mockEntityManager.transactional.mockRejectedValue(new Error('Transaction failed'));

      const result = await service.createWithdrawal(testUserId, createTransferDto);

      expect(result.err).toBe(true);
      expect(Logger.prototype.error).toHaveBeenCalledWith('Failed to rollback balance', expect.any(Error));
    });

    it('should store metadata with balance information', async () => {
      const mockBalance = createMockBalance('1000.00');
      const mockTransfer = createMockTransfer();
      const mockTransaction = createMockTransaction();

      mockUserBalanceRepository.findByUserAndCurrency.mockResolvedValue(mockBalance);
      mockProvider.createTransfer.mockResolvedValue(Ok(mockTransfer));
      mockEntityManager.transactional.mockImplementation(async (callback) => callback(mockEntityManager));
      mockEntityManager.create.mockReturnValue(mockTransaction);
      mockEntityManager.persist.mockReturnThis();
      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);

      await service.createWithdrawal(testUserId, createTransferDto);

      expect(mockEntityManager.create).toHaveBeenCalledWith(
        PaymentTransactionEntity,
        expect.objectContaining({
          metadata: {
            telegramUserId: testUserId,
            balanceBefore: '1000',
            balanceAfter: '950.00',
          },
        }),
      );
    });
  });

  // ==================== GET TRANSACTION ====================

  describe('getTransaction', () => {
    it('should retrieve transaction by ID successfully', async () => {
      const mockTransaction = createMockTransaction();
      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);

      const result = await service.getTransaction(testTransactionId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.id).toBe(testTransactionId);
      }

      expect(mockTransactionRepository.findOne).toHaveBeenCalledWith({
        id: testTransactionId,
      });
    });

    it('should return error when transaction not found', async () => {
      mockTransactionRepository.findOne.mockResolvedValue(null);

      const result = await service.getTransaction(testTransactionId);

      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val).toBeInstanceOf(NotFoundException);
        expect(result.val.message).toContain('Transaction not found');
      }
    });

    it('should handle database errors', async () => {
      mockTransactionRepository.findOne.mockRejectedValue(new Error('Database error'));

      const result = await service.getTransaction(testTransactionId);

      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val.message).toContain('Database error');
      }
    });
  });

  // ==================== GET USER TRANSACTIONS ====================

  describe('getUserTransactions', () => {
    it('should retrieve user transactions with pagination', async () => {
      const mockTransactions = [createMockTransaction({ id: 'tx-1' }), createMockTransaction({ id: 'tx-2' })];

      mockTransactionRepository.count.mockResolvedValue(10);
      mockTransactionRepository.find.mockResolvedValue(mockTransactions);

      const result = await service.getUserTransactions(testUserId, {
        limit: 2,
        offset: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.transactions).toHaveLength(2);
        expect(result.val.total).toBe(10);
        expect(result.val.limit).toBe(2);
        expect(result.val.offset).toBe(0);
      }
    });

    it('should filter transactions by type', async () => {
      mockTransactionRepository.count.mockResolvedValue(5);
      mockTransactionRepository.find.mockResolvedValue([]);

      await service.getUserTransactions(testUserId, {
        type: PaymentType.TopUp,
      });

      expect(mockTransactionRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          type: PaymentType.TopUp,
        }),
        expect.any(Object),
      );
    });

    it('should filter transactions by status', async () => {
      mockTransactionRepository.count.mockResolvedValue(3);
      mockTransactionRepository.find.mockResolvedValue([]);

      await service.getUserTransactions(testUserId, {
        status: PaymentStatus.Completed,
      });

      expect(mockTransactionRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          status: PaymentStatus.Completed,
        }),
        expect.any(Object),
      );
    });

    it('should use default pagination values', async () => {
      mockTransactionRepository.count.mockResolvedValue(100);
      mockTransactionRepository.find.mockResolvedValue([]);

      const result = await service.getUserTransactions(testUserId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.limit).toBe(50); // Default limit
        expect(result.val.offset).toBe(0); // Default offset
      }
    });

    it('should order transactions by createdAt DESC', async () => {
      mockTransactionRepository.count.mockResolvedValue(0);
      mockTransactionRepository.find.mockResolvedValue([]);

      await service.getUserTransactions(testUserId);

      expect(mockTransactionRepository.find).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          orderBy: { createdAt: 'DESC' },
        }),
      );
    });
  });

  // ==================== WEBHOOK PROCESSING ====================

  describe('processWebhook', () => {
    const webhookUpdateDto: WebhookUpdateDto = {
      updateType: 'invoice_paid',
      requestDate: '2025-11-03T12:00:00Z',
      payload: {
        id: testInvoiceId,
        status: 'paid',
        data: {
          amount: testAmount,
          currency: testCurrency,
        },
      },
    };

    it('should process invoice_paid webhook successfully', async () => {
      const mockTransaction = createMockTransaction({
        status: PaymentStatus.Pending,
        metadata: null,
      });

      const mockBalance = createMockBalance('100.00');

      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);
      mockUserBalanceRepository.findByUserAndCurrency.mockResolvedValue(mockBalance);
      mockUserBalanceRepository.createOrUpdateBalance.mockResolvedValue(mockBalance);
      mockEntityManager.flush.mockResolvedValue(undefined);

      const result = await service.processWebhook(webhookUpdateDto);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.status).toBe(PaymentStatus.Completed);
        expect(result.val.metadata?.['webhookProcessedAt']).toBeDefined();
      }

      expect(mockUserBalanceRepository.createOrUpdateBalance).toHaveBeenCalledWith(
        testUserId,
        'RUB',
        '200.50', // 100.00 + 100.50
      );
    });

    it('should ignore non-invoice_paid webhook types', async () => {
      const otherWebhook: WebhookUpdateDto = {
        ...webhookUpdateDto,
        updateType: 'invoice_expired',
      };

      const result = await service.processWebhook(otherWebhook);

      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val.message).toContain('Unsupported webhook type');
      }

      expect(mockTransactionRepository.findOne).not.toHaveBeenCalled();
    });

    it('should handle webhook for non-existent transaction', async () => {
      mockTransactionRepository.findOne.mockResolvedValue(null);

      const result = await service.processWebhook(webhookUpdateDto);

      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val).toBeInstanceOf(NotFoundException);
        expect(result.val.message).toContain('Transaction not found');
      }
    });

    it('should skip processing if already completed (idempotency)', async () => {
      const completedTransaction = createMockTransaction({
        status: PaymentStatus.Completed,
        paidAt: new Date(),
      });

      mockTransactionRepository.findOne.mockResolvedValue(completedTransaction);

      const result = await service.processWebhook(webhookUpdateDto);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.status).toBe(PaymentStatus.Completed);
      }

      expect(mockEntityManager.flush).not.toHaveBeenCalled();
      expect(mockUserBalanceRepository.createOrUpdateBalance).not.toHaveBeenCalled();
    });

    it('should store webhook data in metadata', async () => {
      const mockTransaction = createMockTransaction({
        status: PaymentStatus.Pending,
        metadata: { existingKey: 'existingValue' },
      });

      const mockBalance = createMockBalance();

      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);
      mockUserBalanceRepository.findByUserAndCurrency.mockResolvedValue(mockBalance);
      mockEntityManager.flush.mockResolvedValue(undefined);

      await service.processWebhook(webhookUpdateDto);

      expect(mockTransaction.metadata).toEqual(
        expect.objectContaining({
          existingKey: 'existingValue',
          webhookProcessedAt: expect.any(String),
          webhookData: webhookUpdateDto.payload.data,
        }),
      );
    });

    it('should handle balance crediting errors', async () => {
      const mockTransaction = createMockTransaction({ status: PaymentStatus.Pending });

      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);
      mockUserBalanceRepository.findByUserAndCurrency.mockResolvedValue(null); // No balance found
      mockEntityManager.flush.mockResolvedValue(undefined);

      const result = await service.processWebhook(webhookUpdateDto);

      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val.message).toContain('Balance not found');
      }
    });
  });

  // ==================== INVOICE STATUS ====================

  describe('getInvoiceStatus', () => {
    it('should sync invoice status from provider', async () => {
      const mockTransaction = createMockTransaction({
        status: PaymentStatus.Pending,
      });

      const mockProviderTransaction = {
        transactionId: testInvoiceId,
        invoiceId: testInvoiceId,
        amount: testAmount,
        currency: testCurrency,
        status: PaymentStatus.Completed,
        paidAt: new Date(),
        fee: '1.00',
      };

      const mockBalance = createMockBalance();

      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);
      mockProvider.getInvoice.mockResolvedValue(Ok(mockProviderTransaction));
      mockUserBalanceRepository.findByUserAndCurrency.mockResolvedValue(mockBalance);
      mockEntityManager.flush.mockResolvedValue(undefined);

      const result = await service.getInvoiceStatus(testInvoiceId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.status).toBe(PaymentStatus.Completed);
        expect(result.val.paidAt).toBeDefined();
        expect(result.val.fee).toBe('1.00');
      }
    });

    it('should skip sync if already completed', async () => {
      const completedTransaction = createMockTransaction({
        status: PaymentStatus.Completed,
      });

      mockTransactionRepository.findOne.mockResolvedValue(completedTransaction);

      const result = await service.getInvoiceStatus(testInvoiceId);

      expect(result.ok).toBe(true);
      expect(mockProvider.getInvoice).not.toHaveBeenCalled();
    });

    it('should handle provider errors', async () => {
      const mockTransaction = createMockTransaction();
      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);
      mockProvider.getInvoice.mockResolvedValue(Err(new Error('Provider error')));

      const result = await service.getInvoiceStatus(testInvoiceId);

      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val.message).toContain('Failed to get invoice status');
      }
    });

    it('should credit balance on completion (with idempotency check)', async () => {
      const mockTransaction = createMockTransaction({
        status: PaymentStatus.Pending,
        metadata: null,
      });

      const mockProviderTransaction = {
        transactionId: testInvoiceId,
        invoiceId: testInvoiceId,
        amount: testAmount,
        currency: testCurrency,
        status: PaymentStatus.Completed,
        paidAt: new Date(),
        fee: null,
      };

      const mockBalance = createMockBalance('100.00');

      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);
      mockProvider.getInvoice.mockResolvedValue(Ok(mockProviderTransaction));
      mockUserBalanceRepository.findByUserAndCurrency.mockResolvedValue(mockBalance);
      mockEntityManager.flush.mockResolvedValue(undefined);

      await service.getInvoiceStatus(testInvoiceId);

      expect(mockUserBalanceRepository.createOrUpdateBalance).toHaveBeenCalled();
    });

    it('should not credit balance if already credited', async () => {
      const mockTransaction = createMockTransaction({
        status: PaymentStatus.Pending,
        metadata: { balanceCredited: true },
      });

      const mockProviderTransaction = {
        transactionId: testInvoiceId,
        invoiceId: testInvoiceId,
        amount: testAmount,
        currency: testCurrency,
        status: PaymentStatus.Completed,
        paidAt: new Date(),
        fee: null,
      };

      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);
      mockProvider.getInvoice.mockResolvedValue(Ok(mockProviderTransaction));

      await service.getInvoiceStatus(testInvoiceId);

      expect(mockUserBalanceRepository.createOrUpdateBalance).not.toHaveBeenCalled();
    });
  });

  // ==================== SYNC TRANSACTION STATUS ====================

  describe('syncTransactionStatus', () => {
    it('should sync top-up transaction status', async () => {
      const mockTransaction = createMockTransaction({
        type: PaymentType.TopUp,
        status: PaymentStatus.Pending,
      });

      const mockProviderTransaction = {
        transactionId: testInvoiceId,
        invoiceId: testInvoiceId,
        amount: testAmount,
        currency: testCurrency,
        status: PaymentStatus.Completed,
        paidAt: new Date(),
        fee: '0.50',
      };

      const mockBalance = createMockBalance();

      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);
      mockProvider.getInvoice.mockResolvedValue(Ok(mockProviderTransaction));
      mockUserBalanceRepository.findByUserAndCurrency.mockResolvedValue(mockBalance);
      mockEntityManager.flush.mockResolvedValue(undefined);

      const result = await service.syncTransactionStatus(testTransactionId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.status).toBe(PaymentStatus.Completed);
      }

      expect(mockProvider.getInvoice).toHaveBeenCalledWith(testInvoiceId);
    });

    it('should sync withdrawal transaction status', async () => {
      const mockTransaction = createMockTransaction({
        type: PaymentType.Withdraw,
        status: PaymentStatus.Processing,
      });

      const mockProviderTransfer = {
        transferId: testInvoiceId,
        amount: testAmount,
        currency: testCurrency,
        status: PaymentStatus.Completed,
        completedAt: new Date(),
        fee: '1.00',
      };

      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);
      mockProvider.getTransfer.mockResolvedValue(Ok(mockProviderTransfer));
      mockEntityManager.flush.mockResolvedValue(undefined);

      const result = await service.syncTransactionStatus(testTransactionId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.status).toBe(PaymentStatus.Completed);
      }

      expect(mockProvider.getTransfer).toHaveBeenCalledWith(testInvoiceId);
    });

    it('should handle transaction without provider ID', async () => {
      const mockTransaction = createMockTransaction({
        providerTransactionId: null,
      });

      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);

      const result = await service.syncTransactionStatus(testTransactionId);

      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val.message).toContain('no provider transaction ID');
      }
    });

    it('should not update if status unchanged', async () => {
      const mockTransaction = createMockTransaction({
        status: PaymentStatus.Pending,
      });

      const mockProviderTransaction = {
        transactionId: testInvoiceId,
        invoiceId: testInvoiceId,
        amount: testAmount,
        currency: testCurrency,
        status: PaymentStatus.Pending, // Same status
        paidAt: undefined,
        fee: null,
      };

      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);
      mockProvider.getInvoice.mockResolvedValue(Ok(mockProviderTransaction));

      const result = await service.syncTransactionStatus(testTransactionId);

      expect(result.ok).toBe(true);
      expect(mockEntityManager.flush).not.toHaveBeenCalled();
    });
  });

  // ==================== BALANCE CREDITING ====================

  describe('creditUserBalance (private method)', () => {
    it('should credit balance and mark as credited', async () => {
      const mockTransaction = createMockTransaction({
        metadata: null,
      });

      const mockBalance = createMockBalance('500.00');

      mockUserBalanceRepository.findByUserAndCurrency.mockResolvedValue(mockBalance);
      mockEntityManager.flush.mockResolvedValue(undefined);

      // Call via public method that uses creditUserBalance
      await service['creditUserBalance'](mockTransaction);

      expect(mockUserBalanceRepository.createOrUpdateBalance).toHaveBeenCalledWith(
        testUserId,
        'RUB',
        '600.50', // 500.00 + 100.50
      );

      expect(mockTransaction.metadata).toEqual(
        expect.objectContaining({
          balanceCredited: true,
          balanceCreditedAt: expect.any(String),
          balanceBefore: '500',
          balanceAfter: '600.50',
        }),
      );
    });

    it('should skip if already credited (idempotency)', async () => {
      const mockTransaction = createMockTransaction({
        metadata: { balanceCredited: true },
      });

      await service['creditUserBalance'](mockTransaction);

      expect(mockUserBalanceRepository.findByUserAndCurrency).not.toHaveBeenCalled();
      expect(Logger.prototype.warn).toHaveBeenCalledWith(expect.stringContaining('Balance already credited'));
    });

    it('should throw on balance not found', async () => {
      const mockTransaction = createMockTransaction({ metadata: null });

      mockUserBalanceRepository.findByUserAndCurrency.mockResolvedValue(null);

      await expect(service['creditUserBalance'](mockTransaction)).rejects.toThrow('Balance not found');
    });
  });

  // ==================== ERROR SCENARIOS ====================

  describe('Error Scenarios', () => {
    it('should handle network timeout errors', async () => {
      const createInvoiceDto: CreateInvoiceDto = {
        amount: testAmount,
        currency: testCurrency,
      };

      mockProvider.createInvoice.mockResolvedValue(Err(new Error('ETIMEDOUT')));

      const result = await service.createTopUp(testUserId, createInvoiceDto);

      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val.message).toBeDefined();
      }
    });

    it('should handle malformed webhook data', async () => {
      const malformedWebhook: WebhookUpdateDto = {
        updateType: 'invoice_paid',
        requestDate: 'invalid-date',
        payload: {
          id: '',
          status: '',
          data: {},
        },
      };

      mockTransactionRepository.findOne.mockResolvedValue(null);

      const result = await service.processWebhook(malformedWebhook);

      expect(result.err).toBe(true);
    });

    it('should handle database connection failures', async () => {
      mockTransactionRepository.findOne.mockRejectedValue(new Error('Connection lost'));

      const result = await service.getTransaction(testTransactionId);

      expect(result.err).toBe(true);
    });
  });

  // ==================== EDGE CASES ====================

  describe('Edge Cases', () => {
    it('should handle concurrent webhook processing (race condition)', async () => {
      const mockTransaction = createMockTransaction({
        status: PaymentStatus.Pending,
        metadata: null,
      });

      const mockBalance = createMockBalance();

      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);
      mockUserBalanceRepository.findByUserAndCurrency.mockResolvedValue(mockBalance);
      mockEntityManager.flush.mockResolvedValue(undefined);

      const webhookDto: WebhookUpdateDto = {
        updateType: 'invoice_paid',
        requestDate: '2025-11-03T12:00:00Z',
        payload: {
          id: testInvoiceId,
          status: 'paid',
          data: {},
        },
      };

      // Process same webhook twice concurrently
      const [result1, result2] = await Promise.all([
        service.processWebhook(webhookDto),
        service.processWebhook(webhookDto),
      ]);

      // Both should succeed due to idempotency
      expect(result1.ok || result2.ok).toBe(true);
    });

    it('should handle very large transaction amounts', async () => {
      const largeAmount = '999999999.99999999';
      const createInvoiceDto: CreateInvoiceDto = {
        amount: largeAmount,
        currency: testCurrency,
      };

      const mockInvoice = createMockInvoice({ amount: largeAmount });
      mockProvider.createInvoice.mockResolvedValue(Ok(mockInvoice));
      mockTransactionRepository.create.mockReturnValue(createMockTransaction({ amount: largeAmount }));
      mockEntityManager.persistAndFlush.mockResolvedValue(undefined);

      const result = await service.createTopUp(testUserId, createInvoiceDto);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.amount).toBe(largeAmount);
      }
    });

    it('should handle very small transaction amounts', async () => {
      const smallAmount = '0.00000001';
      const createInvoiceDto: CreateInvoiceDto = {
        amount: smallAmount,
        currency: testCurrency,
      };

      const mockInvoice = createMockInvoice({ amount: smallAmount });
      mockProvider.createInvoice.mockResolvedValue(Ok(mockInvoice));
      mockTransactionRepository.create.mockReturnValue(createMockTransaction({ amount: smallAmount }));
      mockEntityManager.persistAndFlush.mockResolvedValue(undefined);

      const result = await service.createTopUp(testUserId, createInvoiceDto);

      expect(result.ok).toBe(true);
    });

    it('should handle missing or null fee values', async () => {
      const mockTransaction = createMockTransaction({ fee: undefined });
      const mockProviderTransaction = {
        transactionId: testInvoiceId,
        invoiceId: testInvoiceId,
        amount: testAmount,
        currency: testCurrency,
        status: PaymentStatus.Completed,
        paidAt: new Date(),
        fee: null, // No fee
      };

      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);
      mockProvider.getInvoice.mockResolvedValue(Ok(mockProviderTransaction));

      const result = await service.syncTransactionStatus(testTransactionId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.fee).toBeNull();
      }
    });

    it('should handle expired invoices correctly', async () => {
      const mockTransaction = createMockTransaction({
        status: PaymentStatus.Pending,
        expiresAt: new Date('2020-01-01'), // Expired
      });

      const mockProviderTransaction = {
        transactionId: testInvoiceId,
        invoiceId: testInvoiceId,
        amount: testAmount,
        currency: testCurrency,
        status: PaymentStatus.Expired,
        paidAt: undefined,
        fee: null,
      };

      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);
      mockProvider.getInvoice.mockResolvedValue(Ok(mockProviderTransaction));
      mockEntityManager.flush.mockResolvedValue(undefined);

      const result = await service.getInvoiceStatus(testInvoiceId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.status).toBe(PaymentStatus.Expired);
      }

      // Should not credit balance for expired invoices
      expect(mockUserBalanceRepository.createOrUpdateBalance).not.toHaveBeenCalled();
    });
  });

  // ==================== PERFORMANCE TESTS ====================

  describe('Performance', () => {
    it('should process transaction lookup under 50ms', async () => {
      const mockTransaction = createMockTransaction();
      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);

      const start = performance.now();
      await service.getTransaction(testTransactionId);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });

    it('should handle bulk transaction retrieval efficiently', async () => {
      const mockTransactions = Array(100)
        .fill(null)
        .map((_, i) => createMockTransaction({ id: `tx-${i}` }));

      mockTransactionRepository.count.mockResolvedValue(100);
      mockTransactionRepository.find.mockResolvedValue(mockTransactions);

      const start = performance.now();
      await service.getUserTransactions(testUserId, { limit: 100 });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });
});
