export default {
  displayName: 'feature-notification-shared',
  preset: '../../../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  coverageDirectory: '../../../../coverage/libs/feature/notification/shared',
  moduleNameMapper: {
    '^eta$': '<rootDir>/../../../../node_modules/eta/dist/eta.cjs',
  },
};
