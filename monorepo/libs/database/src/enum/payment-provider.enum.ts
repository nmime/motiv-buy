/**
 * Payment provider types
 * Each provider has isolated context and implementation
 */
export enum PaymentProvider {
  CryptoBot = 'CRYPTO_BOT',
  Heleket = 'HELEKET',
  YooKassa = 'YOOKASSA',
  // Future providers can be added here
  // Stripe = 'STRIPE',
  // PayPal = 'PAYPAL',
}
