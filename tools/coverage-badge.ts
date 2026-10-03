import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const JAVA_MODULES = ['domain', 'cases', 'api', 'bench'];
const WEB_COVERAGE = 'web/coverage/web/coverage-final.json';
const BADGE_PATH = 'docs/badges/coverage.svg';

export interface LineCount {
  covered: number;
  total: number;
}

interface IstanbulFile {
  statementMap: Record<string, { start: { line: number } }>;
  s: Record<string, number>;
}

export function parseJacocoCsv(text: string): LineCount {
  const [header = '', ...rows] = text.trim().split('\n');
  const columns = header.split(',');
  const missed = columns.indexOf('LINE_MISSED');
  const covered = columns.indexOf('LINE_COVERED');
  return rows
    .map((row) => row.split(','))
    .reduce<LineCount>(
      (total, cells) => ({
        covered: total.covered + Number(cells[covered]),
        total: total.total + Number(cells[covered]) + Number(cells[missed]),
      }),
      { covered: 0, total: 0 },
    );
}

export function istanbulLines(coverage: Record<string, IstanbulFile>): LineCount {
  return Object.values(coverage).reduce<LineCount>(
    (total, file) => {
      const hitsByLine = new Map<number, number>();
      Object.entries(file.statementMap).forEach(([id, location]) => {
        const line = location.start.line;
        hitsByLine.set(line, Math.max(hitsByLine.get(line) ?? 0, file.s[id] ?? 0));
      });
      const hits = [...hitsByLine.values()];
      return {
        covered: total.covered + hits.filter((count) => count > 0).length,
        total: total.total + hits.length,
      };
    },
    { covered: 0, total: 0 },
  );
}

export function percentage({ covered, total }: LineCount): number {
  return total === 0 ? 0 : (covered / total) * 100;
}

export function combine(parts: LineCount[]): LineCount {
  return parts.reduce(
    (sum, part) => ({ covered: sum.covered + part.covered, total: sum.total + part.total }),
    { covered: 0, total: 0 },
  );
}

export function badgeColour(value: number): string {
  if (value >= 90) return '#2e9e4f';
  if (value >= 80) return '#97a31f';
  if (value >= 70) return '#c9961a';
  return '#c0392b';
}

export function renderBadge(value: number): string {
  const label = 'coverage';
  const text = `${value.toFixed(1)}%`;
  const labelWidth = 62;
  const valueWidth = 54;
  const width = labelWidth + valueWidth;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${label}: ${text}">
  <title>${label}: ${text}</title>
  <linearGradient id="shade" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="round"><rect width="${width}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#round)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${badgeColour(value)}"/>
    <rect width="${width}" height="20" fill="url(#shade)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14">${text}</text>
  </g>
</svg>
`;
}

function readJava(moduleName: string): LineCount {
  const path = resolve(ROOT, moduleName, 'target/site/jacoco/jacoco.csv');
  if (!existsSync(path)) {
    throw new Error(`missing ${path}, run ./mvnw -B -ntp verify first`);
  }
  return parseJacocoCsv(readFileSync(path, 'utf8'));
}

function readWeb(): LineCount {
  const path = resolve(ROOT, WEB_COVERAGE);
  if (!existsSync(path)) {
    throw new Error(`missing ${path}, run pnpm --dir web run test:ci first`);
  }
  return istanbulLines(JSON.parse(readFileSync(path, 'utf8')) as Record<string, IstanbulFile>);
}

function main(): void {
  const java = Object.fromEntries(JAVA_MODULES.map((name) => [name, readJava(name)]));
  const web = readWeb();
  const all = combine([...Object.values(java), web]);
  const rows: [string, LineCount][] = [...Object.entries(java), ['web', web], ['all', all]];
  rows.forEach(([name, part]) => {
    console.log(`${name.padEnd(8)} ${percentage(part).toFixed(1).padStart(5)}% lines (${part.covered} of ${part.total})`);
  });
  const target = resolve(ROOT, BADGE_PATH);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, renderBadge(percentage(all)));
  console.log(`wrote ${BADGE_PATH}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
