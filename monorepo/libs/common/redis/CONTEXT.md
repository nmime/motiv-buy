# Redis

## Purpose and Responsibilities
The `redis` library provides a comprehensive Redis integration for the xRocket platform, supporting multiple Redis deployment modes (standalone, cluster, sentinel), caching services, rate limiting, and distributed locking. It offers high availability through flexible connection strategies and provides specialized services for common Redis use cases.

## Key Components

### RedisModule
- **Global Module**: Provides Redis connections across the entire application
- **Multi-Mode Support**: Supports Redis Cluster, Sentinel, and standalone modes
- **Connection Management**: Manages both singleton and transient Redis connections
- **Service Integration**: Includes cache, rate limiting, and health check services

### Connection Strategies

#### Redis Cluster Mode
- **High Availability**: Multi-node Redis cluster support
- **Read Scaling**: Scale reads across all cluster nodes
- **Automatic Failover**: Built-in failover and node discovery
- **Configuration**: Multiple host endpoints with automatic node detection

#### Redis Sentinel Mode
- **Master-Slave Setup**: Sentinel-managed Redis instances
- **Automatic Failover**: Sentinel handles master failover
- **Service Discovery**: Automatic master discovery through sentinels
- **High Availability**: Monitors and manages Redis instances

#### Standalone Mode
- **Single Instance**: Traditional single Redis instance
- **Simple Configuration**: Single host and port configuration
- **Development**: Ideal for development and simple deployments

### Specialized Services

#### RedisCacheService
- **Caching Layer**: High-level caching operations
- **TTL Management**: Time-to-live configuration for cache entries
- **Serialization**: Automatic JSON serialization/deserialization
- **Cache Patterns**: Common caching patterns implementation

#### RedisRateLimitService
- **Rate Limiting**: Token bucket and sliding window rate limiting
- **API Protection**: Protect APIs from abuse and overuse
- **User-Based Limiting**: Per-user rate limiting capabilities
- **Flexible Windows**: Support for various time windows

#### Redlock Integration
- **Distributed Locking**: Distributed mutual exclusion locks
- **Deadlock Prevention**: Configurable lock timeouts
- **Simple Mutex**: Configured as simple mutex by default (no retries)
- **Multi-Instance**: Works across Redis cluster nodes

#### RedisHealthIndicator
- **Health Monitoring**: Redis connection health checks
- **Terminus Integration**: Integrates with NestJS Terminus health checks
- **Connection Status**: Monitors Redis connectivity and responsiveness

## Dependencies

### External Dependencies
- `@nestjs/common` - NestJS core functionality
- `@nestjs/terminus` - Health check framework
- `ioredis` - Redis client with cluster and sentinel support
- `redlock` - Distributed locking implementation

### Internal Dependencies
- `RedisConfigService` - Redis configuration management
- `RedisConfigModule` - Configuration module setup

## Integration Points

### Application-Wide Integration
Used throughout the platform for:
- **Session Storage**: User session management and storage
- **Caching Layer**: Application data caching and performance optimization
- **Rate Limiting**: API rate limiting and abuse prevention
- **Queue Backend**: Bull queue backend for job processing
- **Distributed Locks**: Cross-service synchronization and mutual exclusion

### Service Integration
- **Bull Queues**: Redis as backend for job queues
- **Session Management**: Redis-based session storage
- **Cache-Aside Pattern**: Application-level caching layer
- **Pub/Sub**: Redis pub/sub for real-time events

## Usage Patterns

### Basic Redis Operations
```typescript
@Injectable()
export class UserService {
  constructor(
    @Inject(RedisInjectToken)
    private readonly redis: IORedis | Cluster
  ) {}

  async cacheUser(userId: string, userData: any) {
    await this.redis.setex(
      `user:${userId}`, 
      3600, // 1 hour TTL
      JSON.stringify(userData)
    );
  }

  async getCachedUser(userId: string) {
    const cached = await this.redis.get(`user:${userId}`);
    return cached ? JSON.parse(cached) : null;
  }
}
```

### Caching Service Usage
```typescript
@Injectable()
export class ProductService {
  constructor(
    private readonly cacheService: RedisCacheService
  ) {}

  async getProduct(productId: string) {
    // Try cache first
    const cached = await this.cacheService.get(`product:${productId}`);
    if (cached) return cached;

    // Fetch from database
    const product = await this.productRepository.findById(productId);
    
    // Cache for 30 minutes
    await this.cacheService.set(`product:${productId}`, product, 1800);
    
    return product;
  }
}
```

### Rate Limiting
```typescript
@Injectable()
export class ApiController {
  constructor(
    private readonly rateLimitService: RedisRateLimitService
  ) {}

  @Post('api/endpoint')
  async handleRequest(@Req() request: Request) {
    const userId = request.user.id;
    
    // Check rate limit (100 requests per hour)
    const allowed = await this.rateLimitService.checkLimit(
      `api:${userId}`, 
      100, 
      3600
    );
    
    if (!allowed) {
      throw new RateLimitExceededException({
        title: 'Rate Limit Exceeded',
        detail: 'Too many requests, please try again later'
      });
    }
    
    return this.processRequest(request);
  }
}
```

### Distributed Locking
```typescript
@Injectable()
export class PaymentService {
  constructor(
    private readonly redlock: Redlock
  ) {}

  async processPayment(userId: string, amount: number) {
    const lockKey = `payment:${userId}`;
    const lock = await this.redlock.acquire([lockKey], 5000); // 5 second lock

    try {
      // Critical section - only one payment per user at a time
      const balance = await this.getBalance(userId);
      if (balance >= amount) {
        await this.deductBalance(userId, amount);
        return await this.createPayment(userId, amount);
      } else {
        throw new InsufficientFundsException();
      }
    } finally {
      await lock.release();
    }
  }
}
```

### Health Check Integration
```typescript
@Controller('health')
export class HealthController extends BaseHealthController {
  constructor(
    private readonly redisHealth: RedisHealthIndicator
  ) {
    super();
  }

  @Get('/readiness')
  async readiness() {
    return this.healthService.check([
      () => this.redisHealth.isHealthy('redis')
    ]);
  }
}
```

## Configuration

### Environment Configuration
```typescript
// Redis configuration options
interface RedisConfig {
  mode: 'cluster' | 'sentinel' | 'standalone';
  hosts: Array<{ host: string; port: number }>;
  password?: string;
  db?: number;
  sentinelGroupIdentifier?: string; // For sentinel mode
}
```

### Cluster Configuration
```typescript
RedisModule.forRoot({
  mode: RedisMode.Cluster,
  hosts: [
    { host: 'redis-node1.example.com', port: 6379 },
    { host: 'redis-node2.example.com', port: 6379 },
    { host: 'redis-node3.example.com', port: 6379 }
  ],
  password: process.env.REDIS_PASSWORD
});
```

### Sentinel Configuration
```typescript
RedisModule.forRoot({
  mode: RedisMode.Sentinel,
  hosts: [
    { host: 'sentinel1.example.com', port: 26379 },
    { host: 'sentinel2.example.com', port: 26379 }
  ],
  sentinelGroupIdentifier: 'mymaster',
  password: process.env.REDIS_PASSWORD,
  db: 0
});
```

## Security Considerations
- **Password Protection**: Redis password authentication support
- **Network Security**: Secure connections to Redis instances
- **Access Control**: Redis ACL integration capabilities
- **Data Encryption**: Support for Redis TLS connections

## Performance Notes

### Connection Optimization
- **Connection Pooling**: Efficient connection reuse through ioredis
- **Pipeline Support**: Batch operations for improved performance
- **Cluster Scaling**: Read operations distributed across cluster nodes
- **Auto-Reconnection**: Automatic reconnection on connection failures

### Caching Performance
- **Memory Efficiency**: Optimal serialization strategies
- **TTL Management**: Automatic expiration prevents memory leaks
- **Hit Rate Optimization**: Cache patterns for maximum efficiency

## Development Notes

### Architecture Pattern
Implements **Multi-Mode Redis Adapter** pattern:
1. **Connection Abstraction**: Unified interface regardless of deployment mode
2. **Service Specialization**: Dedicated services for common Redis patterns
3. **Health Integration**: Built-in health monitoring and reporting
4. **Global Availability**: Redis connections available throughout the application

### Connection Factory Pattern
```typescript
const redisFactory = ({ config }: RedisConfigService) => {
  switch (config.mode) {
    case RedisMode.Cluster:
      return new Cluster(config.hosts, { /* cluster options */ });
    case RedisMode.Sentinel:
      return new IORedis({ /* sentinel options */ });
    default:
      return new IORedis({ /* standalone options */ });
  }
};
```

### Injection Tokens
- **RedisInjectToken**: Singleton Redis connection for general use
- **RedisInjectTransientToken**: Transient connections for specialized use cases
- **Redlock**: Distributed locking service

### Service Patterns
- **Cache-Aside**: Application manages cache consistency
- **Write-Through**: Automatic cache updates on data changes
- **Rate Limiting**: Token bucket and sliding window algorithms
- **Distributed Locking**: Redlock algorithm for distributed mutual exclusion

### Redlock Configuration
```typescript
new Redlock([redis], {
  driftFactor: 0.01,    // Clock drift compensation
  retryCount: 0,        // No retries for simple mutex behavior
  retryDelay: 200,      // Retry delay in milliseconds
  retryJitter: 200      // Random jitter for retry attempts
});
```