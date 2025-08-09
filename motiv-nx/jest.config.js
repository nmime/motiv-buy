/**
 * Jest Configuration for Motiv NX Monorepo
 * Comprehensive testing setup with TypeScript support
 */

module.exports = {
  displayName: 'motiv-nx',
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
    '^@motiv-nx/shared-types$': '<rootDir>/libs/shared-types/src/index.ts',
    '^@motiv-nx/shared-utils$': '<rootDir>/libs/shared-utils/src/index.ts',
    '^@motiv-nx/shared-config$': '<rootDir>/libs/shared-config/src/index.ts',
    '^@/(.*)$': '<rootDir>/src/$1'
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