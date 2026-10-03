import { base, hardware, launch, openScene, parseOptions, printHardware, resultName, statistics, writeResult } from './common.mjs';

const options = parseOptions(process.argv.slice(2));
const runs = options.quick ? 1 : 3;
const durationMs = options.quick ? 1000 : 3000;
const width = options.quick ? 960 : 1920;
const height = options.quick ? 540 : 1080;

const browser = await launch(options);
try {
  const { context, page } = await openScene(browser, { width: 1920, height: 1200 });
  const info = await hardware(browser, page);
  printHardware(info);
  const measurements = [];
  for (let run = 0; run < runs; run += 1) {
    const result = await page.evaluate(
      (settings) => window.__gridtwin.scene.measureFrames(settings),
      { width, height, durationMs },
    );
    measurements.push(result);
    console.log(
      `run ${run + 1}: ${result.frames} frames at ${result.width}x${result.height}, ${result.averageFps.toFixed(1)} fps, median ${result.medianFrameMs.toFixed(1)} ms, p95 ${result.p95FrameMs.toFixed(1)} ms`,
    );
  }
  const fps = measurements.map((entry) => entry.averageFps).sort((a, b) => a - b);
  const frameTimes = measurements.map((entry) => entry.medianFrameMs);
  const file = writeResult(resultName('web-fps', options), {
    suite: 'web-fps',
    generatedAt: new Date().toISOString(),
    url: base,
    hardware: info,
    settings: { runs, durationMs, width, height, gpu: options.gpu },
    definition:
      'continuous orbit of the camera around the substation, one render per animation frame, frame intervals from requestAnimationFrame timestamps',
    target: 'at least 60 fps at 1920x1080 on an integrated GPU, confirm with tools/bench.sh web --gpu on the target machine',
    summary: { medianFps: fps[Math.floor(fps.length / 2)], frameTime: statistics(frameTimes) },
    measurements,
  });
  console.log(`wrote ${file}`);
  await context.close();
} finally {
  await browser.close();
}
