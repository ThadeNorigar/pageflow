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
  // static/ ist der Webpack-Output (siehe webpack.config.js) — generierter Code,
  // wird nie gelintet.
  ignorePatterns: ['out/', 'build/', 'static/', 'dist/', 'node_modules/', '*.config.js'],
};
