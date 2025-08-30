# Bull

## Purpose and Responsibilities
The `bull` library provides a comprehensive job queue system for xRocket microservices, built on top of Redis and the NestJS Bull integration. It manages asynchronous task processing, background jobs, and provides robust job management with features like job retention, failure handling, and distributed processing across multiple service instances.

## Key Components

### BullModule
- **Global Queue System**: Provides queue infrastructure across all microservices
- **Redis Integration**: Uses existing Redis connections for queue backend
- **Queue Registration**: Factory methods for consistent queue configuration
- **Job Management**: Automatic job cleanup and retention policies

### Queue Configuration Features

#### Job Retention Policies
- **Completed Jobs**: Keeps completed jobs for 1 hour (up to 100 jobs)
- **Failed Jobs**: Retains failed jobs for 24 hours for debugging
- **Automatic Cleanup**: Prevents Redis memory bloat through automatic job removal

#### Lock Management
- **Lock Duration**: 5-minute default lock duration for job processing
- **Distributed Processing**: Ensures jobs are processed by only one worker at a time
- **Dead Letter**: Failed jobs with exceeded lock duration are marked as failed

### Redis Connection Management
- **Connection Reuse**: Leverages existing Redis connections from RedisModule
- **Cluster Support**: Full support for Redis cluster deployments
- **Connection Duplication**: Creates separate connections for queue operations

## Dependencies

### External Dependencies
- `@nestjs/common` - NestJS core functionality
- `@nestjs/bull` - NestJS integration for Bull queue system
- `ioredis` - Redis client with cluster support
- `bull` - Robust job queue library

### Internal Dependencies
- `@app/common/redis` - Redis connection management and configuration

## Integration Points

### Microservice Integration
Used across xRocket services for:
- **Blockchain Processing**: Transaction processing, block monitoring, wallet operations
- **Notification System**: Email, SMS, push notification queues
- **Financial Operations**: Payment processing, settlement, reconciliation
- **Analytics**: Data processing, report generation, metrics calculation
- **System Tasks**: Cleanup operations, maintenance tasks, data synchronization

### Queue Types
- **High Priority**: Payment processing, critical financial operations
- **Standard Priority**: User notifications, data processing
- **Low Priority**: Analytics, reporting, cleanup tasks

## Usage Patterns

### Queue Registration
```typescript
@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: BullQueue.PAYMENT_PROCESSING,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          }
        }
      },
      {
        name: BullQueue.NOTIFICATIONS,
        defaultJobOptions: {
          delay: 1000, // 1 second delay
          removeOnComplete: 50, // Keep only 50 completed jobs
        }
      }
    )
  ]
})
export class PaymentModule {}
```

### Job Producer
```typescript
@Injectable()
export class PaymentService {
  constructor(
    @InjectQueue(BullQueue.PAYMENT_PROCESSING)
    private paymentQueue: Queue
  ) {}

  async processPayment(paymentData: PaymentDto) {
    // Add job to queue
    await this.paymentQueue.add('process-payment', paymentData, {
      priority: 10, // High priority
      attempts: 5,
      backoff: 'exponential'
    });
  }

  async scheduleRecurringPayment(paymentData: PaymentDto, cronPattern: string) {
    // Schedule recurring job
    await this.paymentQueue.add('recurring-payment', paymentData, {
      repeat: { cron: cronPattern },
      removeOnComplete: true
    });
  }
}
```

### Job Consumer
```typescript
@Processor(BullQueue.PAYMENT_PROCESSING)
export class PaymentProcessor {
  private readonly logger = new Logger(PaymentProcessor.name);

  @Process('process-payment')
  async handlePayment(job: Job<PaymentDto>) {
    this.logger.log(`Processing payment job ${job.id}`);
    
    try {
      const result = await this.processPaymentLogic(job.data);
      
      // Update job progress
      await job.progress(100);
      
      return result;
    } catch (error) {
      this.logger.error(`Payment processing failed: ${error.message}`, error);
      throw error; // Will be retried based on job configuration
    }
  }

  @Process('recurring-payment')
  async handleRecurringPayment(job: Job<PaymentDto>) {
    // Handle recurring payment logic
    await this.processRecurringPayment(job.data);
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);
  }

  @OnQueueCompleted()
  onComplete(job: Job, result: any) {
    this.logger.log(`Job ${job.id} completed with result:`, result);
  }

  @OnQueueFailed()
  onError(job: Job, error: any) {
    this.logger.error(`Job ${job.id} failed:`, error);
  }
}
```

### Batch Job Processing
```typescript
async processBatchTransactions(transactions: TransactionDto[]) {
  const jobs = transactions.map((tx, index) => ({
    name: 'process-transaction',
    data: tx,
    opts: {
      priority: 5,
      delay: index * 100 // Stagger job execution
    }
  }));

  await this.transactionQueue.addBulk(jobs);
}
```

### Job Monitoring
```typescript
@Injectable()
export class QueueMonitoringService {
  constructor(
    @InjectQueue(BullQueue.PAYMENT_PROCESSING)
    private paymentQueue: Queue
  ) {}

  async getQueueStats() {
    const waiting = await this.paymentQueue.getWaiting();
    const active = await this.paymentQueue.getActive();
    const completed = await this.paymentQueue.getCompleted();
    const failed = await this.paymentQueue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length
    };
  }

  async retryFailedJobs() {
    const failedJobs = await this.paymentQueue.getFailed();
    
    for (const job of failedJobs) {
      await job.retry();
    }
  }
}
```

## Configuration

### Queue Options
```typescript
interface QueueConfiguration {
  name: string;
  defaultJobOptions?: {
    attempts?: number;           // Number of retry attempts
    backoff?: string | object;   // Backoff strategy for retries
    delay?: number;              // Initial delay before processing
    priority?: number;           // Job priority (higher = more priority)
    removeOnComplete?: number;   // Number of completed jobs to keep
    removeOnFail?: number;       // Number of failed jobs to keep
    repeat?: {                   // Recurring job configuration
      cron?: string;
      tz?: string;
    };
  };
  settings?: {
    lockDuration?: number;       // Job lock duration in milliseconds
    maxStalledCount?: number;    // Max stalled job count before failure
  };
}
```

### Default Configuration
```typescript
// Applied to all queues by default
defaultJobOptions: {
  removeOnComplete: {
    age: 60 * 60,    // Keep completed jobs for 1 hour
    count: 100,      // Keep up to 100 completed jobs
  },
  removeOnFail: {
    age: 24 * 60 * 60, // Keep failed jobs for 24 hours
  }
},
settings: {
  lockDuration: 5 * 60 * 60 * 1000, // 5 minutes lock duration
}
```

## Security Considerations
- **Job Data Validation**: Validate all job data before processing
- **Access Control**: Queue operations restricted to authorized services
- **Sensitive Data**: Avoid storing sensitive information in job data
- **Redis Security**: Inherit security from Redis configuration

## Performance Notes

### Scalability
- **Horizontal Scaling**: Multiple worker instances can process jobs concurrently
- **Redis Cluster**: Full support for Redis cluster for high availability
- **Connection Pooling**: Efficient connection management through ioredis
- **Job Prioritization**: High-priority jobs processed first

### Memory Management
- **Automatic Cleanup**: Configurable job retention prevents memory leaks
- **Connection Duplication**: Separate connections for different queue operations
- **Cluster Optimization**: Read operations distributed across Redis cluster nodes

## Development Notes

### Architecture Pattern
Implements **Distributed Job Queue** pattern:
1. **Producer-Consumer**: Services produce jobs, dedicated processors consume them
2. **At-Least-Once Delivery**: Jobs guaranteed to be processed at least once
3. **Failure Recovery**: Failed jobs can be retried with exponential backoff
4. **Horizontal Scaling**: Multiple workers can process jobs concurrently

### Queue Naming Convention
```typescript
enum BullQueue {
  PAYMENT_PROCESSING = 'payment-processing',
  BLOCKCHAIN_TRANSPORT = 'blockchains-transport',
  SYSTEM_PUSH = 'blockchains-system-push',
  NOTIFICATIONS = 'notifications',
  ANALYTICS = 'analytics-processing'
}
```

### Job Lifecycle
```
1. Job Created → 2. Job Queued → 3. Job Active → 4. Job Completed/Failed
                                      ↓
                                 5. Job Retried (if failed and attempts remaining)
```

### Connection Strategy
```typescript
// Creates appropriate connection based on Redis mode
createClient(type): Redis | Cluster {
  if (type === 'client') {
    return client; // Reuse existing connection
  }
  
  // Create duplicate connection with queue-specific settings
  return client.duplicate({
    enableReadyCheck: false,    // Disable ready checks for queues
    maxRetriesPerRequest: null  // No retry limit for queue operations
  });
}
```

### Best Practices
- **Job Idempotency**: Design jobs to be idempotent for safe retries
- **Error Handling**: Implement comprehensive error handling in processors
- **Progress Tracking**: Update job progress for long-running operations
- **Resource Cleanup**: Ensure proper resource cleanup in job processors
- **Monitoring**: Implement queue monitoring for operational visibility