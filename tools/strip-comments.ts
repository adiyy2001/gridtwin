import { readFileSync, writeFileSync } from 'node:fs';

const path = process.argv[2];
if (path === undefined) {
  console.error('usage: strip-comments.ts <file>');
  process.exit(2);
}
const source = readFileSync(path, 'utf8');
const stripped = source
  .replace(/^[ \t]*\/\*[\s\S]*?\*\/[ \t]*\n/gm, '')
  .replace(/^[ \t]*\/\/.*\n/gm, '')
  .replace(/\n{3,}/g, '\n\n');
writeFileSync(path, stripped.trimStart());
