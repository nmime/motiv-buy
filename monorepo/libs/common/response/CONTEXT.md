# Response

## Purpose and Responsibilities
The `response` library provides standardized response transformation and formatting for xRocket's API ecosystem. It ensures consistent response structures, handles error formatting, manages WebSocket responses, and provides decorators for automatic response transformation across all HTTP and WebSocket endpoints.

## Key Components

### ResponseTransformer
- **Standard Format**: Transforms responses to consistent `{ data, error }` format
- **Success Handling**: Formats successful responses with proper data structure
- **Error Handling**: Standardizes error responses with consistent error format
- **Null Safety**: Handles null/undefined data appropriately

### ProblemResponseTransformer
- **RFC 7807 Compliance**: Implements Problem Details for HTTP APIs standard
- **Error Standardization**: Converts exceptions to standardized problem format
- **Status Code Mapping**: Maps internal errors to appropriate HTTP status codes
- **Context Preservation**: Maintains error context and details

### WebSocketResponseTransformer
- **WebSocket Format**: Specialized response format for WebSocket communications
- **Event Handling**: Manages WebSocket event-based responses
- **Real-time Updates**: Formats real-time data updates for WebSocket clients
- **Error Broadcasting**: Handles error broadcasting over WebSocket connections

### UseTransformer Decorator
- **Automatic Transformation**: Decorator for automatic response transformation
- **Flexible Configuration**: Configurable transformation strategies
- **Method-Level Control**: Fine-grained control over response transformation
- **Interceptor Integration**: Seamless integration with NestJS interceptors

## Dependencies

### External Dependencies
- `@nestjs/common` - NestJS core functionality
- `rxjs` - Reactive programming for interceptors

### Internal Dependencies
- None - Base response handling library

## Integration Points

### API Controllers
Used across all HTTP controllers for:
- **REST API Responses**: Standardized JSON responses
- **Error Handling**: Consistent error response format
- **Data Validation**: Response data validation and transformation
- **Content Negotiation**: Format responses based on Accept headers

### WebSocket Gateways
- **Real-time Updates**: Live data streaming responses
- **Event Broadcasting**: Multi-client event distribution
- **Error Notifications**: Real-time error notifications

### Microservice Communication
- **Inter-Service Responses**: Standardized service-to-service responses
- **RPC Call Formatting**: Consistent RPC response structures

## Usage Patterns

### HTTP Response Transformation
```typescript
import { UseTransformer, ResponseTransformer } from '@app/common-response';

@Controller('users')
@UseTransformer(ResponseTransformer)
export class UserController {
  @Get(':id')
  async getUser(@Param('id') id: string) {
    const user = await this.userService.findById(id);
    // Automatically transformed to: { data: user, error: null }
    return user;
  }

  @Post()
  async createUser(@Body() createUserDto: CreateUserDto) {
    try {
      const user = await this.userService.create(createUserDto);
      // Success: { data: user, error: null }
      return user;
    } catch (error) {
      // Error: { data: null, error: { message: "...", code: "..." } }
      throw error;
    }
  }
}
```

### Problem Details Response
```typescript
import { ProblemResponseTransformer } from '@app/common-response';

@Controller('payments')
@UseTransformer(ProblemResponseTransformer)
export class PaymentController {
  @Post('process')
  async processPayment(@Body() paymentDto: PaymentDto) {
    // Errors automatically converted to RFC 7807 format:
    // {
    //   type: "/problems/insufficient-funds",
    //   title: "Insufficient Funds",
    //   status: 400,
    //   detail: "Account balance is insufficient for this transaction",
    //   instance: "/payments/process"
    // }
    return await this.paymentService.process(paymentDto);
  }
}
```

### WebSocket Response Handling
```typescript
import { WebSocketResponseTransformer } from '@app/common-response';

@WebSocketGateway()
@UseTransformer(WebSocketResponseTransformer)
export class ExchangeGateway {
  @SubscribeMessage('orderbook_update')
  handleOrderbookUpdate(client: Socket, data: any) {
    // Transformed for WebSocket: { event: 'orderbook_update', data: ..., error: null }
    return this.exchangeService.getOrderbook(data.symbol);
  }

  @SubscribeMessage('place_order')
  async handlePlaceOrder(client: Socket, orderData: PlaceOrderDto) {
    try {
      const order = await this.exchangeService.placeOrder(orderData);
      // Success WebSocket response
      return order;
    } catch (error) {
      // Error WebSocket response with proper formatting
      throw error;
    }
  }
}
```

### Custom Response Transformation
```typescript
import { ResponseTransformer } from '@app/common-response';

@Injectable()
export class CustomResponseTransformer extends ResponseTransformer {
  transform(data: any, context: ExecutionContext) {
    const baseResponse = super.transform(data, context);
    
    // Add custom metadata
    return {
      ...baseResponse,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0',
        requestId: context.getRequest().headers['x-request-id']
      }
    };
  }
}

@Controller('api/v1')
@UseTransformer(CustomResponseTransformer)
export class ApiController {
  // All responses include custom metadata
}
```

## Configuration

### Response Format Configuration
```typescript
interface StandardResponse<T> {
  data: T | null;
  error: ErrorResponse | null;
}

interface ErrorResponse {
  message: string;
  code?: string;
  details?: any;
}

interface ProblemResponse {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}
```

### WebSocket Response Format
```typescript
interface WebSocketResponse<T> {
  event: string;
  data: T | null;
  error: ErrorResponse | null;
  timestamp: string;
}
```

## Security Considerations

### Data Sanitization
- **Output Encoding**: Automatic encoding of response data
- **Sensitive Data**: Prevents sensitive data leakage in error responses
- **Error Details**: Sanitizes error details in production

### Information Disclosure
- **Stack Traces**: Removes stack traces from production error responses
- **Internal Details**: Filters internal system information
- **User Context**: Ensures user-specific data isolation

## Performance Notes

### Response Caching
- **Transformer Caching**: Cached transformer instances for performance
- **Serialization**: Efficient JSON serialization
- **Memory Management**: Proper cleanup of response objects

### Interceptor Efficiency
- **Minimal Overhead**: Lightweight transformation logic
- **Stream Processing**: Efficient handling of large response data
- **Async Processing**: Non-blocking response transformation

## Development Notes

### Architecture Pattern
Implements **Response Facade** pattern:
1. **Unified Interface**: Single interface for all response formats
2. **Transformation Strategy**: Pluggable transformation strategies
3. **Cross-Cutting Concerns**: Handles responses across all endpoints

### Response Standards
```typescript
// Success Response
{
  data: { userId: 123, name: "John Doe" },
  error: null
}

// Error Response
{
  data: null,
  error: {
    message: "User not found",
    code: "USER_NOT_FOUND"
  }
}

// Problem Details Response (RFC 7807)
{
  type: "/problems/user-not-found",
  title: "User Not Found",
  status: 404,
  detail: "The requested user does not exist",
  instance: "/users/123"
}
```

### Best Practices
- **Consistent Format**: Always use standardized response format
- **Error Handling**: Implement proper error transformation
- **Validation**: Validate response data before transformation
- **Documentation**: Document response formats in API specifications
