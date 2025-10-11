/**
 * @type {import('jest').Config}
 */
const config = {
  testEnvironment: 'node',
  transform: {},
  moduleFileExtensions: ['js', 'json'],
  collectCoverageFrom: ['wikipedia/**/*.js', 'scripts/**/*.js', '!**/__tests__/**'],
};

export default config;
