const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageReporters: ['html', 'text', 'lcov'],
  // Handle ESM modules in pnpm's nested structure (.pnpm/eta@.../node_modules/eta)
  transformIgnorePatterns: ['node_modules/(?!(.pnpm|eta|uuid)/)'],
};
