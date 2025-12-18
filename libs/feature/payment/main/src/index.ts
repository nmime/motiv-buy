/**
 * Payment Main Library
 * Main payment feature module with services, controllers, and entities
 */

// Module
export * from './payment-main.module';

// Services (re-exports from shared + main-specific)
export * from './service';

// Providers (re-export from shared for backwards compatibility)
export { CryptoBotProvider, HeleketProvider, YooKassaProvider } from '@app/feature-payment-shared';

// Controllers
export * from './controller/payment.controller';
export * from './controller/payment-webhook.controller';
