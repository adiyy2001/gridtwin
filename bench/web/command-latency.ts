import {
  base,
  hardware,
  launch,
  launchWithoutWebgl,
  openScene,
  parseOptions,
  printHardware,
  statistics,
  resultName,
  writeResult,
} from './common.ts';
import type { Browser, Page } from '../../e2e/scripts/browser.ts';
import type { Hardware, SampleStatistics } from './common.ts';

const options = parseOptions(process.argv.slice(2));
const warmupRuns = options.quick ? 2 : 5;
const measuredRuns = options.quick ? 8 : 40;
const switchId = 'L3-4.QA1';

type Position = 'OPEN' | 'CLOSED';

interface Measurement {
  name: string;
  withScene: boolean;
  statistics: SampleStatistics;
  samplesMs: number[];
}

async function operateOnce(page: Page, expected: Position, withScene: boolean): Promise<number> {
  const before = await page.evaluate(() => window.__gridtwin?.latencies.length ?? 0);
  await page.locator(`[data-sld-switch="${switchId}"]`).click();
  await page.locator('[data-action="confirm"]').click();
  await page.waitForFunction((count: number) => (window.__gridtwin?.latencies.length ?? 0) > count, before);
  await page.locator(`[data-sld-switch="${switchId}"][data-position="${expected}"]`).waitFor();
  if (withScene) {
    await page.waitForFunction(
      ({ id, position }: { id: string; position: Position }) =>
        window.__gridtwin?.scene?.describe().items.find((item) => item.id === id)?.position === position,
      { id: switchId, position: expected },
    );
    await page.waitForFunction(() => window.__gridtwin?.scene?.describe().animating === false);
  }
  const latency = await page.evaluate(() => window.__gridtwin?.latencies.at(-1));
  if (latency === undefined) {
    throw new Error('no command latency was recorded');
  }
  return latency;
}

async function measure(
  browser: Browser,
  name: string,
  withScene: boolean,
): Promise<{ info: Hardware; measurement: Measurement }> {
  const { context, page } = await openScene(browser, { width: 1440, height: 1000 }, withScene);
  const info = await hardware(browser, page);
  printHardware(info);
  const samples: number[] = [];
  let expected: Position = 'OPEN';
  for (let run = 0; run < warmupRuns + measuredRuns; run += 1) {
    const latency = await operateOnce(page, expected, withScene);
    expected = expected === 'OPEN' ? 'CLOSED' : 'OPEN';
    if (run >= warmupRuns) {
      samples.push(latency);
    }
  }
  const stats = statistics(samples);
  console.log(
    `${name}, ${stats.samples} runs: median ${stats.medianMs.toFixed(1)} ms, p95 ${stats.p95Ms.toFixed(1)} ms, max ${stats.maxMs.toFixed(1)} ms`,
  );
  await context.close();
  return { info, measurement: { name, withScene, statistics: stats, samplesMs: samples } };
}

const withSceneBrowser = await launch(options);
const withoutSceneBrowser = await launchWithoutWebgl();
try {
  const withScene = await measure(withSceneBrowser, 'command to rendered frame with the 3D scene', true);
  const withoutScene = await measure(withoutSceneBrowser, 'command to rendered frame, 3D scene unavailable', false);
  const file = writeResult(resultName('web-command-latency', options), {
    suite: 'web-command-latency',
    generatedAt: new Date().toISOString(),
    url: base,
    hardware: withScene.info,
    settings: { warmupRuns, measuredRuns, switchId, viewport: '1440x1000', gpu: options.gpu },
    definition:
      'time from the confirm click to the second animation frame after the new state is applied, including the server round trip and the redraw of the diagram and, when available, the 3D scene',
    target: 'under 100 ms',
    measurements: [withScene.measurement, withoutScene.measurement],
  });
  console.log(`wrote ${file}`);
} finally {
  await withSceneBrowser.close();
  await withoutSceneBrowser.close();
}
