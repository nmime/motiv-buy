export default {
  displayName: 'feature-notification-shared',
  preset: '../../../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  coverageDirectory: '../../../../coverage/libs/feature/notification/shared',
  // transformIgnorePatterns inherited from jest.preset.js to handle .pnpm structure
  moduleNameMapper: {
    '^eta$': '<rootDir>/../../../../node_modules/eta/dist/index.js',
  },
};
