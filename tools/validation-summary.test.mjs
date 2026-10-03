import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scientific, summarise } from './validation-summary.mjs';

const REPORT = {
  reference: 'MATPOWER 8.1 under GNU Octave 11.3.0',
  environment: { jvm: 'jvm 21', operatingSystem: 'Linux 6', logicalCores: 4 },
  tolerances: { voltagePu: 1e-6, angleDegrees: 1e-4, flowMw: 1e-2 },
  baseCases: [
    { case: 'ieee14', voltagePu: 1e-9, angleDegrees: 2e-8, flowMw: 3e-7 },
    { case: 'ieee14', voltagePu: 4e-9, angleDegrees: 1e-8, flowMw: 1e-7 },
    { case: 'ieee30', voltagePu: 5e-9, angleDegrees: 1e-8, flowMw: 1e-7 },
  ],
  contingencies: [
    { case: 'ieee14', reactiveLimits: true, outagesCompared: 24, voltagePu: 1e-10, angleDegrees: 1e-8, flowMw: 1e-7 },
  ],
  worstOverall: { voltagePu: 5e-9, angleDegrees: 2e-8, flowMw: 3e-7 },
};

test('numbers are printed in scientific notation with three significant digits', () => {
  assert.equal(scientific(0.000000004), '4.00e-9');
});

test('the summary reports the worst deviation per case and the limits', () => {
  const text = summarise(REPORT);
  assert.match(text, /ieee14: 2 solutions, worst voltage 4\.00e-9 pu/);
  assert.match(text, /ieee30: 1 solutions/);
  assert.match(text, /ieee14 with reactive limits: 24 outages/);
  assert.match(text, /limit 1\.00e-6/);
});
