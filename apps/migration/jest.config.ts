export default {
  displayName: 'migration',
  preset: '../../jest.preset.js',
  coverageDirectory: '../../coverage/apps/migration',
  collectCoverageFrom: ['src/**/*.{js,ts}', '!src/**/*.d.ts', '!src/main.ts', '!src/**/*.config.{js,ts}'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
