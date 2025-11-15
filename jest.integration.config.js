/**
 * @type {import('jest').Config}
 */
const config = {
  testEnvironment: 'node',
  transform: {},
  moduleFileExtensions: ['js', 'json'],
  setupFiles: ['<rootDir>/wikipedia/__tests__/test-setup.js'],
  testMatch: ['<rootDir>/wikipedia/__integration_tests__/**/*.test.js'],
};

export default config;
