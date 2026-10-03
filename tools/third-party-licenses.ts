import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAVEN_LICENSES = resolve(ROOT, 'api/target/generated-resources/licenses.xml');
const OUTPUT = resolve(ROOT, 'docs/third-party-licenses.md');

const PERMISSIVE = new Set([
  'MIT',
  'MIT-0',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  '0BSD',
  'CC0-1.0',
  'Unlicense',
  'BlueOak-1.0.0',
]);

const MAVEN_NAMES: [RegExp, string][] = [
  [/apache/i, 'Apache-2.0'],
  [/^mit-0$/i, 'MIT-0'],
  [/^mit$/i, 'MIT'],
  [/^bsd-2-clause$/i, 'BSD-2-Clause'],
  [/^edl 1\.0$|eclipse distribution license/i, 'BSD-3-Clause'],
  [/^epl[- ]?2\.0$|eclipse public license.*2\.0/i, 'EPL-2.0'],
  [/^epl[- ]?1\.0$|eclipse public license.*1\.0/i, 'EPL-1.0'],
  [/gnu general public license.*classpath|gpl.*(classpath|cpe)/i, 'GPL-2.0-with-classpath-exception'],
];

export interface MavenArtifact {
  groupId: string;
  artifactId: string;
  version: string;
  licenses: string[];
}

export interface NpmPackage {
  name: string;
  versions: string[];
  license: string;
}

export interface Choice {
  used: string;
  offered: string[];
}

export function spdxFromMavenName(name: string): string {
  const match = MAVEN_NAMES.find(([pattern]) => pattern.test(name.trim()));
  return match === undefined ? name.trim() : match[1];
}

export function parseMavenLicenses(xml: string): MavenArtifact[] {
  const artifacts: MavenArtifact[] = [];
  for (const block of xml.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
    const body = block[1] ?? '';
    const field = (tag: string): string => new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(body)?.[1] ?? '';
    const licenses = [...body.matchAll(/<license>\s*<name>([^<]*)<\/name>/g)].map((entry) => spdxFromMavenName(entry[1] ?? ''));
    artifacts.push({ groupId: field('groupId'), artifactId: field('artifactId'), version: field('version'), licenses });
  }
  return artifacts;
}

export function isPermissive(license: string): boolean {
  return PERMISSIVE.has(license);
}

export function chooseLicense(offered: string[]): Choice {
  const used = offered.find(isPermissive) ?? offered[0] ?? 'unknown';
  return { used, offered: offered.filter((license) => license !== used) };
}

export function chooseFromExpression(expression: string): Choice {
  const stripped = expression.replace(/^\(|\)$/g, '');
  if (stripped.includes(' AND ')) {
    const parts = stripped.split(' AND ');
    return { used: parts.every(isPermissive) ? parts.join(' and ') : stripped, offered: [] };
  }
  return chooseLicense(stripped.split(' OR '));
}

function isPermissiveChoice(choice: Choice): boolean {
  return choice.used.split(' and ').every(isPermissive);
}

function cell(text: string): string {
  return text.replaceAll('|', '/');
}

function mavenSection(artifacts: MavenArtifact[]): string[] {
  const own = artifacts.filter((artifact) => artifact.groupId === 'dev.gridtwin');
  const external = artifacts.filter((artifact) => artifact.groupId !== 'dev.gridtwin');
  const byGroup = new Map<string, MavenArtifact[]>();
  external.forEach((artifact) => {
    byGroup.set(artifact.groupId, [...(byGroup.get(artifact.groupId) ?? []), artifact]);
  });
  const rows = [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, members]) => {
      const versions = [...new Set(members.map((member) => member.version))].sort().join(', ');
      const choices = members.map((member) => chooseLicense(member.licenses));
      const used = [...new Set(choices.map((choice) => choice.used))].sort().join(', ');
      const offered = [...new Set(choices.flatMap((choice) => choice.offered))].sort().join(', ');
      return `| ${cell(group)} | ${members.length} | ${cell(versions)} | ${cell(used)} | ${cell(offered === '' ? '-' : offered)} |`;
    });
  const outside = external
    .map((artifact) => ({ artifact, choice: chooseLicense(artifact.licenses) }))
    .filter(({ choice }) => !isPermissive(choice.used))
    .sort((a, b) => `${a.artifact.groupId}:${a.artifact.artifactId}`.localeCompare(`${b.artifact.groupId}:${b.artifact.artifactId}`));
  const lines = [
    '## Java libraries in the application',
    '',
    `The runtime classpath of the \`api\` module has ${external.length} libraries besides the ${own.length} modules of this project. Where a library offers several licenses, the table names the permissive one that applies, or the only one it offers.`,
    '',
    '| Group | Artifacts | Versions | License used | Also offered |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ];
  if (outside.length === 0) {
    lines.push('Every library is under a permissive license.', '');
  } else {
    lines.push(
      `${outside.length} libraries are not offered under a permissive license. They are API and runtime jars of the Jakarta and Eclipse projects that are used unmodified on the class path, under the Eclipse Public License 2.0 (weak copyleft at file level, with a GPL-2.0 plus Classpath Exception alternative):`,
      '',
      '| Library | Version | License used |',
      '| --- | --- | --- |',
      ...outside.map(({ artifact, choice }) => `| ${artifact.groupId}:${artifact.artifactId} | ${artifact.version} | ${choice.used} |`),
      '',
    );
  }
  return lines;
}

function npmSection(title: string, intro: string, packages: NpmPackage[], onlyOutsidePermissive: boolean): string[] {
  const rows = packages
    .map((entry) => ({ entry, choice: chooseFromExpression(entry.license) }))
    .filter(({ choice }) => !onlyOutsidePermissive || !isPermissiveChoice(choice))
    .sort((a, b) => a.entry.name.localeCompare(b.entry.name));
  return [
    `## ${title}`,
    '',
    intro,
    '',
    '| Package | Version | License |',
    '| --- | --- | --- |',
    ...rows.map(({ entry, choice }) => `| ${cell(entry.name)} | ${cell(entry.versions.join(', '))} | ${cell(entry.license === choice.used ? entry.license : `${choice.used} (${entry.license})`)} |`),
    '',
  ];
}

function readPnpm(arguments_: string[]): NpmPackage[] {
  const output = execFileSync('pnpm', [...arguments_, 'licenses', 'list', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const byLicense = JSON.parse(output) as Record<string, { name: string; versions: string[] }[]>;
  return Object.entries(byLicense).flatMap(([license, packages]) =>
    packages.map((entry) => ({ name: entry.name, versions: entry.versions, license })),
  );
}

export function render(artifacts: MavenArtifact[], production: NpmPackage[], everything: NpmPackage[]): string {
  const lines = [
    '# Third-party licenses',
    '',
    'This file is generated by `tools/licenses.sh` and checked in CI. Do not edit it by hand. [CREDITS.md](../CREDITS.md) describes the data, the tools and the assets around it.',
    '',
    ...mavenSection(artifacts),
    ...npmSection(
      'npm packages the web application depends on',
      'Everything pnpm resolves for the production dependencies of the `web` package. The browser bundle contains the Angular, NgRx Signals, RxJS, tslib and Three.js code. The rest is used by the build.',
      production,
      false,
    ),
    ...npmSection(
      'npm tools outside the permissive list',
      'Development and test packages in the whole workspace whose license is not MIT, Apache-2.0, BSD, ISC or a similar permissive one. None of them is shipped.',
      everything,
      true,
    ),
  ];
  return `${lines.join('\n')}\n`;
}

function main(): void {
  if (!existsSync(MAVEN_LICENSES)) {
    throw new Error(`missing ${MAVEN_LICENSES}, run tools/licenses.sh`);
  }
  const artifacts = parseMavenLicenses(readFileSync(MAVEN_LICENSES, 'utf8'));
  const production = readPnpm(['--filter', 'gridtwin-web', '--prod']);
  const everything = readPnpm([]);
  const text = render(artifacts, production, everything);
  if (process.argv.includes('--check')) {
    const committed = existsSync(OUTPUT) ? readFileSync(OUTPUT, 'utf8') : '';
    if (committed !== text) {
      console.error('docs/third-party-licenses.md is out of date, run tools/licenses.sh');
      process.exit(1);
    }
    console.log('docs/third-party-licenses.md is up to date');
    return;
  }
  writeFileSync(OUTPUT, text);
  console.log(`wrote docs/third-party-licenses.md`);
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
