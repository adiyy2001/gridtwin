import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface Deviation {
  voltagePu: number;
  angleDegrees: number;
  flowMw: number;
}

export interface BaseCaseDeviation extends Deviation {
  case: string;
}

export interface ContingencyDeviation extends Deviation {
  case: string;
  reactiveLimits: boolean;
  outagesCompared: number;
}

export interface ValidationReport {
  reference: string;
  environment: { jvm: string; operatingSystem: string; logicalCores: number };
  tolerances: Deviation;
  baseCases: BaseCaseDeviation[];
  contingencies: ContingencyDeviation[];
  worstOverall: Deviation;
}

export function scientific(value: number): string {
  return value.toExponential(2);
}

export function summarise(report: ValidationReport): string {
  const lines: string[] = [];
  lines.push(`reference: ${report.reference}`);
  lines.push(`jvm: ${report.environment.jvm}, ${report.environment.operatingSystem}, ${report.environment.logicalCores} logical cores`);
  lines.push('');
  lines.push('base cases (load factors 0.5, 1.0, 1.2 and 1.5, with and without reactive limits)');
  ['ieee14', 'ieee30'].forEach((caseId) => {
    const sets = report.baseCases.filter((entry) => entry.case === caseId);
    lines.push(
      `  ${caseId}: ${sets.length} solutions, worst voltage ${scientific(Math.max(...sets.map((entry) => entry.voltagePu)))} pu, ` +
        `worst angle ${scientific(Math.max(...sets.map((entry) => entry.angleDegrees)))} deg, ` +
        `worst flow ${scientific(Math.max(...sets.map((entry) => entry.flowMw)))} MW`,
    );
  });
  lines.push('');
  lines.push('N-1 outages (one solution per branch and per generator that MATPOWER solves)');
  report.contingencies.forEach((entry) => {
    const variant = entry.reactiveLimits ? 'with reactive limits' : 'without reactive limits';
    lines.push(
      `  ${entry.case} ${variant}: ${entry.outagesCompared} outages, worst voltage ${scientific(entry.voltagePu)} pu, ` +
        `worst angle ${scientific(entry.angleDegrees)} deg, worst flow ${scientific(entry.flowMw)} MW`,
    );
  });
  lines.push('');
  lines.push(
    `worst of all: voltage ${scientific(report.worstOverall.voltagePu)} pu (limit ${scientific(report.tolerances.voltagePu)}), ` +
      `angle ${scientific(report.worstOverall.angleDegrees)} deg (limit ${scientific(report.tolerances.angleDegrees)}), ` +
      `flow ${scientific(report.worstOverall.flowMw)} MW (limit ${scientific(report.tolerances.flowMw)})`,
  );
  return lines.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = process.argv[2] ?? 'validation/target/validation-report.json';
  console.log(summarise(JSON.parse(readFileSync(path, 'utf8')) as ValidationReport));
}
