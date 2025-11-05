const nx = require('@nx/eslint-plugin');
const typescriptEslintParser = require('@typescript-eslint/parser');
const typescriptEslintPlugin = require('@typescript-eslint/eslint-plugin');
const sonarjsEslintPlugin = require('eslint-plugin-sonarjs');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?js$'],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  sonarjsEslintPlugin.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptEslintParser,
    },
    rules: {
      ...typescriptEslintPlugin.configs['recommended'].rules,
    },
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    rules: {
      ...typescriptEslintPlugin.configs['recommended'].rules,
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
    // Override or add rules here
    rules: {
      'lines-between-class-members': [
        'error',
        {
          enforce: [
            { blankLine: 'always', prev: 'method', next: 'field' },
            { blankLine: 'always', prev: 'field', next: 'method' },
            { blankLine: 'always', prev: 'method', next: 'method' },
          ],
        },
      ],
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: 'block-like', next: '*' },
        { blankLine: 'always', prev: ['multiline-const', 'multiline-let', 'multiline-expression'], next: '*' },
      ],

      '@typescript-eslint/no-restricted-types': [
        'error',
        {
          types: {
            object: true,
          },
        },
      ],
      'curly': ['error', 'all'],
      'no-useless-escape': ['error'],
      'no-use-before-define': ['error'],
      'no-console': ['error'],
      'no-var': ['error'],
      'eqeqeq': ['error'],
      'object-shorthand': ['error', 'always'],
      'prefer-destructuring': [
        'error',
        {
          array: true,
          object: true,
        },
      ],
      'spaced-comment': ['error', 'always'],
      'no-template-curly-in-string': ['error'],

      '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'no-public' }],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
          trailingUnderscore: 'allow',
        },

        {
          selector: 'import',
          format: ['camelCase', 'PascalCase'],
        },
        {
          selector: 'variable',
          format: ['camelCase', 'PascalCase'],
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
        {
          selector: 'enumMember',
          format: ['StrictPascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'forbid',
          trailingUnderscore: 'forbid',
        },
        {
          selector: 'objectLiteralProperty',
          format: null,
        },
        {
          selector: 'typeProperty',
          format: null,
        },
      ],

      // Rule to forbid `Enum` postfix and enforce snake_case enum values
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSEnumDeclaration[id.name=/Enum$/]',
          message: "Enum names should not end with 'Enum'.",
        },
        {
          selector: 'TSEnumMember[initializer.type="Literal"][initializer.value=/^[A-Z][a-z]+([A-Z][a-z]*)+$/]',
          message: 'Enum values must be lowercase snake_case, not PascalCase. Use "my_value" instead of "MyValue".',
        },
        {
          selector: 'TSEnumMember[initializer.type="Literal"][initializer.value=/^[A-Z]+_[A-Z_]+$/]',
          message: 'Enum values must be lowercase snake_case, not SCREAMING_SNAKE_CASE. Use "my_value" instead of "MY_VALUE".',
        },
      ],

      'no-await-in-loop': 'error',
      'no-param-reassign': ['error', { ignorePropertyModificationsFor: ['ctx', 'req', 'res'], props: true }],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],

      'sonarjs/fixme-tag': 'warn',
      'sonarjs/todo-tag': 'warn',

      'sonarjs/sonar-no-fallthrough': 'off', // Bugged rule
      'sonarjs/no-commented-code': 'off',
      'sonarjs/use-type-alias': 'off', // We use union types to implicitly define result exceptions
    },
  },
];
