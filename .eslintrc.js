module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    node: true,
    jest: true,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
  },
  ignorePatterns: ['out/', 'build/', 'dist/', 'node_modules/', '*.config.js'],
};
