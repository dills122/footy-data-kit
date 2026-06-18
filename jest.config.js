/**
 * @type {import('jest').Config}
 */
const config = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': '<rootDir>/scripts/jest-typescript-transformer.cjs',
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['js', 'ts', 'json'],
  setupFiles: ['<rootDir>/wikipedia/__tests__/test-setup.js'],
  testMatch: [
    '<rootDir>/wikipedia/__tests__/**/*.test.js',
    '<rootDir>/wikipedia/__tests__/**/*.spec.js',
  ],
  collectCoverageFrom: ['wikipedia/**/*.js', 'scripts/**/*.js', '!**/__tests__/**'],
};

export default config;
