const { getJestProjects } = require('@nx/jest');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Module name mapping for updated path aliases
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
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  
  projects: getJestProjects(),
};