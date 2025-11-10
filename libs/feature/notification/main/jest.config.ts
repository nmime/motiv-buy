export default {
  displayName: 'feature-notification-main',
  preset: '../../../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  coverageDirectory: '../../../../coverage/libs/feature/notification/main',
  transformIgnorePatterns: ['node_modules/(?!(eta)/)'],
  moduleNameMapper: {
    '^eta$': '<rootDir>/../../../../node_modules/eta/dist/index.js',
  },
};
