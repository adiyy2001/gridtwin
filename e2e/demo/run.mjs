import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome } from '../scripts/browser.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const base = process.env.GRIDTWIN_BASE_URL ?? 'http://127.0.0.1:18480';
const outputDirectory = resolve(here, 'out');
const viewport = { width: 1280, height: 800 };
const pause = Number(process.env.GRIDTWIN_DEMO_PAUSE_MS ?? '1200');
const steps = [];
let failures = 0;

function check(condition, message) {
  if (!condition) {
    failures += 1;
    console.log(`FAIL ${message}`);
  }
}

async function settleScene(page) {
  await page.waitForFunction(() => {
    const description = window.__gridtwin?.scene?.describe();
    return description !== undefined && description.webgl && !description.animating;
  });
}

async function confirm(page) {
  await page.locator('[data-action="confirm"]').click();
  await page.locator('[data-testid="notice"]').filter({ hasNotText: 'Ready' }).waitFor();
  await settleScene(page);
}

async function step(page, name, action) {
  await action();
  await page.waitForTimeout(pause);
  const file = `${String(steps.length + 1).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: resolve(outputDirectory, file) });
  steps.push({ name, file });
  console.log(`step ${steps.length}: ${name}`);
}

async function sceneItem(page, id) {
  return page.evaluate((target) => window.__gridtwin.scene.describe().items.find((item) => item.id === target), id);
}

mkdirSync(outputDirectory, { recursive: true });
const browser = await launchChrome();
const context = await browser.newContext({
  viewport,
  recordVideo: { dir: outputDirectory, size: viewport },
});
const page = await context.newPage();
const video = page.video();

try {
  await page.goto(base);
  await page.locator('[data-scene-canvas]').waitFor();
  await settleScene(page);

  await step(page, 'network-at-rest', async () => {
    await page.locator('[data-sld-switch]').first().waitFor();
  });

  await step(page, 'coupler-open', async () => {
    await page.locator('[data-sld-switch="CPL.QA1"]').click();
    await confirm(page);
    await page.locator('[data-sld-terminal="L2-4"].overloaded').waitFor();
  });
  check((await sceneItem(page, 'CPL.QA1'))?.position === 'OPEN', 'the coupler is open in the 3D scene');

  await step(page, 'line-overloaded', async () => {
    await page.locator('.kind-switch button', { hasText: 'Branches' }).click();
    await page.locator('[data-entry="branch-L2-4"]').click();
    await settleScene(page);
  });
  check((await sceneItem(page, 'terminal:L2-4'))?.selected === true, 'the overloaded line is selected in the scene');

  await step(page, 'line-opened-in-the-scene', async () => {
    await page.locator('[data-scene-canvas]').scrollIntoViewIfNeeded();
    const point = await page.evaluate(() => window.__gridtwin.scene.screenPointOf('L3-4.QA1'));
    await page.mouse.click(point.clientX, point.clientY);
    await confirm(page);
  });
  check((await sceneItem(page, 'terminal:L3-4'))?.condition === 'DEENERGIZED', 'the opened line is de-energized');

  await step(page, 'n-1-analysis', async () => {
    await page.locator('[data-action="run-n1"]').click();
    await page.locator('[data-testid="n1-table"] tr.contingency').first().waitFor();
  });

  await step(page, 'cascade-replay', async () => {
    await page.locator('[data-action="run-cascade"]').click();
    await page.locator('[data-testid="cascade-result"]').waitFor();
    await page.locator('[data-action="play"]').click();
    await page.waitForTimeout(pause * 2);
  });
} finally {
  await context.close();
  if (video !== null) {
    const recorded = await video.path();
    renameSync(recorded, resolve(outputDirectory, 'demo.webm'));
  }
  await browser.close();
}

writeFileSync(resolve(outputDirectory, 'demo.json'), JSON.stringify({ steps }, null, 2));
console.log(`video ${resolve(outputDirectory, 'demo.webm')}`);
process.exit(failures === 0 ? 0 : 1);
