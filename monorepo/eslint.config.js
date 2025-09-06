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
    ignores: ['**/dist', '**/node_modules', '**/coverage', '**/tmp'],
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
      parserOptions: {
        project: 'tsconfig.*?.json',
      },
    },
    rules: {
      ...typescriptEslintPlugin.configs['recommended-type-checked'].rules,
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
    rules: {
      // Class and method formatting
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

      // TypeScript specific rules
      '@typescript-eslint/no-restricted-types': [
        'error',
        {
          types: {
            object: true,
          },
        },
      ],
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
          format: ['StrictPascalCase'],
          leadingUnderscore: 'forbid',
          trailingUnderscore: 'forbid',
        },
        {
          selector: 'objectLiteralProperty',
          format: null,
        },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',

      // Core JavaScript/TypeScript rules
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
      'no-await-in-loop': 'error',
      'no-param-reassign': ['error', { ignorePropertyModificationsFor: ['ctx', 'req', 'res'], props: true }],

      // Enum naming restriction
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSEnumDeclaration[id.name=/Enum$/]',
          message: "Enum names should not end with 'Enum'.",
        },
      ],

      // SonarJS rules
      'sonarjs/fixme-tag': 'warn',
      'sonarjs/todo-tag': 'warn',
      'sonarjs/sonar-no-fallthrough': 'off', // Bugged rule
      'sonarjs/no-commented-code': 'off',
      'sonarjs/use-type-alias': 'off', // We use union types to implicitly define result exceptions
    },
  },
];
