/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  // Standard bleibt node (Resolver-Tests). Komponententests setzen
  // per Docblock `@jest-environment jsdom` selbst um.
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  collectCoverageFrom: [
    'src/resolvers/**/*.{ts,tsx}',
    '!**/node_modules/**',
  ],
};
