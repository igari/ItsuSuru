module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'google',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'plugin:prettier/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['tsconfig.json', 'tsconfig.dev.json'],
    sourceType: 'module',
    ecmaVersion: 2021,
  },
  ignorePatterns: [
    'lib/**/*', // Ignore built files.
    '.eslintrc.js',
  ],
  plugins: ['@typescript-eslint', '@typescript-eslint/eslint-plugin', 'import'],
  rules: {
    quotes: ['error', 'single'],
    'quote-props': 'off',
    'import/no-unresolved': 0,
    'import/order': 'error',
    indent: ['error', 2],
    'object-curly-spacing': ['error', 'always'],
  },
}
