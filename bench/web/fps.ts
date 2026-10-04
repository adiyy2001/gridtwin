import {
  base,
  hardware,
  launch,
  openScene,
  parseOptions,
  percentile,
  printHardware,
  resultName,
  statistics,
  writeResult,
} from './common.ts';
import type { Page } from '../../e2e/scripts/browser.ts';

const options = parseOptions(process.argv.slice(2));
const runs = options.quick ? 1 : 3;
const durationMs = options.quick ? 1000 : options.gpu ? 10000 : 3000;
const width = options.quick ? 960 : 1920;
const height = options.quick ? 540 : 1080;
const droppedFrameMs = 25;
const warmUpMs = 3000;

interface ControlResult {
  name: string;
  frames: number;
  averageFps: number;
  medianFrameMs: number;
  p95FrameMs: number;
  droppedFrames: number;
}

interface ControlSettings {
  canvasWidth: number;
  canvasHeight: number;
  duration: number;
  drawCanvas: boolean;
}

function frameIntervals(settings: ControlSettings): Promise<number[]> {
  return new Promise<number[]>((resolve) => {
    const gl = settings.drawCanvas
      ? document.createElement('canvas').getContext('webgl2', {
          antialias: true,
          depth: true,
          powerPreference: 'high-performance',
        })
      : null;
    if (gl !== null) {
      const canvas = gl.canvas as HTMLCanvasElement;
      canvas.width = settings.canvasWidth;
      canvas.height = settings.canvasHeight;
      Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh' });
      document.body.append(canvas);
    }
    const times: number[] = [];
    const step = (time: number): void => {
      times.push(time);
      if (gl !== null) {
        gl.clearColor(0.4, 0.5, 0.6, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      const first = times[0] ?? time;
      if (time - first < settings.duration) {
        requestAnimationFrame(step);
        return;
      }
      resolve(times.slice(1).map((value, index) => value - (times[index] ?? value)));
    };
    requestAnimationFrame(step);
  });
}

async function measureControl(page: Page, name: string, drawCanvas: boolean): Promise<ControlResult> {
  const intervals = await page.evaluate(frameIntervals, {
    canvasWidth: width,
    canvasHeight: height,
    duration: durationMs,
    drawCanvas,
  });
  const sorted = [...intervals].sort((a, b) => a - b);
  const total = intervals.reduce((sum, value) => sum + value, 0);
  return {
    name,
    frames: intervals.length,
    averageFps: total === 0 ? 0 : (intervals.length / total) * 1000,
    medianFrameMs: percentile(sorted, 0.5),
    p95FrameMs: percentile(sorted, 0.95),
    droppedFrames: intervals.filter((interval) => interval > droppedFrameMs).length,
  };
}

function describeControl(control: ControlResult): string {
  return `control ${control.name}: ${control.frames} frames, ${control.averageFps.toFixed(1)} fps, median ${control.medianFrameMs.toFixed(1)} ms, p95 ${control.p95FrameMs.toFixed(1)} ms, ${control.droppedFrames} dropped`;
}

const browser = await launch(options);
try {
  const { context, page } = await openScene(browser, { width: 1920, height: 1200 });
  const info = await hardware(browser, page);
  printHardware(info);
  const measureScene = (settings: GridtwinFrameMeasureOptions): Promise<GridtwinFrameMeasurement> =>
    page.evaluate((input) => {
      const scene = window.__gridtwin?.scene;
      if (scene === undefined) {
        throw new Error('the 3D scene hook is missing');
      }
      return scene.measureFrames(input);
    }, settings);

  const beforeControls: ControlResult[] = [await measureControl(page, 'application page, scene idle', false)];
  const controlPage = await context.newPage();
  await controlPage.goto('about:blank');
  beforeControls.push(await measureControl(controlPage, 'blank page', false));
  beforeControls.push(await measureControl(controlPage, 'empty WebGL canvas', true));
  beforeControls.forEach((control) => {
    console.log(describeControl(control));
  });
  await page.bringToFront();
  await measureScene({ width, height, durationMs: warmUpMs });
  const measurements: GridtwinFrameMeasurement[] = [];
  for (let run = 0; run < runs; run += 1) {
    const result = await measureScene({ width, height, durationMs });
    measurements.push(result);
    console.log(
      `run ${run + 1}: ${result.frames} frames at ${result.width}x${result.height}, ${result.averageFps.toFixed(1)} fps, median ${result.medianFrameMs.toFixed(1)} ms, p95 ${result.p95FrameMs.toFixed(1)} ms, ${result.droppedFrames} dropped, render call ${result.medianRenderCallMs.toFixed(2)} ms, ${result.drawCalls} draw calls, ${result.triangles} triangles`,
    );
  }

  const timed = await measureScene({ width, height, durationMs: Math.min(durationMs, 3000), gpuTiming: true });
  console.log(
    timed.medianGpuMs === null
      ? 'gpu time: the browser offers no timer query'
      : `gpu time per frame: median ${timed.medianGpuMs.toFixed(2)} ms (timer queries slow the loop to ${timed.averageFps.toFixed(1)} fps, so this run is not an fps result)`,
  );

  await controlPage.bringToFront();
  const controls = [...beforeControls];
  controls.push(await measureControl(controlPage, 'empty WebGL canvas, after the scene runs', true));
  controls.slice(beforeControls.length).forEach((control) => {
    console.log(describeControl(control));
  });
  await controlPage.close();

  const fps = measurements.map((entry) => entry.averageFps).sort((a, b) => a - b);
  const frameTimes = measurements.map((entry) => entry.medianFrameMs);
  const frames = measurements.reduce((sum, entry) => sum + entry.frames, 0);
  const droppedFrames = measurements.reduce((sum, entry) => sum + entry.droppedFrames, 0);
  const file = writeResult(resultName('web-fps', options), {
    suite: 'web-fps',
    generatedAt: new Date().toISOString(),
    url: base,
    hardware: info,
    settings: { runs, durationMs, warmUpMs, width, height, droppedFrameMs, gpu: options.gpu },
    definition:
      'continuous orbit of the camera around the substation, one render per animation frame, frame intervals from requestAnimationFrame timestamps, a frame counts as dropped when it took longer than droppedFrameMs',
    target: 'at least 60 fps at 1920x1080 on an integrated GPU, confirm with tools/bench.sh web --gpu on the target machine',
    summary: {
      medianFps: fps[Math.floor(fps.length / 2)] ?? 0,
      frameTime: statistics(frameTimes),
      frames,
      droppedFrames,
      droppedShare: frames === 0 ? 0 : droppedFrames / frames,
      gpuTimePerFrameMs: timed.medianGpuMs,
    },
    controls,
    measurements,
  });
  console.log(`wrote ${file}`);
  await context.close();
} finally {
  await browser.close();
}
