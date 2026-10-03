import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import lighthouse from 'lighthouse';

const here = dirname(fileURLToPath(import.meta.url));
const base = process.env.GRIDTWIN_BASE_URL ?? 'http://127.0.0.1:18480';
const threshold = Number(process.env.GRIDTWIN_A11Y_MIN ?? '0.95');
const outputDirectory = resolve(here, 'out');

function freePort() {
  return new Promise((done, fail) => {
    const probe = createServer();
    probe.once('error', fail);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => done(port));
    });
  });
}

async function waitForDebugger(port) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) {
        return;
      }
    } catch {
      await new Promise((done) => setTimeout(done, 200));
    }
  }
  throw new Error('chrome did not open its debugging port');
}

const profileDirectory = mkdtempSync(resolve(tmpdir(), 'gridtwin-lighthouse-'));
const debuggingPort = await freePort();
const chrome = spawn(
  process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    `--remote-debugging-port=${debuggingPort}`,
    `--user-data-dir=${profileDirectory}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

try {
  await waitForDebugger(debuggingPort);
  const result = await lighthouse(
    base,
    { port: debuggingPort, output: 'json', onlyCategories: ['accessibility'], logLevel: 'error' },
    undefined,
  );
  const report = result?.lhr;
  if (!report) {
    throw new Error('lighthouse returned no report');
  }
  const score = report.categories.accessibility?.score ?? 0;
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(resolve(outputDirectory, 'accessibility.json'), JSON.stringify(report, null, 2));
  const failing = Object.values(report.audits).filter(
    (audit) => audit.scoreDisplayMode === 'binary' && audit.score === 0,
  );
  console.log(`lighthouse ${report.lighthouseVersion} on ${report.environment.hostUserAgent}`);
  console.log(`accessibility score ${Math.round(score * 100)} for ${base}`);
  for (const audit of failing) {
    console.log(`failing audit: ${audit.id}: ${audit.title}`);
  }
  if (score < threshold) {
    console.error(`score is below ${Math.round(threshold * 100)}`);
    process.exitCode = 1;
  }
} finally {
  const closed = new Promise((done) => chrome.once('exit', done));
  chrome.kill('SIGTERM');
  await closed;
  rmSync(profileDirectory, { recursive: true, force: true });
}
