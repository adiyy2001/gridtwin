import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RESULTS = resolve(ROOT, 'bench/results');

export interface Statistics {
  medianMs: number;
  p95Ms: number;
}

export interface Measurement {
  name: string;
  statistics: Statistics;
}

export interface MeasurementReport {
  generatedAt: string;
  measurements: Measurement[];
}

export interface JavaHardware {
  cpuModel: string;
  logicalCores: number;
  physicalMemoryMegabytes: number;
  operatingSystem: string;
  jvm: string;
}

export interface JavaReport extends MeasurementReport {
  hardware: JavaHardware;
  settings: { warmupRuns: number; measuredRuns: number };
}

export interface WebHardware {
  browser: string;
  version: string;
  renderer: string;
}

export interface WebLatencyReport extends MeasurementReport {
  hardware: WebHardware;
}

export interface FpsMeasurement {
  averageFps: number;
  medianFrameMs: number;
}

export interface FpsReport {
  generatedAt: string;
  hardware: WebHardware;
  settings: { width: number; height: number; runs: number; durationMs: number };
  measurements: FpsMeasurement[];
}

export function milliseconds(value: number): string {
  return value.toFixed(value < 10 ? 2 : 1);
}

export function javaRows(report: MeasurementReport): string[] {
  return report.measurements.map(
    (entry) => `| ${entry.name} | ${milliseconds(entry.statistics.medianMs)} | ${milliseconds(entry.statistics.p95Ms)} |`,
  );
}

export function latencyRows(report: MeasurementReport): string[] {
  return report.measurements.map(
    (entry) => `| ${entry.name} | ${milliseconds(entry.statistics.medianMs)} | ${milliseconds(entry.statistics.p95Ms)} |`,
  );
}

export function fpsLine(report: FpsReport): string {
  const runs = report.measurements.map((entry) => entry.averageFps.toFixed(1)).join(', ');
  const frame = report.measurements.map((entry) => entry.medianFrameMs.toFixed(1)).join(', ');
  return `${report.settings.width}x${report.settings.height}, ${report.settings.runs} runs of ${report.settings.durationMs} ms: ${runs} fps, median frame ${frame} ms, renderer ${report.hardware.renderer}`;
}

function read(name: string): unknown {
  const path = resolve(RESULTS, `${name}.json`);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

function printWebHeader(name: string, report: { generatedAt: string; hardware: WebHardware }): void {
  console.log(`${name}, ${report.generatedAt}, ${report.hardware.browser} ${report.hardware.version}, ${report.hardware.renderer}`);
}

function main(): void {
  const java = read('java') as JavaReport | null;
  if (java !== null) {
    const hardware = java.hardware;
    console.log(`java, ${java.generatedAt}`);
    console.log(`${hardware.cpuModel}, ${hardware.logicalCores} logical cores, ${hardware.physicalMemoryMegabytes} MB, ${hardware.operatingSystem}, ${hardware.jvm}`);
    console.log(`${java.settings.warmupRuns} warm-up runs, ${java.settings.measuredRuns} measured runs`);
    console.log('| measurement | median ms | p95 ms |');
    javaRows(java).forEach((row) => { console.log(row); });
    console.log('');
  }
  ['web-command-latency', 'web-command-latency-gpu'].forEach((name) => {
    const report = read(name) as WebLatencyReport | null;
    if (report !== null) {
      printWebHeader(name, report);
      console.log('| measurement | median ms | p95 ms |');
      latencyRows(report).forEach((row) => { console.log(row); });
      console.log('');
    }
  });
  ['web-fps', 'web-fps-gpu'].forEach((name) => {
    const report = read(name) as FpsReport | null;
    if (report !== null) {
      printWebHeader(name, report);
      console.log(fpsLine(report));
      console.log('');
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
