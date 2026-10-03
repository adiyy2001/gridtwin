import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome } from '../scripts/browser.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const base = process.env.GRIDTWIN_BASE_URL ?? 'http://127.0.0.1:18480';
const outputDirectory = resolve(here, 'out');
const minimumCoverage = 0.2;

async function sceneDescription(page) {
  return page.evaluate(() => window.__gridtwin.scene.describe());
}

async function settle(page) {
  await page.waitForFunction(() => {
    const description = window.__gridtwin?.scene?.describe();
    return description !== undefined && description.webgl && !description.animating;
  });
  await page.waitForTimeout(150);
}

async function confirm(page) {
  await page.locator('[data-action="confirm"]').click();
  await page.locator('[data-testid="notice"]').filter({ hasNotText: 'Ready' }).waitFor();
  await settle(page);
}

async function operateInDiagram(page, switchId) {
  await page.locator(`[data-sld-switch="${switchId}"]`).click();
  await confirm(page);
}

async function clickInScene(page, equipmentId) {
  const point = await page.evaluate((id) => window.__gridtwin.scene.screenPointOf(id), equipmentId);
  if (point === null) {
    throw new Error(`no screen position for ${equipmentId}`);
  }
  await page.mouse.click(point.clientX, point.clientY);
}

const scenarios = [
  { name: 'all-closed', focus: 'L3-4.QA1', prepare: async () => {} },
  {
    name: 'coupler-open',
    focus: 'CPL.QA1',
    prepare: async (page) => {
      await operateInDiagram(page, 'CPL.QA1');
      await page.locator('[data-sld-terminal="L2-4"].overloaded').waitFor();
      await settle(page);
    },
  },
  {
    name: 'line-breaker-open-from-scene',
    focus: 'L3-4.QA1',
    prepare: async (page) => {
      await clickInScene(page, 'L3-4.QA1');
      await confirm(page);
    },
  },
  {
    name: 'selection',
    focus: 'terminal:L4-5',
    prepare: async (page) => {
      await page.locator('.kind-switch button', { hasText: 'Branches' }).click();
      await page.locator('[data-entry="branch-L4-5"]').click();
      await settle(page);
    },
  },
  {
    name: 'earthing-closed',
    focus: 'CPL.QE1',
    prepare: async (page) => {
      await operateInDiagram(page, 'CPL.QA1');
      await operateInDiagram(page, 'CPL.QB1');
      await operateInDiagram(page, 'CPL.QE1');
    },
  },
];

mkdirSync(outputDirectory, { recursive: true });
const browser = await launchChrome();
const results = [];
let failures = 0;

function check(condition, message) {
  if (!condition) {
    failures += 1;
    console.log(`FAIL ${message}`);
  }
}

try {
  for (const [index, scenario] of scenarios.entries()) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const consoleProblems = [];
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        consoleProblems.push(message.text());
      }
    });
    await page.goto(base);
    await page.locator('[data-scene-canvas]').waitFor();
    await settle(page);
    await scenario.prepare(page);
    await settle(page);
    const stats = await page.evaluate(() => window.__gridtwin.scene.frameStats());
    const description = await sceneDescription(page);
    const file = `${String(index + 1).padStart(2, '0')}-${scenario.name}.png`;
    await page.locator('gt-scene').screenshot({ path: resolve(outputDirectory, file) });
    await page.evaluate((id) => window.__gridtwin.scene.focusOn(id), scenario.focus);
    await settle(page);
    await page.locator('gt-scene').screenshot({ path: resolve(outputDirectory, file.replace('.png', '-close.png')) });
    results.push({ scenario: scenario.name, file, stats, description });
    check(stats !== null && stats.nonBackgroundRatio >= minimumCoverage, `${scenario.name}: the frame is mostly empty`);
    check(consoleProblems.length === 0, `${scenario.name}: console problems ${consoleProblems.join(' | ')}`);
    console.log(
      `${scenario.name}: ${stats?.width}x${stats?.height}, ${(100 * (stats?.nonBackgroundRatio ?? 0)).toFixed(1)}% drawn, hash ${stats?.hash}, renderer ${stats?.renderer}`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}

const hashes = results.map((entry) => entry.stats?.hash);
check(new Set(hashes).size === hashes.length, 'every state must render a different frame');
const positionOf = (result, id) => result.description.items.find((item) => item.id === id)?.position;
check(positionOf(results[0], 'CPL.QA1') === 'CLOSED', 'the coupler starts closed');
check(positionOf(results[1], 'CPL.QA1') === 'OPEN', 'the coupler opens');
check(positionOf(results[2], 'L3-4.QA1') === 'OPEN', 'a click in the scene opens the line breaker');
check(
  results[3].description.items.some((item) => item.id === 'terminal:L4-5' && item.selected),
  'selecting a branch marks its terminal in the scene',
);
check(
  results[4].description.items.some((item) => item.id === 'CPL.QE1' && item.condition === 'EARTHED'),
  'the earthing switch shows as earthed',
);

writeFileSync(resolve(outputDirectory, 'visual.json'), JSON.stringify(results, null, 2));
process.exit(failures === 0 ? 0 : 1);
