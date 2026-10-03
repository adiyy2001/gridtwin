import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, totalmem, platform, release, arch } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeBrowser, launchChrome, launchGpuChrome, webglArguments } from '../../e2e/scripts/browser.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const resultsDirectory = resolve(here, '..', 'results');
export const base = process.env.GRIDTWIN_BASE_URL ?? 'http://127.0.0.1:18480';

export function parseOptions(argv) {
  const options = { quick: false, gpu: false };
  for (const argument of argv) {
    if (argument === '--quick') {
      options.quick = true;
    } else if (argument === '--gpu') {
      options.gpu = true;
    } else {
      throw new Error(`unknown option ${argument}`);
    }
  }
  return options;
}

export function launch(options) {
  return options.gpu ? launchGpuChrome() : launchChrome(webglArguments);
}

export function percentile(sorted, fraction) {
  if (sorted.length === 0) {
    return 0;
  }
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

export function statistics(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);
  return {
    samples: sorted.length,
    medianMs: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    meanMs: sorted.length === 0 ? 0 : sum / sorted.length,
    minMs: sorted[0] ?? 0,
    maxMs: sorted[sorted.length - 1] ?? 0,
  };
}

export async function hardware(browser, page) {
  const cpu = cpus();
  return {
    cpuModel: cpu[0]?.model ?? 'unknown',
    logicalCores: cpu.length,
    physicalMemoryMegabytes: Math.round(totalmem() / (1024 * 1024)),
    operatingSystem: `${platform()} ${release()} (${arch()})`,
    node: process.version,
    ...(await describeBrowser(browser, page)),
  };
}

export function launchWithoutWebgl() {
  return launchChrome(['--no-sandbox', '--disable-gpu', '--disable-3d-apis']);
}

export async function openScene(browser, viewport = { width: 1440, height: 1000 }, withScene = true) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(base);
  await page.locator('[data-scene-canvas]').waitFor();
  await page.waitForFunction(
    (expectWebgl) => {
      const description = window.__gridtwin?.scene?.describe();
      return description !== undefined && description.webgl === expectWebgl && !description.animating;
    },
    withScene,
  );
  return { context, page };
}

export function resultName(name, options) {
  return options.gpu ? `${name}-gpu` : name;
}

export function writeResult(name, report) {
  mkdirSync(resultsDirectory, { recursive: true });
  const file = resolve(resultsDirectory, `${name}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}

export function printHardware(info) {
  console.log(`browser   ${info.browser} ${info.version}`);
  console.log(`renderer  ${info.renderer}`);
  console.log(`cpu       ${info.cpuModel}, ${info.logicalCores} logical cores`);
  console.log(`memory    ${info.physicalMemoryMegabytes} MB, ${info.operatingSystem}`);
}
