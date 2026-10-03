import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DASH_PATTERN = /[\u2013\u2014]/;

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.woff', '.woff2', '.ttf', '.otf',
  '.jar', '.zip', '.gz', '.pdf', '.mp4', '.webm', '.glb', '.wasm',
]);

const VENDORED_PATHS = [
  /^mvnw(\.cmd)?$/,
  /^\.mvn\/wrapper\//,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)package-lock\.json$/,
  /(^|\/)node_modules\//,
];

const REGEX_PRECEDING_CHARACTERS = new Set('(,=:[!&|?{};+-*%<>~^'.split(''));
const REGEX_PRECEDING_WORDS = new Set(['return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'throw']);

function isWordCharacter(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z0-9_$]/.test(character);
}

function skipQuoted(text: string, start: number, quote: string): number {
  let index = start + 1;
  while (index < text.length) {
    const character = text.charAt(index);
    if (character === '\\') {
      index += 2;
    } else if (character === quote) {
      return index + 1;
    } else if (character === '\n') {
      return index;
    } else {
      index += 1;
    }
  }
  return text.length;
}

function skipTextBlock(text: string, start: number): number {
  let index = start + 3;
  while (index < text.length) {
    if (text[index] === '\\') {
      index += 2;
    } else if (text.startsWith('"""', index)) {
      return index + 3;
    } else {
      index += 1;
    }
  }
  return text.length;
}

function skipRegexLiteral(text: string, start: number): number {
  let index = start + 1;
  let inClass = false;
  while (index < text.length) {
    const character = text.charAt(index);
    if (character === '\\') {
      index += 2;
    } else if (character === '\n') {
      return index;
    } else if (character === '[') {
      inClass = true;
      index += 1;
    } else if (character === ']') {
      inClass = false;
      index += 1;
    } else if (character === '/' && !inClass) {
      index += 1;
      while (isWordCharacter(text[index])) {
        index += 1;
      }
      return index;
    } else {
      index += 1;
    }
  }
  return text.length;
}

interface CLikeOptions {
  textBlocks: boolean;
  templates: boolean;
  regexLiterals: boolean;
  urlFunction: boolean;
}

function scanCLike(text: string, options: CLikeOptions): number[] {
  const found: number[] = [];

  function scanTemplate(start: number): number {
    let index = start + 1;
    while (index < text.length) {
      const character = text.charAt(index);
      if (character === '\\') {
        index += 2;
      } else if (character === '`') {
        return index + 1;
      } else if (character === '$' && text[index + 1] === '{') {
        index = scanCode(index + 2, true);
      } else {
        index += 1;
      }
    }
    return text.length;
  }

  function scanCode(start: number, untilClosingBrace: boolean): number {
    let index = start;
    let depth = 0;
    let lastSignificant = '';
    let lastWord = '';
    while (index < text.length) {
      const character = text.charAt(index);
      const next = text.charAt(index + 1);
      if (character === '/' && next === '/') {
        found.push(index);
        const end = text.indexOf('\n', index);
        index = end < 0 ? text.length : end;
      } else if (character === '/' && next === '*') {
        found.push(index);
        const end = text.indexOf('*/', index + 2);
        index = end < 0 ? text.length : end + 2;
      } else if (options.textBlocks && text.startsWith('"""', index)) {
        index = skipTextBlock(text, index);
        lastSignificant = '"';
      } else if (character === '"' || character === "'") {
        index = skipQuoted(text, index, character);
        lastSignificant = character;
      } else if (options.templates && character === '`') {
        index = scanTemplate(index);
        lastSignificant = '`';
      } else if (options.urlFunction && text.startsWith('url(', index) && text[index + 4] !== '"' && text[index + 4] !== "'") {
        const end = text.indexOf(')', index);
        index = end < 0 ? text.length : end + 1;
        lastSignificant = ')';
      } else if (options.regexLiterals && character === '/' && (lastSignificant === '' || REGEX_PRECEDING_CHARACTERS.has(lastSignificant) || REGEX_PRECEDING_WORDS.has(lastWord))) {
        index = skipRegexLiteral(text, index);
        lastSignificant = '/';
        lastWord = '';
      } else if (character === '{') {
        depth += 1;
        lastSignificant = character;
        index += 1;
      } else if (character === '}') {
        if (untilClosingBrace && depth === 0) {
          return index + 1;
        }
        depth -= 1;
        lastSignificant = character;
        index += 1;
      } else if (/\s/.test(character)) {
        index += 1;
      } else if (isWordCharacter(character)) {
        let end = index;
        while (isWordCharacter(text[end])) {
          end += 1;
        }
        lastWord = text.slice(index, end);
        lastSignificant = text.charAt(end - 1);
        index = end;
      } else {
        lastSignificant = character;
        lastWord = '';
        index += 1;
      }
    }
    return text.length;
  }

  scanCode(0, false);
  return found;
}

function isOctaveTranspose(text: string, index: number): boolean {
  const previous = text[index - 1];
  return previous !== undefined && /[A-Za-z0-9_)\]}'.]/.test(previous);
}

function scanOctave(text: string): number[] {
  const found: number[] = [];
  const lines = text.split('\n');
  let offset = 0;
  let inBlock = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (inBlock) {
      found.push(offset);
      if (trimmed === '%}' || trimmed === '#}') {
        inBlock = false;
      }
    } else if (trimmed === '%{' || trimmed === '#{') {
      found.push(offset);
      inBlock = true;
    } else {
      let index = 0;
      while (index < line.length) {
        const character = line.charAt(index);
        if (character === '%' || character === '#') {
          found.push(offset + index);
          break;
        } else if (character === '"') {
          index = skipQuoted(line, index, '"');
        } else if (character === "'" && !isOctaveTranspose(line, index)) {
          index += 1;
          while (index < line.length) {
            if (line[index] === "'" && line[index + 1] === "'") {
              index += 2;
            } else if (line[index] === "'") {
              index += 1;
              break;
            } else {
              index += 1;
            }
          }
        } else {
          index += 1;
        }
      }
    }
    offset += line.length + 1;
  }
  return found;
}

function scanShell(text: string): number[] {
  const found: number[] = [];
  const pendingHeredocs: string[] = [];
  let index = 0;
  let atLineStart = true;
  while (index < text.length) {
    const character = text.charAt(index);
    if (character === '\n') {
      index += 1;
      while (pendingHeredocs.length > 0) {
        const delimiter = pendingHeredocs.shift();
        while (index < text.length) {
          const end = text.indexOf('\n', index);
          const lineEnd = end < 0 ? text.length : end;
          const line = text.slice(index, lineEnd).trim();
          index = Math.min(lineEnd + 1, text.length);
          if (line === delimiter) {
            break;
          }
        }
      }
      atLineStart = true;
    } else if (character === '\\') {
      index += 2;
      atLineStart = false;
    } else if (character === "'") {
      const end = text.indexOf("'", index + 1);
      index = end < 0 ? text.length : end + 1;
      atLineStart = false;
    } else if (character === '"') {
      index += 1;
      while (index < text.length && text[index] !== '"') {
        index += text[index] === '\\' ? 2 : 1;
      }
      index += 1;
      atLineStart = false;
    } else if (character === '#') {
      const previous = text[index - 1];
      const startsComment = atLineStart || previous === undefined || /[\s;&|(]/.test(previous);
      const isShebang = index === 0 && text[1] === '!';
      if (startsComment && !isShebang) {
        found.push(index);
      }
      const end = text.indexOf('\n', index);
      index = end < 0 ? text.length : end;
    } else if (character === '<' && text[index + 1] === '<' && text[index + 2] !== '<') {
      const match = /^<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/.exec(text.slice(index, index + 80));
      if (match) {
        pendingHeredocs.push(match[2] ?? '');
        index += match[0].length;
      } else {
        index += 2;
      }
      atLineStart = false;
    } else {
      if (!/\s/.test(character)) {
        atLineStart = false;
      }
      index += 1;
    }
  }
  return found;
}

function scanMarkup(text: string): number[] {
  const found: number[] = [];
  let index = text.indexOf('<!--');
  while (index >= 0) {
    found.push(index);
    const end = text.indexOf('-->', index + 4);
    index = end < 0 ? -1 : text.indexOf('<!--', end + 3);
  }
  return found;
}

interface HashLineOptions {
  quotes: boolean;
  afterWhitespace: boolean;
}

function scanHashLines(text: string, options: HashLineOptions): number[] {
  const found: number[] = [];
  let offset = 0;
  for (const line of text.split('\n')) {
    let index = 0;
    let quote = '';
    while (index < line.length) {
      const character = line.charAt(index);
      if (quote) {
        if (character === '\\' && quote === '"') {
          index += 1;
        } else if (character === quote) {
          quote = '';
        }
      } else if (options.quotes && (character === '"' || character === "'")) {
        quote = character;
      } else if (character === '#') {
        const previous = line.charAt(index - 1);
        const startsComment = line.slice(0, index).trim() === '' || (options.afterWhitespace && /\s/.test(previous));
        if (startsComment) {
          found.push(offset + index);
          break;
        }
      }
      index += 1;
    }
    offset += line.length + 1;
  }
  return found;
}

const C_LIKE_SCRIPT = { textBlocks: false, templates: true, regexLiterals: true, urlFunction: false };
const C_LIKE_STYLE = { textBlocks: false, templates: false, regexLiterals: false, urlFunction: true };
const C_LIKE_JAVA = { textBlocks: true, templates: false, regexLiterals: false, urlFunction: false };

type Scanner = (text: string) => number[];

const SCANNERS_BY_EXTENSION = new Map<string, Scanner>([
  ['.java', (text) => scanCLike(text, C_LIKE_JAVA)],
  ['.ts', (text) => scanCLike(text, C_LIKE_SCRIPT)],
  ['.mts', (text) => scanCLike(text, C_LIKE_SCRIPT)],
  ['.cts', (text) => scanCLike(text, C_LIKE_SCRIPT)],
  ['.js', (text) => scanCLike(text, C_LIKE_SCRIPT)],
  ['.mjs', (text) => scanCLike(text, C_LIKE_SCRIPT)],
  ['.cjs', (text) => scanCLike(text, C_LIKE_SCRIPT)],
  ['.scss', (text) => scanCLike(text, C_LIKE_STYLE)],
  ['.css', (text) => scanCLike(text, C_LIKE_STYLE)],
  ['.m', scanOctave],
  ['.sh', scanShell],
  ['.bash', scanShell],
  ['.html', scanMarkup],
  ['.htm', scanMarkup],
  ['.xml', scanMarkup],
  ['.svg', scanMarkup],
  ['.yml', (text) => scanHashLines(text, { quotes: true, afterWhitespace: true })],
  ['.yaml', (text) => scanHashLines(text, { quotes: true, afterWhitespace: true })],
  ['.properties', (text) => scanHashLines(text, { quotes: false, afterWhitespace: false })],
  ['.dockerfile', (text) => scanHashLines(text, { quotes: false, afterWhitespace: false })],
]);

function scannerFor(path: string): Scanner | undefined {
  const name = basename(path);
  if (name === 'Dockerfile') {
    return SCANNERS_BY_EXTENSION.get('.dockerfile');
  }
  return SCANNERS_BY_EXTENSION.get(extname(name).toLowerCase());
}

function lineNumberAt(text: string, index: number): number {
  let line = 1;
  for (let position = text.indexOf('\n'); position >= 0 && position < index; position = text.indexOf('\n', position + 1)) {
    line += 1;
  }
  return line;
}

export function findComments(text: string, path: string): number[] {
  const scanner = scannerFor(path);
  if (!scanner) {
    return [];
  }
  const lines = new Set(scanner(text).map((index) => lineNumberAt(text, index)));
  return [...lines].sort((a, b) => a - b);
}

export function findDashes(text: string): number[] {
  const lines: number[] = [];
  text.split('\n').forEach((line, index) => {
    if (DASH_PATTERN.test(line)) {
      lines.push(index + 1);
    }
  });
  return lines;
}

export function isChecked(path: string): boolean {
  if (BINARY_EXTENSIONS.has(extname(path).toLowerCase())) {
    return false;
  }
  return !VENDORED_PATHS.some((pattern) => pattern.test(path));
}

export interface Violation {
  path: string;
  line: number;
  message: string;
}

const ADR_PATH = /^docs\/adr\/\d{4}-[^/]+\.md$/;
const ADR_HEADINGS = ['## Context', '## Decision', '## Alternatives', '## Consequences'];
const PROSE_PATH = /^(README|CREDITS)\.md$|^docs\/.*\.md$/;
const PROCESS_PATTERN = /\bmilestones?\b|\bthe brief\b|\bbrief's\b|\bPLAN\.md\b|\bResume here\b/i;
const THIRD_PERSON_PATTERN = /\bAdrian\b/;
const NULL_RETURN = /\breturn\s+null\s*;/;

export function findMissingAdrHeadings(path: string, text: string): string[] {
  if (!ADR_PATH.test(path) || path.endsWith('/README.md')) {
    return [];
  }
  const headings = new Set(text.split('\n').map((line) => line.trim()));
  return ADR_HEADINGS.filter((heading) => !headings.has(heading));
}

export function findNullReturns(text: string): number[] {
  const lines: number[] = [];
  text.split('\n').forEach((line, index) => {
    if (NULL_RETURN.test(line)) {
      lines.push(index + 1);
    }
  });
  return lines;
}

export function findProcessLanguage(path: string, text: string): number[] {
  if (!PROSE_PATH.test(path)) {
    return [];
  }
  const lines: number[] = [];
  text.split('\n').forEach((line, index) => {
    const withoutPlaceholder = line.replace(/<!--.*?-->/g, '');
    if (PROCESS_PATTERN.test(withoutPlaceholder) || THIRD_PERSON_PATTERN.test(withoutPlaceholder)) {
      lines.push(index + 1);
    }
  });
  return lines;
}

export function findViolations(path: string, text: string): Violation[] {
  const comments = findComments(text, path).map((line) => ({ path, line, message: 'comment in code' }));
  const dashes = findDashes(text).map((line) => ({ path, line, message: 'en or em dash' }));
  const headings = findMissingAdrHeadings(path, text).map((heading) => ({
    path,
    line: 1,
    message: `decision record without the heading ${heading}`,
  }));
  const nullReturns = path.endsWith('.java')
    ? findNullReturns(text).map((line) => ({ path, line, message: 'null returned instead of an Optional' }))
    : [];
  const process = findProcessLanguage(path, text).map((line) => ({
    path,
    line,
    message: 'wording that belongs to how the repository was made',
  }));
  return [...comments, ...dashes, ...headings, ...nullReturns, ...process];
}

function listWorkingTreeFiles(root: string): string[] {
  const output = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return output.split('\0').filter((path) => path !== '' && existsSync(resolve(root, path)));
}

export function checkRepository(root: string): Violation[] {
  const violations: Violation[] = [];
  for (const path of listWorkingTreeFiles(root).filter(isChecked)) {
    const buffer = readFileSync(resolve(root, path));
    if (buffer.includes(0)) {
      continue;
    }
    violations.push(...findViolations(path, buffer.toString('utf8')));
  }
  return violations;
}

function main(): void {
  const root = resolve(fileURLToPath(import.meta.url), '..', '..');
  const violations = checkRepository(root);
  for (const violation of violations) {
    console.error(`${violation.path}:${violation.line}: ${violation.message}`);
  }
  if (violations.length > 0) {
    console.error(`style gate failed: ${violations.length} violation(s)`);
    process.exit(1);
  }
  console.log('style gate passed');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
