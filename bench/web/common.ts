import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, totalmem, platform, release, arch } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeBrowser, launchChrome, launchGpuChrome, webglArguments } from '../../e2e/scripts/browser.ts';
import type { Browser, BrowserContext, BrowserDescription, Page, ViewportSize } from '../../e2e/scripts/browser.ts';

const here = dirname(fileURLToPath(import.meta.url));
export const resultsDirectory = resolve(here, '..', 'results');
export const base = process.env.GRIDTWIN_BASE_URL ?? 'http://127.0.0.1:18480';

export interface BenchOptions {
  quick: boolean;
  gpu: boolean;
}

export function parseOptions(argv: string[]): BenchOptions {
  const options: BenchOptions = { quick: false, gpu: false };
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

export function launch(options: BenchOptions): Promise<Browser> {
  return options.gpu ? launchGpuChrome() : launchChrome(webglArguments);
}

export function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
}

export interface SampleStatistics {
  samples: number;
  medianMs: number;
  p95Ms: number;
  meanMs: number;
  minMs: number;
  maxMs: number;
}

export function statistics(samples: number[]): SampleStatistics {
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

export interface Hardware extends BrowserDescription {
  cpuModel: string;
  physicalMemoryMegabytes: number;
  operatingSystem: string;
  node: string;
}

export async function hardware(browser: Browser, page: Page): Promise<Hardware> {
  const cpu = cpus();
  return {
    cpuModel: cpu[0]?.model ?? 'unknown',
    physicalMemoryMegabytes: Math.round(totalmem() / (1024 * 1024)),
    operatingSystem: `${platform()} ${release()} (${arch()})`,
    node: process.version,
    ...(await describeBrowser(browser, page)),
  };
}

export function launchWithoutWebgl(): Promise<Browser> {
  return launchChrome(['--no-sandbox', '--disable-gpu', '--disable-3d-apis']);
}

export async function openScene(
  browser: Browser,
  viewport: ViewportSize = { width: 1440, height: 1000 },
  withScene = true,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(base);
  await page.locator('[data-scene-canvas]').waitFor();
  await page.waitForFunction(
    (expectWebgl: boolean) => {
      const description = window.__gridtwin?.scene?.describe();
      if (description === undefined) {
        return false;
      }
      return description.webgl === expectWebgl && !description.animating;
    },
    withScene,
  );
  return { context, page };
}

export function resultName(name: string, options: BenchOptions): string {
  return options.gpu ? `${name}-gpu` : name;
}

export function writeResult(name: string, report: object): string {
  mkdirSync(resultsDirectory, { recursive: true });
  const file = resolve(resultsDirectory, `${name}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}

export function printHardware(info: Hardware): void {
  console.log(`browser   ${info.browser} ${info.version}`);
  console.log(`renderer  ${info.renderer}`);
  console.log(`cpu       ${info.cpuModel}, ${info.logicalCores} logical cores`);
  console.log(`memory    ${info.physicalMemoryMegabytes} MB, ${info.operatingSystem}`);
}
