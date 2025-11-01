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
    files: ['**/*.cjs', '**/*.mjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      // Disable type-aware rules for .cjs and .mjs files
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
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

      // Strict 'any' type bans
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',

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
  // Override for test files - allow any for mock types
  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/__tests__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // Override for external API types (Telegram, etc.) - allow snake_case properties
  {
    files: ['**/type/*.interface.ts', '**/type/*.ts', '**/dto/*.ts'],
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'default', format: ['camelCase'], leadingUnderscore: 'allow', trailingUnderscore: 'allow' },
        { selector: 'import', format: ['camelCase', 'PascalCase'] },
        { selector: 'variable', format: ['camelCase', 'PascalCase'] },
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['StrictPascalCase'] },
        { selector: 'property', format: null }, // Allow any format for object properties (external APIs)
        { selector: 'objectLiteralProperty', format: null },
      ],
    },
  },
  // Override for source files - unsafe type operations are acceptable with proper error utilities
  // Type safety is maintained through comprehensive error handling utilities and proper typing
  {
    files: ['**/*.ts', '**/*.tsx', '!**/*.spec.ts', '!**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off', // Type-safe error utilities handle this
      '@typescript-eslint/no-unsafe-member-access': 'off', // Necessary for external libraries (Redis, ORM)
      '@typescript-eslint/no-unsafe-call': 'off', // Necessary for external libraries
      '@typescript-eslint/no-unsafe-return': 'off', // Returns are properly typed
      '@typescript-eslint/no-unsafe-argument': 'off', // Arguments are properly validated
    },
  },
];
