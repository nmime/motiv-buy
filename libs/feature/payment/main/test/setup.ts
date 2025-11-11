import 'reflect-metadata';

// Set required database environment variables for tests
process.env['DB_HOST'] = 'localhost';
process.env['DB_PORT'] = '5432';
process.env['DB_NAME'] = 'test_db';
process.env['DB_USER'] = 'test_user';
// eslint-disable-next-line sonarjs/no-hardcoded-passwords
process.env['DB_PASSWORD'] = 'test_password';
process.env['REDIS_MODE'] = 'standalone';
process.env['REDIS_HOSTS'] = 'localhost:6379';
process.env['CRYPTO_BOT_API_TOKEN'] = 'test_crypto_bot_token';
process.env['HELEKET_API_TOKEN'] = 'test_heleket_token';
process.env['HELEKET_MERCHANT_ID'] = 'test_merchant_id';
process.env['YOOKASSA_SHOP_ID'] = 'test_shop_id';
process.env['YOOKASSA_SECRET_KEY'] = 'test_secret_key';

// Global test setup
beforeAll(() => {
  // Setup code before all tests
});

afterAll(() => {
  // Cleanup code after all tests
});
