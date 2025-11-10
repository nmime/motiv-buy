export default {
  displayName: 'feature-notification-main',
  preset: '../../../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  coverageDirectory: '../../../../coverage/libs/feature/notification/main',
  // transformIgnorePatterns inherited from jest.preset.js to handle .pnpm structure
  moduleNameMapper: {
    '^eta$': '<rootDir>/../../../../node_modules/eta/dist/index.js',
  },
};
