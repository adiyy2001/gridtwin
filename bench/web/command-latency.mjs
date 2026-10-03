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
} from './common.mjs';

const options = parseOptions(process.argv.slice(2));
const warmupRuns = options.quick ? 2 : 5;
const measuredRuns = options.quick ? 8 : 40;
const switchId = 'L3-4.QA1';

async function operateOnce(page, expected, withScene) {
  const before = await page.evaluate(() => window.__gridtwin.latencies.length);
  await page.locator(`[data-sld-switch="${switchId}"]`).click();
  await page.locator('[data-action="confirm"]').click();
  await page.waitForFunction((count) => window.__gridtwin.latencies.length > count, before);
  await page.locator(`[data-sld-switch="${switchId}"][data-position="${expected}"]`).waitFor();
  if (withScene) {
    await page.waitForFunction(
      ([id, position]) =>
        window.__gridtwin.scene.describe().items.find((item) => item.id === id)?.position === position,
      [switchId, expected],
    );
    await page.waitForFunction(() => !window.__gridtwin.scene.describe().animating);
  }
  return page.evaluate(() => window.__gridtwin.latencies.at(-1));
}

async function measure(browser, name, withScene) {
  const { context, page } = await openScene(browser, { width: 1440, height: 1000 }, withScene);
  const info = await hardware(browser, page);
  printHardware(info);
  const samples = [];
  let expected = 'OPEN';
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
