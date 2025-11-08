export default {
  displayName: 'bot',
  preset: '../../jest.preset.js',
  coverageDirectory: '../../coverage/apps/bot',
  collectCoverageFrom: ['src/**/*.{js,ts}', '!src/**/*.d.ts', '!src/main.ts', '!src/**/*.config.{js,ts}'],
};
