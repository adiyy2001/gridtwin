import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const TOLERANCE = 1e-9;

export function differences(expected, actual, path = '$') {
  if (typeof expected === 'number' && typeof actual === 'number') {
    const allowed = TOLERANCE * Math.max(1, Math.abs(expected));
    return Math.abs(expected - actual) <= allowed ? [] : [`${path}: ${expected} differs from ${actual}`];
  }
  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) {
      return [`${path}: length ${expected.length} differs from ${actual.length}`];
    }
    return expected.flatMap((value, index) => differences(value, actual[index], `${path}[${index}]`));
  }
  if (isObject(expected) && isObject(actual)) {
    const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
    return keys.flatMap((key) => {
      if (!(key in expected)) {
        return [`${path}.${key}: unexpected key`];
      }
      if (!(key in actual)) {
        return [`${path}.${key}: missing key`];
      }
      return differences(expected[key], actual[key], `${path}.${key}`);
    });
  }
  return expected === actual ? [] : [`${path}: ${JSON.stringify(expected)} differs from ${JSON.stringify(actual)}`];
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const HAND_WRITTEN = /\.substation\.json$/;

function jsonFiles(directory) {
  return readdirSync(directory)
    .filter((name) => name.endsWith('.json') && !HAND_WRITTEN.test(name))
    .sort();
}

export function compareDirectories(committedDirectory, regeneratedDirectory) {
  const committed = jsonFiles(committedDirectory);
  const regenerated = jsonFiles(regeneratedDirectory);
  const problems = [];
  for (const name of committed.filter((file) => !regenerated.includes(file))) {
    problems.push(`${name}: committed but not regenerated`);
  }
  for (const name of regenerated.filter((file) => !committed.includes(file))) {
    problems.push(`${name}: regenerated but not committed`);
  }
  for (const name of committed.filter((file) => regenerated.includes(file))) {
    const expected = JSON.parse(readFileSync(join(committedDirectory, name), 'utf8'));
    const actual = JSON.parse(readFileSync(join(regeneratedDirectory, name), 'utf8'));
    problems.push(...differences(expected, actual).map((line) => `${name} ${line}`));
  }
  return { checked: committed.length, problems };
}

function main() {
  const [committedDirectory, regeneratedDirectory] = process.argv.slice(2);
  if (!committedDirectory || !regeneratedDirectory) {
    console.error('usage: compare.mjs <committed directory> <regenerated directory>');
    process.exit(2);
  }
  const { checked, problems } = compareDirectories(committedDirectory, regeneratedDirectory);
  for (const problem of problems.slice(0, 40)) {
    console.error(problem);
  }
  if (problems.length > 0) {
    console.error(`${problems.length} difference(s) between committed and regenerated files`);
    process.exit(1);
  }
  console.log(`${checked} files match their regenerated versions`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
