import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:5175/adventure-demo.html';
const SHOT = process.env.SHOT_DIR || 'demo/shots';
mkdirSync(SHOT, { recursive: true });
const errors = [];

const browser = await chromium.launch({
  headless: true,
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

const log = (...a) => console.log(...a);
const shot = (name) => page.screenshot({ path: `${SHOT}/${name}.png` });
const visible = async (text) => (await page.getByText(text, { exact: false }).count()) > 0;
const clickText = async (text) => {
  const el = page.getByText(text, { exact: false }).first();
  await el.click({ timeout: 4000 });
};

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(800);

// 1) World map
await page.getByText('おはよう平原', { exact: false }).first().waitFor({ timeout: 10000 });
await shot('01-worldmap');
log('worldmap OK');

// 2) Enter chapter 1
await clickText('おはよう平原');
await page.waitForTimeout(500);
await shot('02-region');
log('region OK');

// Helper: advance a dialogue to the end (tap the full-screen button).
async function runDialogue(maxTaps = 20) {
  for (let i = 0; i < maxTaps; i++) {
    const btn = page.getByRole('button', { name: 'つぎへ' });
    if ((await btn.count()) === 0) return;
    await btn.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(180);
  }
}

// Helper: fight the current battle to its end (win expected at Lv20/40).
async function fightToEnd(maxSteps = 120) {
  for (let i = 0; i < maxSteps; i++) {
    // battle over?
    if (await visible('つづける')) return true;
    const atk = page.getByRole('button', { name: 'たたかう' });
    if ((await atk.count()) > 0 && (await atk.first().isEnabled())) {
      await atk.first().click({ timeout: 2000 }).catch(() => {});
    }
    await page.waitForTimeout(120);
  }
  return false;
}

// 3) Walk the region node by node.
const steps = [
  { label: 'めざめ', kind: 'event' },
  { label: 'そうげん', kind: 'battle' },
  { label: 'くさむら', kind: 'battle' },
  { label: 'いどばた', kind: 'event' },
  { label: 'いわば', kind: 'battle' },
  { label: 'まんねんどこ', kind: 'battle' },
  { label: 'ていたくまえ', kind: 'event' },
  { label: 'スヤリンの間', kind: 'battle' },
];

let battleShotTaken = false;
for (const step of steps) {
  await clickText(step.label);
  await page.waitForTimeout(500);
  if (step.kind === 'event') {
    await runDialogue();
    await page.waitForTimeout(400);
    continue;
  }
  // battle — grab one mid-fight screenshot
  if (!battleShotTaken) {
    await page.waitForTimeout(600);
    await shot('03-battle');
    battleShotTaken = true;
    log('battle screen OK');
  }
  const won = await fightToEnd();
  log(`${step.label}: ${won ? 'battle resolved' : 'TIMEOUT'}`);
  await page.waitForTimeout(300);
  if (step.label === 'スヤリンの間') {
    await shot('04-lord-result'); // result screen with medal
    log('lord result OK');
  }
  // continue past result
  if (await visible('つづける')) { await clickText('つづける'); await page.waitForTimeout(400); }
  // lord clear plays a closing dialogue → back to world
  await runDialogue();
  await page.waitForTimeout(400);
}

await page.waitForTimeout(600);
await shot('05-cleared-worldmap');
log('final state OK');

log('--- ERRORS (non-network) ---');
const meaningful = errors.filter((e) => !/ERR_|net::|Failed to load resource/i.test(e));
log('total:', errors.length, '| meaningful:', meaningful.length);
meaningful.slice(0, 12).forEach((e) => log(e));

await browser.close();
log('DONE');
