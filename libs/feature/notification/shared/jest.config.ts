export default {
  displayName: 'feature-notification-shared',
  preset: '../../../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  coverageDirectory: '../../../../coverage/libs/feature/notification/shared',
  transformIgnorePatterns: ['node_modules/(?!(eta)/)'],
  moduleNameMapper: {
    '^eta$': '<rootDir>/../../../../node_modules/eta/dist/index.js',
  },
};
