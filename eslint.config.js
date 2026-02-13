const js = require('@eslint/js');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const prettierConfig = require('eslint-config-prettier');
const pluginJest = require('eslint-plugin-jest');

module.exports = [
  {
    ignores: ['eslint.config.js'],
  },

  js.configs.recommended,

  {
    files: ['**/*.ts', '**/*.tsx'],

    languageOptions: {
      parser: tsParser,

      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
        sourceType: 'module',
      },

      globals: {
        ...pluginJest.environments.globals.globals,

        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
        require: 'readonly',
        NodeJS: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',

        fetch: 'readonly',
      },
    },

    plugins: {
      '@typescript-eslint': tsPlugin,
      jest: pluginJest,
    },

    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...prettierConfig.rules,
      ...pluginJest.configs.recommended.rules,

      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',

      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: true,
          argsIgnorePattern: '^_|^error$',
          varsIgnorePattern: '^error$',
          caughtErrorsIgnorePattern: '^_|^error$',
        },
      ],
    },
  },
];
