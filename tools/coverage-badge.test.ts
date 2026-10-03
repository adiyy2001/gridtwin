import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  badgeColour,
  combine,
  istanbulLines,
  parseJacocoCsv,
  percentage,
  renderBadge,
} from './coverage-badge.ts';

const CSV = [
  'GROUP,PACKAGE,CLASS,INSTRUCTION_MISSED,INSTRUCTION_COVERED,BRANCH_MISSED,BRANCH_COVERED,LINE_MISSED,LINE_COVERED,COMPLEXITY_MISSED,COMPLEXITY_COVERED,METHOD_MISSED,METHOD_COVERED',
  'g,p,A,0,10,0,0,1,9,0,1,0,1',
  'g,p,B,0,10,0,0,0,20,0,1,0,1',
].join('\n');

test('JaCoCo line counters are summed over all classes', () => {
  assert.deepEqual(parseJacocoCsv(CSV), { covered: 29, total: 30 });
});

test('Istanbul lines count a line as covered when any statement on it ran', () => {
  const coverage = {
    'a.ts': {
      statementMap: {
        0: { start: { line: 1 } },
        1: { start: { line: 1 } },
        2: { start: { line: 2 } },
        3: { start: { line: 3 } },
      },
      s: { 0: 0, 1: 4, 2: 0, 3: 2 },
    },
  };
  assert.deepEqual(istanbulLines(coverage), { covered: 2, total: 3 });
});

test('percentage of an empty measurement is zero', () => {
  assert.equal(percentage({ covered: 0, total: 0 }), 0);
  assert.equal(percentage({ covered: 1, total: 4 }), 25);
});

test('combine adds covered and total lines', () => {
  assert.deepEqual(combine([{ covered: 1, total: 2 }, { covered: 3, total: 4 }]), { covered: 4, total: 6 });
});

test('the badge colour follows the thresholds', () => {
  assert.notEqual(badgeColour(95), badgeColour(85));
  assert.notEqual(badgeColour(85), badgeColour(75));
  assert.notEqual(badgeColour(75), badgeColour(50));
});

test('the badge names the value with one decimal and carries an accessible label', () => {
  const svg = renderBadge(96.04);
  assert.match(svg, /aria-label="coverage: 96\.0%"/);
  assert.match(svg, />96\.0%</);
});
