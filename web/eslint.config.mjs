import eslint from '@eslint/js';
import angular from 'angular-eslint';
import tseslint from 'typescript-eslint';



function boundaryOverride(folder, forbiddenFolders) {
  return {
    files: [`src/app/${folder}/**/*.ts`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: forbiddenFolders.map((forbidden) => ({
            group: [`**/${forbidden}`, `**/${forbidden}/**`],
            message: `${folder} must not import from ${forbidden}`,
          })),
        },
      ],
    },
  };
}

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', '.angular/**', 'src/app/model/api-schema.ts'] },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      ...angular.configs.tsRecommended,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'gt', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'gt', style: 'kebab-case' },
      ],
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      '@angular-eslint/prefer-signals': 'error',
      '@angular-eslint/prefer-standalone': 'error',
      '@angular-eslint/no-experimental': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true },
      ],
      'no-inline-comments': 'error',
      'no-warning-comments': 'error',
      'no-console': 'error',
    },
  },
  boundaryOverride('core', ['network', 'panels', 'sld', 'scene']),
  boundaryOverride('model', ['core', 'network', 'panels', 'sld', 'scene']),
  boundaryOverride('shared', ['core', 'network', 'panels', 'sld', 'scene']),
  boundaryOverride('network', ['panels', 'sld', 'scene']),
  boundaryOverride('panels', ['network', 'sld', 'scene']),
  boundaryOverride('sld', ['network', 'panels', 'scene']),
  boundaryOverride('scene', ['network', 'panels', 'sld']),
  {
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {
      '@angular-eslint/template/prefer-control-flow': 'error',
      '@angular-eslint/template/prefer-ngsrc': 'off',
    },
  },
);
