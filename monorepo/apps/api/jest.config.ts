export default {
  displayName: 'api',
  preset: '../../jest.preset.js',
  coverageDirectory: '../../coverage/apps/api',
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts',
    '!src/main.ts',
    '!src/**/*.config.{js,ts}',
  ],
};
