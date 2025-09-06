import { getJestProjectsAsync } from '@nx/jest';

export default async () => ({
  projects: await getJestProjectsAsync(),
  collectCoverageFrom: [
    'apps/**/*.{js,ts}',
    'libs/**/*.{js,ts}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/*.config.{js,ts}',
    '!**/main.ts',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: [
    '<rootDir>/apps/**/*.(test|spec).{js,ts}',
    '<rootDir>/libs/**/*.(test|spec).{js,ts}',
  ],
  transform: {
    '^.+\\.(ts|js|html)$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  maxWorkers: '50%',
  testTimeout: 30000,
});
