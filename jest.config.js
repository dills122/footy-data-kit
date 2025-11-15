/**
 * @type {import('jest').Config}
 */
const config = {
  testEnvironment: 'node',
  transform: {},
  moduleFileExtensions: ['js', 'json'],
  setupFiles: ['<rootDir>/wikipedia/__tests__/test-setup.js'],
  testMatch: [
    '<rootDir>/wikipedia/__tests__/**/*.test.js',
    '<rootDir>/wikipedia/__tests__/**/*.spec.js',
  ],
  collectCoverageFrom: ['wikipedia/**/*.js', 'scripts/**/*.js', '!**/__tests__/**'],
};

export default config;
