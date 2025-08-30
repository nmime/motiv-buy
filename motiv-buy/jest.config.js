/**
 * Jest Configuration for Motiv NX Monorepo
 * Comprehensive testing setup with TypeScript support
 */

module.exports = {
  displayName: 'app',
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '<rootDir>/apps/**/tests/**/*.test.{ts,tsx,js,jsx}',
    '<rootDir>/libs/**/tests/**/*.test.{ts,tsx,js,jsx}',
    '<rootDir>/tests/**/*.test.{ts,tsx,js,jsx}',
    '<rootDir>/apps/**/*.test.{ts,tsx,js,jsx}',
    '<rootDir>/libs/**/*.test.{ts,tsx,js,jsx}'
  ],
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/jest.setup.ts'
  ],
  
  // Module name mapping for NX structure
  moduleNameMapping: {
    '^@app/feature-auth-main$': '<rootDir>/libs/features/auth/main/src/index.ts',
    '^@app/feature-auth-shared$': '<rootDir>/libs/features/auth/shared/src/index.ts',
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
    '^@app/feature-order-main$': '<rootDir>/libs/features/order/main/src/index.ts',
    '^@app/feature-order-shared$': '<rootDir>/libs/features/order/shared/src/index.ts',
    '^@app/feature-traffic-main$': '<rootDir>/libs/features/traffic/main/src/index.ts',
    '^@app/feature-traffic-shared$': '<rootDir>/libs/features/traffic/shared/src/index.ts',
    '^@app/feature-user-main$': '<rootDir>/libs/features/user/main/src/index.ts',
    '^@app/feature-user-shared$': '<rootDir>/libs/features/user/shared/src/index.ts'
  },
  
  // TypeScript configuration
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        compilerOptions: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true
        }
      }
    }]
  },
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Files to include in coverage
  collectCoverageFrom: [
    'apps/*/src/**/*.{ts,tsx,js,jsx}',
    'libs/*/src/**/*.{ts,tsx,js,jsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
    '!**/*.config.{ts,js}',
    '!**/test-setup.ts'
  ],
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  
  // Test timeout
  testTimeout: 30000,
  
  // Global variables for tests
  globals: {
    'process.env.NODE_ENV': 'test'
  },
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
    '<rootDir>/tmp/'
  ],
  
  // Verbose output
  verbose: true,
  
  // Error handling
  errorOnDeprecated: true,
  
  // Performance monitoring
  detectOpenHandles: true,
  detectLeaks: true,
  
  // Concurrent testing
  maxWorkers: '50%'
};
