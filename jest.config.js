module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.interface.ts',
    '!**/*.enum.ts',
    '!**/*.dto.ts',
    '!**/main.ts',
    '!**/*.module.ts',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  modulePaths: ['<rootDir>'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/../test/setup.ts'],
};