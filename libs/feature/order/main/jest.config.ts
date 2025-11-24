export default {
  displayName: '@app/feature-order-main',
  preset: '../../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../../coverage/libs/feature/order/main',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
};
