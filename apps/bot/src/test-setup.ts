// Test setup for bot app
process.env['DB_HOST'] = 'localhost';
process.env['DB_PORT'] = '5432';
process.env['DB_NAME'] = 'test_db';
process.env['DB_USER'] = 'test_user';
// eslint-disable-next-line sonarjs/no-hardcoded-passwords
process.env['DB_PASSWORD'] = 'test_password';
process.env['REDIS_MODE'] = 'standalone';
process.env['REDIS_HOSTS'] = 'localhost:6379';

// Auth environment variables
process.env['JWT_SECRET'] = 'test-jwt-secret-key-for-testing';
process.env['BOT_TOKEN'] = 'test-bot-token-123456';

// Payment gateway environment variables
process.env['CRYPTO_BOT_API_TOKEN'] = 'test-crypto-bot-token';
process.env['HELEKET_API_TOKEN'] = 'test-heleket-token';
process.env['HELEKET_MERCHANT_ID'] = 'test-heleket-merchant';
process.env['YOOKASSA_SHOP_ID'] = 'test-yookassa-shop';
process.env['YOOKASSA_SECRET_KEY'] = 'test-yookassa-secret';
