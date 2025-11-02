const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  // Environment settings
  testEnvironment: 'node',
  testTimeout: 30000,
  maxWorkers: '50%',
  
  // Transform configuration
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  
  // Test pattern matching
  testMatch: [
    '<rootDir>/src/**/*.(test|spec).{js,ts}',
    '<rootDir>/test/**/*.(test|spec).{js,ts}',
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts',
    '!src/**/*.config.{js,ts}',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/main.ts',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
};
