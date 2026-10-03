import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { compareDirectories, differences } from './compare.mjs';

function directoryWith(files) {
  const directory = mkdtempSync(join(tmpdir(), 'gridtwin-compare-'));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(directory, name), JSON.stringify(content));
  }
  return directory;
}

test('equal documents have no differences', () => {
  const document = { a: 1, b: [1.5, 'x', true], c: { d: null } };
  assert.deepEqual(differences(document, structuredClone(document)), []);
});

test('numbers within the tolerance match and larger gaps are reported with their path', () => {
  assert.deepEqual(differences({ v: 1 }, { v: 1 + 1e-12 }), []);
  assert.deepEqual(differences({ rows: [{ v: 1 }] }, { rows: [{ v: 1.001 }] }), ['$.rows[0].v: 1 differs from 1.001']);
});

test('missing keys, extra keys and length changes are reported', () => {
  assert.deepEqual(differences({ a: 1 }, {}), ['$.a: missing key']);
  assert.deepEqual(differences({}, { a: 1 }), ['$.a: unexpected key']);
  assert.deepEqual(differences({ a: [1] }, { a: [1, 2] }), ['$.a: length 1 differs from 2']);
});

test('strings and booleans must be identical', () => {
  assert.equal(differences({ a: 'x' }, { a: 'y' }).length, 1);
  assert.equal(differences({ a: true }, { a: false }).length, 1);
});

test('directories with the same files and values match', () => {
  const committed = directoryWith({ 'a.json': { v: 1 }, 'b.json': { v: [2] } });
  const regenerated = directoryWith({ 'a.json': { v: 1 }, 'b.json': { v: [2] } });
  assert.deepEqual(compareDirectories(committed, regenerated), { checked: 2, problems: [] });
});

test('a file that exists on one side only is a problem', () => {
  const committed = directoryWith({ 'a.json': {}, 'old.json': {} });
  const regenerated = directoryWith({ 'a.json': {}, 'new.json': {} });
  assert.deepEqual(compareDirectories(committed, regenerated).problems, [
    'old.json: committed but not regenerated',
    'new.json: regenerated but not committed',
  ]);
});

test('hand-written substation files are not part of the comparison', () => {
  const committed = directoryWith({ 'a.json': { v: 1 }, 'a.substation.json': { nodes: [] } });
  const regenerated = directoryWith({ 'a.json': { v: 1 } });
  assert.deepEqual(compareDirectories(committed, regenerated), { checked: 1, problems: [] });
});
