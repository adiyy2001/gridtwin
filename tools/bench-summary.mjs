import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RESULTS = resolve(ROOT, 'bench/results');

export function milliseconds(value) {
  return value.toFixed(value < 10 ? 2 : 1);
}

export function javaRows(report) {
  return report.measurements.map(
    (entry) => `| ${entry.name} | ${milliseconds(entry.statistics.medianMs)} | ${milliseconds(entry.statistics.p95Ms)} |`,
  );
}

export function latencyRows(report) {
  return report.measurements.map(
    (entry) => `| ${entry.name} | ${milliseconds(entry.statistics.medianMs)} | ${milliseconds(entry.statistics.p95Ms)} |`,
  );
}

export function fpsLine(report) {
  const runs = report.measurements.map((entry) => entry.averageFps.toFixed(1)).join(', ');
  const frame = report.measurements.map((entry) => entry.medianFrameMs.toFixed(1)).join(', ');
  return `${report.settings.width}x${report.settings.height}, ${report.settings.runs} runs of ${report.settings.durationMs} ms: ${runs} fps, median frame ${frame} ms, renderer ${report.hardware.renderer}`;
}

function read(name) {
  const path = resolve(RESULTS, `${name}.json`);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

function main() {
  const java = read('java');
  if (java !== null) {
    const hardware = java.hardware;
    console.log(`java, ${java.generatedAt}`);
    console.log(`${hardware.cpuModel}, ${hardware.logicalCores} logical cores, ${hardware.physicalMemoryMegabytes} MB, ${hardware.operatingSystem}, ${hardware.jvm}`);
    console.log(`${java.settings.warmupRuns} warm-up runs, ${java.settings.measuredRuns} measured runs`);
    console.log('| measurement | median ms | p95 ms |');
    javaRows(java).forEach((row) => console.log(row));
    console.log('');
  }
  ['web-command-latency', 'web-command-latency-gpu', 'web-fps', 'web-fps-gpu'].forEach((name) => {
    const report = read(name);
    if (report === null) {
      return;
    }
    console.log(`${name}, ${report.generatedAt}, ${report.hardware.browser} ${report.hardware.version}, ${report.hardware.renderer}`);
    if (name.includes('latency')) {
      console.log('| measurement | median ms | p95 ms |');
      latencyRows(report).forEach((row) => console.log(row));
    } else {
      console.log(fpsLine(report));
    }
    console.log('');
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
