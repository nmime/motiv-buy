# Health

## Purpose and Responsibilities
The `health` library provides comprehensive health check functionality for xRocket microservices, implementing standard health check endpoints for monitoring, orchestration, and operational visibility. It provides a base health controller and shutdown service that can be extended by individual microservices to include service-specific health indicators.

## Key Components

### BaseHealthController
- **Standard Endpoints**: Implements `/health`, `/health/liveness`, `/health/readiness`, `/health/business`, `/health/external`
- **Kubernetes Integration**: Provides endpoints compatible with Kubernetes liveness and readiness probes
- **Extensible Design**: Abstract base class that services can extend with custom health checks
- **Swagger Documentation**: Automatic API documentation for health endpoints

### Health Check Types

#### Liveness Check (`/health/liveness`)
- **Purpose**: Indicates if the service is running and hasn't deadlocked
- **Usage**: Kubernetes liveness probes to restart unhealthy pods
- **Implementation**: Always returns healthy (basic service availability)

#### Readiness Check (`/health/readiness`)
- **Purpose**: Indicates if the service is ready to handle requests
- **Usage**: Kubernetes readiness probes to route traffic
- **Implementation**: Runs service-specific health indicators (database, Redis, external APIs)

#### Business Check (`/health/business`)
- **Purpose**: Validates core business functionality
- **Usage**: Business-specific health monitoring
- **Implementation**: Can be overridden with business logic validation

#### External Check (`/health/external`)
- **Purpose**: Validates external service dependencies
- **Usage**: Monitor third-party service availability
- **Implementation**: Can be overridden with external service checks

#### Overall Health (`/health`)
- **Purpose**: Aggregated health status for the service
- **Usage**: General service health monitoring
- **Implementation**: Combines readiness check results into overall status

### ShutdownService
- **Graceful Shutdown**: Handles application shutdown procedures
- **Resource Cleanup**: Ensures proper cleanup of resources during shutdown
- **Integration**: Works with NestJS application lifecycle

## Dependencies

### External Dependencies
- `@nestjs/common` - NestJS core functionality
- `@nestjs/terminus` - Health check framework
- `@nestjs/swagger` - API documentation
- `@nestjs/core` - Discovery module for dynamic health indicators

### Internal Dependencies
- `@app/common/rabbit` - RabbitMQ health indicators
- Health indicator services from other modules (Redis, databases, etc.)

## Integration Points

### Microservice Integration
Each microservice extends `BaseHealthController`:
- **Custom Health Checks**: Add service-specific health indicators
- **Database Health**: Monitor database connectivity and performance
- **External Services**: Check third-party API availability
- **Queue Health**: Monitor message queue status

### Orchestration Integration
- **Kubernetes**: Liveness and readiness probe endpoints
- **Docker**: Health check commands in containers
- **Load Balancers**: Health check endpoints for traffic routing
- **Monitoring**: Integration with Prometheus, DataDog, etc.

## Usage Patterns

### Basic Health Controller Extension
```typescript
@Controller('health')
export class ServiceHealthController extends BaseHealthController {
  constructor(
    private readonly databaseHealth: TypeOrmHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
    private readonly rabbitHealth: RabbitMQHealthIndicator
  ) {
    super();
  }

  @Get('/readiness')
  async readiness(): Promise<HealthCheckResult> {
    return this.healthService.check([
      () => this.databaseHealth.pingCheck('database'),
      () => this.redisHealth.isHealthy('redis'),
      () => this.rabbitHealth.isHealthy('rabbitmq')
    ]);
  }
}
```

### Custom Business Health Checks
```typescript
@Controller('health')
export class PaymentServiceHealthController extends BaseHealthController {
  constructor(
    private readonly paymentProcessor: PaymentProcessorService,
    private readonly walletService: WalletService
  ) {
    super();
  }

  @Get('/business')
  async business(): Promise<HealthCheckResult> {
    return this.healthService.check([
      () => this.checkPaymentProcessing(),
      () => this.checkWalletConnectivity()
    ]);
  }

  private async checkPaymentProcessing(): Promise<HealthIndicatorResult> {
    const isHealthy = await this.paymentProcessor.isOperational();
    return {
      'payment-processing': {
        status: isHealthy ? 'up' : 'down',
        message: isHealthy ? 'Payment processing operational' : 'Payment processing down'
      }
    };
  }
}
```

### External Service Health Checks
```typescript
@Get('/external')
async external(): Promise<HealthCheckResult> {
  return this.healthService.check([
    () => this.checkBlockchainRPC(),
    () => this.checkExchangeAPI(),
    () => this.checkNotificationService()
  ]);
}

private async checkBlockchainRPC(): Promise<HealthIndicatorResult> {
  try {
    await this.blockchainClient.getBlockHeight();
    return {
      'blockchain-rpc': {
        status: 'up',
        latency: Date.now() - startTime
      }
    };
  } catch (error) {
    return {
      'blockchain-rpc': {
        status: 'down',
        error: error.message
      }
    };
  }
}
```

### Shutdown Service Integration
```typescript
@Injectable()
export class AppService implements OnApplicationShutdown {
  constructor(
    private readonly shutdownService: ShutdownService
  ) {}

  async onApplicationShutdown(signal?: string) {
    this.logger.log(`Received shutdown signal: ${signal}`);
    await this.shutdownService.gracefulShutdown();
  }
}
```

## Configuration

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
      - name: app
        livenessProbe:
          httpGet:
            path: /health/liveness
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/readiness
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Docker Health Check
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

## Security Considerations
- **Public Endpoints**: Health endpoints may be publicly accessible
- **Information Disclosure**: Avoid exposing sensitive system information
- **Rate Limiting**: Consider rate limiting health check endpoints
- **Authentication**: Health endpoints typically bypass authentication

## Performance Notes
- **Lightweight Checks**: Health checks should be fast and lightweight
- **Caching**: Health indicators can cache results for frequently called endpoints
- **Timeout Handling**: Implement timeouts for external service health checks
- **Resource Usage**: Health checks should not consume significant resources

## Development Notes

### Architecture Pattern
Implements **Health Check Aggregation** pattern:
1. **Standardized Endpoints**: Consistent health check API across all services
2. **Extensible Design**: Services can add custom health indicators
3. **Aggregated Results**: Multiple health indicators combined into single response
4. **Integration Ready**: Compatible with orchestration and monitoring systems

### Health Check Response Format
```typescript
interface HealthCheckResult {
  status: 'ok' | 'error' | 'shutting_down';
  info?: Record<string, HealthIndicatorResult>;
  error?: Record<string, HealthIndicatorResult>;
  details?: Record<string, HealthIndicatorResult>;
}

interface HealthIndicatorResult {
  status: 'up' | 'down';
  message?: string;
  [key: string]: any;
}
```

### Swagger Integration
```typescript
@Health({
  summary: 'Health check',
  public: true,        // Publicly accessible
  swagger: true        // Include in Swagger documentation
})
```

### Extension Patterns
Services typically extend the base controller to add:
- **Database Connectivity**: TypeORM, MongoDB health indicators
- **Cache Health**: Redis, Memcached connectivity
- **Queue Health**: RabbitMQ, Bull queue status
- **External APIs**: Third-party service availability
- **Business Logic**: Domain-specific health validations

### Health Check Categories
- **Infrastructure**: Database, cache, message queues
- **External Dependencies**: APIs, blockchain nodes, payment processors
- **Business Logic**: Core functionality validation
- **Performance**: Response time, throughput metrics
- **Security**: Authentication service status, certificate validation