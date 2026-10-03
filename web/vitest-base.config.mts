import { defineConfig } from 'vitest/config';

const logicFiles = [
  'src/app/core/version-gate.ts',
  'src/app/core/backoff.ts',
  'src/app/core/twin-view.ts',
  'src/app/network/colour-scale.ts',
  'src/app/network/network-layout.ts',
  'src/app/network/particles.ts',
  'src/app/shared/format.ts',
  'src/app/shared/sorting.ts',
  'src/app/panels/n1-sorting.ts',
  'src/app/panels/inspector-model.ts',
];

const logicThresholds = Object.fromEntries(
  logicFiles.map((file) => [file, { lines: 90, statements: 90, functions: 90, branches: 80 }]),
);

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporters: ['text-summary', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/app/**/*.ts'],
      exclude: ['src/app/**/*.spec.ts', 'src/app/model/api-schema.ts', 'src/app/testing/**'],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 75,
        ...logicThresholds,
      },
    },
  },
});
