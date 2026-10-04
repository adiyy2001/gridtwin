import assert from 'node:assert/strict';
import { test } from 'node:test';
import { controlLines, droppedLine, fpsLine, javaRows, milliseconds } from './bench-summary.ts';

test('milliseconds keep two decimals below ten and one above', () => {
  assert.equal(milliseconds(0.8374), '0.84');
  assert.equal(milliseconds(52.124), '52.1');
});

test('java rows show the median and the 95th percentile', () => {
  const report = { generatedAt: 'now', measurements: [{ name: 'a', statistics: { medianMs: 1.234, p95Ms: 20.55 } }] };
  assert.deepEqual(javaRows(report), ['| a | 1.23 | 20.6 |']);
});

test('the fps line lists every run and the renderer', () => {
  const report = {
    generatedAt: 'now',
    settings: { width: 1920, height: 1080, runs: 2, durationMs: 3000 },
    hardware: { browser: 'chromium', version: '1', renderer: 'GPU' },
    measurements: [
      { averageFps: 59.04, medianFrameMs: 16.7 },
      { averageFps: 43.8, medianFrameMs: 16.7 },
    ],
  };
  assert.match(fpsLine(report), /1920x1080, 2 runs of 3000 ms: 59\.0, 43\.8 fps, median frame 16\.7, 16\.7 ms, renderer GPU/);
});

test('the dropped frame line adds up the runs and shows the GPU time when it was measured', () => {
  const report = {
    generatedAt: 'now',
    settings: { width: 1920, height: 1080, runs: 2, durationMs: 3000 },
    hardware: { browser: 'chromium', version: '1', renderer: 'GPU' },
    measurements: [
      { averageFps: 50, medianFrameMs: 16.7, droppedFrames: 10, frames: 100 },
      { averageFps: 40, medianFrameMs: 16.7, droppedFrames: 30, frames: 100 },
    ],
    summary: { gpuTimePerFrameMs: 6.534 },
  };
  assert.equal(droppedLine(report), '40 of 200 frames dropped (20%), GPU time per frame 6.53 ms');
  assert.equal(droppedLine({ ...report, measurements: [], summary: {} }), null);
});

test('control lines name each control with its fps and dropped frames', () => {
  const report = {
    generatedAt: 'now',
    settings: { width: 1920, height: 1080, runs: 1, durationMs: 3000 },
    hardware: { browser: 'chromium', version: '1', renderer: 'GPU' },
    measurements: [],
    controls: [{ name: 'blank page', averageFps: 59.94, droppedFrames: 1, frames: 600 }],
  };
  assert.deepEqual(controlLines(report), ['control blank page: 59.9 fps, 1 of 600 frames dropped']);
});
