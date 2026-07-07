import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

// Post-fix UX verification: flee flow, tactic-era battle deck, will-0 hint,
// job-advance confirm, 320px creation tabs.
const HOST = process.argv[2] || 'http://localhost:5182';
const SHOT = process.env.SHOT_DIR || 'demo/shots';
mkdirSync(SHOT, { recursive: true });

const browser = await chromium.launch({
  headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'],
});
const errors = [];
async function newPage(w = 390, h = 844) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  return p;
}
const clickText = (p, t) => p.getByText(t, { exact: false }).first().click({ timeout: 4000 });
async function runDialogue(p) {
  for (let i = 0; i < 20; i++) {
    const b = p.getByRole('button', { name: /つぎへ/ });
    if ((await b.count()) === 0) return;
    await b.click().catch(() => {});
    await p.waitForTimeout(130);
  }
}

// 1) battle deck + flee confirm + flee result
{
  const p = await newPage();
  await p.goto(`${HOST}/adventure-demo.html`, { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(800);
  await clickText(p, 'おはよう平原');
  await p.waitForTimeout(300);
  await clickText(p, 'めざめ');
  await runDialogue(p);
  await p.waitForTimeout(300);
  await clickText(p, 'そうげん');
  await p.waitForTimeout(900);
  for (let i = 0; i < 60; i++) {
    const b = p.getByRole('button', { name: 'にげる' });
    if ((await b.count()) > 0 && (await b.first().isEnabled())) { await b.first().click(); break; }
    await p.waitForTimeout(120);
  }
  await p.waitForTimeout(250);
  await p.screenshot({ path: `${SHOT}/v01-flee-confirm.png` });
  await p.getByRole('button', { name: 'にげる' }).first().click();
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${SHOT}/v02-flee-result.png` });
  await p.close();
}

// 2) will-0 persistent hint in region
{
  const p = await newPage();
  await p.goto(`${HOST}/adventure-demo.html#nowill`, { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(800);
  await clickText(p, 'おはよう平原');
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${SHOT}/v03-nowill-hint.png` });
  await p.close();
}

// 3) job advance confirm (two-step)
{
  const p = await newPage();
  await p.goto(`${HOST}/character-demo.html#job`, { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(800);
  await clickText(p, 'パラディン');
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${SHOT}/v04-job-confirm.png` });
  await p.close();
}

// 4) creation step tabs at 320px (nowrap check)
{
  const p = await newPage(320, 568);
  await p.goto(`${HOST}/character-demo.html`, { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${SHOT}/v05-create-tabs-320.png` });
  await p.close();
}

console.log('pageerrors:', errors.length);
errors.slice(0, 8).forEach((e) => console.log(e));
await browser.close();
console.log('DONE');
