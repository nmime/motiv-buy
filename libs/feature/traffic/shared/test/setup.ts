import 'reflect-metadata';

// Set required database environment variables for tests
process.env['DB_HOST'] = 'localhost';
process.env['DB_PORT'] = '5432';
process.env['DB_NAME'] = 'test_db';
process.env['DB_USER'] = 'test_user';
// eslint-disable-next-line sonarjs/no-hardcoded-passwords
process.env['DB_PASSWORD'] = 'test_password';

// Set required Redis environment variables for tests
process.env['REDIS_MODE'] = 'standalone';
process.env['REDIS_HOSTS'] = 'localhost:6379';

// Global test setup
beforeAll(() => {
  // Setup code before all tests
});

afterAll(() => {
  // Cleanup code after all tests
});
