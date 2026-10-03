import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AxeBuilder } from '@axe-core/playwright';
import { launchChrome } from '../scripts/browser.ts';
import type { Page } from '../scripts/browser.ts';

const here = dirname(fileURLToPath(import.meta.url));
const base = process.env.GRIDTWIN_BASE_URL ?? 'http://127.0.0.1:18480';
const outputDirectory = resolve(here, 'out');
const blocking = new Set(['serious', 'critical']);
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

async function operate(page: Page, switchId: string): Promise<void> {
  await page.locator(`[data-sld-switch="${switchId}"]`).click();
  await page.locator('[data-action="confirm"]').click();
  await page.locator('[data-testid="notice"]').filter({ hasNotText: 'Ready' }).waitFor();
}

interface Scenario {
  name: string;
  prepare?: (page: Page) => Promise<void>;
}

interface ViolationSummary {
  id: string;
  impact: string | null | undefined;
  help: string;
  nodes: string[];
}

const scenarios: Scenario[] = [
  {
    name: 'application shell with the diagram',
  },
  {
    name: 'confirmation dialog',
    prepare: async (page) => {
      await page.locator('[data-sld-switch="L3-4.QA1"]').click();
      await page.locator('[data-action="confirm"]').waitFor();
    },
  },
  {
    name: 'refused operation shown in the inspector',
    prepare: async (page) => {
      await operate(page, 'L3-4.QB1');
      await page.locator('[data-testid="refusal"]').waitFor();
    },
  },
  {
    name: 'bus coupler open, overloaded line and selected switch',
    prepare: async (page) => {
      await operate(page, 'CPL.QA1');
      await page.locator('[data-sld-terminal="L2-4"].overloaded').waitFor();
      await page.locator('[data-sld-switch="CPL.QB1"]').focus();
      await page.keyboard.press('Escape');
    },
  },
  {
    name: '3D scene with a selected switch and a focused camera',
    prepare: async (page) => {
      await page.locator('[data-scene-canvas]').waitFor();
      await page.waitForFunction(() => window.__gridtwin?.scene?.describe().webgl === true);
      await page.locator('[data-sld-switch="L3-4.QA1"]').click();
      await page.locator('[data-action="cancel"]').click();
      await page.locator('[data-action="focus-selection"]').click();
    },
  },
  {
    name: 'N-1 table and cascade replay',
    prepare: async (page) => {
      await page.locator('[data-action="run-n1"]').click();
      await page.locator('[data-testid="n1-table"] tr.contingency').first().waitFor();
      await page.locator('[data-action="run-cascade"]').click();
      await page.locator('[data-testid="cascade-result"]').waitFor();
    },
  },
];

const browser = await launchChrome();
const report: { scenario: string; checked: number; violations: ViolationSummary[] }[] = [];
let blockingCount = 0;

try {
  for (const scenario of scenarios) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    await page.goto(base);
    await page.locator('[data-sld-switch]').first().waitFor();
    await scenario.prepare?.(page);
    const result = await new AxeBuilder({ page }).withTags(tags).analyze();
    const violations = result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node) => node.target.join(' ')),
    }));
    const failing = violations.filter((violation) => violation.impact != null && blocking.has(violation.impact));
    blockingCount += failing.length;
    report.push({ scenario: scenario.name, checked: result.passes.length, violations });
    console.log(
      `${failing.length === 0 ? 'ok  ' : 'FAIL'} ${scenario.name}: ${result.passes.length} rules passed, ${violations.length} violations (${failing.length} serious or critical)`,
    );
    violations.forEach((violation) => {
      console.log(`     ${violation.impact} ${violation.id}: ${violation.help} (${violation.nodes.length} nodes)`);
    });
    await context.close();
  }
} finally {
  await browser.close();
}

mkdirSync(outputDirectory, { recursive: true });
writeFileSync(resolve(outputDirectory, 'axe.json'), JSON.stringify(report, null, 2));
process.exit(blockingCount === 0 ? 0 : 1);
