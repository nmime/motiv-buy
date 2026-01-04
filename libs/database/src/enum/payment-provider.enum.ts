/**
 * Payment provider types
 * Each provider has isolated context and implementation
 */
export enum PaymentProvider {
  CryptoBot = 'crypto_bot',
  Heleket = 'heleket',
  YooKassa = 'yookassa',
  // Future providers can be added here
  // Stripe = 'stripe',
  // PayPal = 'paypal',
}
