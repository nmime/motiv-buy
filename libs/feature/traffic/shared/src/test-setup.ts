// Test setup for @app/feature-traffic-shared
process.env['DB_HOST'] = 'localhost';
process.env['DB_PORT'] = '5432';
process.env['DB_NAME'] = 'test_db';
process.env['DB_USER'] = 'test_user';
process.env['DB_PASSWORD'] = 'test_password';
process.env['REDIS_MODE'] = 'standalone';
process.env['REDIS_HOSTS'] = 'localhost:6379';
