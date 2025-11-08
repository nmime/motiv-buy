# @app/common-nats

NATS JetStream integration for Motiv-Buy monorepo.

Provides comprehensive NATS functionality for:

- **Job Queues** - Background tasks, delayed jobs
- **Event Streaming** - Pub/Sub messaging
- **Message Broker** - Reliable request-reply delivery

## Installation

The package is already installed. Make sure NATS server is running:

```bash
# Development with Docker
docker-compose up nats

# Or standalone
docker run -p 4222:4222 -p 8222:8222 nats:latest -js
```

## Setup

### 1. Add to your module

```typescript
import { Module } from '@nestjs/common';
import { NatsModule } from '@app/common-nats';

@Module({
  imports: [
    NatsModule.forRoot({
      config: {
        servers: ['nats://localhost:4222'],
        name: 'my-service',
      },
    }),
  ],
})
export class AppModule {}
```

### 2. Using ConfigService

```typescript
NatsModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    servers: [configService.get('NATS_URL')],
    name: configService.get('APP_NAME'),
    user: configService.get('NATS_USER'),
    pass: configService.get('NATS_PASSWORD'),
  }),
  inject: [ConfigService],
});
```

## Usage Examples

### Job Queue

```typescript
import {Injectable} from '@nestjs/common';
import {NatsQueueService, Subject} from '@app/common-nats';

@Injectable()
export class EmailService {
  constructor(private readonly queueService: NatsQueueService) {
  }

  async sendEmail(to: string, subject: string, body: string) {
    await this.queueService.addJob(
      Subject.JOB_EMAIL,
      {
        to,
        subject,
        body,
      },
      {
        delay: 5000, // Send after 5 seconds
        maxRetries: 3,
        priority: 8,
      },
    );
  }

  async processEmailJobs() {
    await this.queueService.processJobs(
      Subject.JOB_EMAIL,
      async (data) => {
        console.log('Sending email:', data);
        // Send email logic here
      },
      {
        consumerName: 'email-worker',
        maxConcurrent: 5,
      },
    );
  }
}
```

### Event Streaming

```typescript
import {Injectable} from '@nestjs/common';
import {NatsEventService, Subject} from '@app/common-nats';

@Injectable()
export class UserService {
  constructor(private readonly eventService: NatsEventService) {
  }

  async createUser(userData: any) {
    // Create user logic...

    // Publish event
    await this.eventService.publish(Subject.EVENT_USER_CREATED, {
      userId: user.id,
      email: user.email,
      createdAt: new Date(),
    });
  }

  async subscribeToUserEvents() {
    await this.eventService.subscribe(Subject.EVENT_USER_CREATED, async (data) => {
      console.log('User created:', data);
      // Handle event
    });
  }
}
```

### Message Broker (Request-Reply)

```typescript
import {Injectable} from '@nestjs/common';
import {NatsMessageService} from '@app/common-nats';

@Injectable()
export class PaymentService {
  constructor(private readonly messageService: NatsMessageService) {
  }

  async processPayment(amount: number) {
    const result = await this.messageService.send('payment.process', {amount}, {timeout: 10000});

    return result;
  }

  async setupPaymentHandler() {
    await this.messageService.handleMessages('payment.process', async (data) => {
      // Process payment logic
      return {success: true, transactionId: '123'};
    });
  }
}
```

## Environment Variables

```env
# NATS Connection
NATS_URL=nats://localhost:4222
NATS_CLIENT_NAME=motiv-buy-app

# Optional: Authentication
NATS_USER=admin
NATS_PASSWORD=secret
# OR
NATS_TOKEN=your-token
```

## Docker Setup

See `docker-compose-dev.yml` and `docker-compose.yml` for NATS configuration.

## Documentation

For more information, see:

- [NATS.io Official Docs](https://docs.nats.io/)
- [JetStream Guide](https://docs.nats.io/nats-concepts/jetstream)
- [nats.js Documentation](https://github.com/nats-io/nats.js)
