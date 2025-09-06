module.exports = {
  displayName: 'app',
  preset: 'ts-jest',
  testEnvironment: 'node',

  testMatch: [
    '<rootDir>/apps/**/tests/**/*.test.{ts,tsx,js,jsx}',
    '<rootDir>/libs/**/tests/**/*.test.{ts,tsx,js,jsx}',
    '<rootDir>/tests/**/*.test.{ts,tsx,js,jsx}',
    '<rootDir>/apps/**/*.test.{ts,tsx,js,jsx}',
    '<rootDir>/libs/**/*.test.{ts,tsx,js,jsx}',
  ],

  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.ts'],

  moduleNameMapping: {
    '^@app/feature-auth-main$': '<rootDir>/libs/feature/auth/main/src/index.ts',
    '^@app/feature-auth-shared$': '<rootDir>/libs/feature/auth/shared/src/index.ts',
    '^@app/common-bull$': '<rootDir>/libs/common/bull/src/index.ts',
    '^@app/common-exception$': '<rootDir>/libs/common/exception/src/index.ts',
    '^@app/common-health$': '<rootDir>/libs/common/health/src/index.ts',
    '^@app/common-intl$': '<rootDir>/libs/common/intl/src/index.ts',
    '^@app/common-logger$': '<rootDir>/libs/common/logger/src/index.ts',
    '^@app/common-redis$': '<rootDir>/libs/common/redis/src/index.ts',
    '^@app/common-response$': '<rootDir>/libs/common/response/src/index.ts',
    '^@app/common-shared$': '<rootDir>/libs/common/shared/src/index.ts',
    '^@app/common-validation$': '<rootDir>/libs/common/validation/src/index.ts',
    '^@app/database$': '<rootDir>/libs/database/src/index.ts',
    '^@app/feature-order-main$': '<rootDir>/libs/feature/order/main/src/index.ts',
    '^@app/feature-order-shared$': '<rootDir>/libs/feature/order/shared/src/index.ts',
    '^@app/feature-traffic-main$': '<rootDir>/libs/feature/traffic/main/src/index.ts',
    '^@app/feature-traffic-shared$': '<rootDir>/libs/feature/traffic/shared/src/index.ts',
    '^@app/feature-user-main$': '<rootDir>/libs/feature/user/main/src/index.ts',
    '^@app/feature-user-shared$': '<rootDir>/libs/feature/user/shared/src/index.ts',
  },

  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          compilerOptions: {
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
          },
        },
      },
    ],
  },

  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  collectCoverageFrom: [
    'apps/*/src/**/*.{ts,tsx,js,jsx}',
    'libs/*/src/**/*.{ts,tsx,js,jsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
    '!**/*.config.{ts,js}',
    '!**/test-setup.ts',
  ],

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  clearMocks: true,
  restoreMocks: true,

  testTimeout: 30000,

  globals: {
    'process.env.NODE_ENV': 'test',
  },

  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/', '<rootDir>/coverage/', '<rootDir>/tmp/'],

  verbose: true,

  errorOnDeprecated: true,

  detectOpenHandles: true,
  detectLeaks: true,

  maxWorkers: '50%',
};
