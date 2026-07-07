import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

// UX screenshot battery: key flows at two viewports (390 = iPhone 14,
// 320 = smallest common phones) plus edge cases.
const HOST = process.argv[2] || 'http://localhost:5181';
const SHOT = process.env.SHOT_DIR || 'demo/shots';
mkdirSync(SHOT, { recursive: true });

const browser = await chromium.launch({
  headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'],
});
const errors = [];

async function newPage(w, h) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  return p;
}
const clickText = (p, t) => p.getByText(t, { exact: false }).first().click({ timeout: 4000 });

async function runDialogue(p, maxTaps = 15) {
  for (let i = 0; i < maxTaps; i++) {
    const b = p.getByRole('button', { name: 'つぎへ' });
    if ((await b.count()) === 0) return;
    await b.click().catch(() => {});
    await p.waitForTimeout(140);
  }
}

// ── 320px narrow phone: adventure flow ────────────────────────────────
{
  const p = await newPage(320, 568);
  await p.goto(`${HOST}/adventure-demo.html`, { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${SHOT}/u01-world-320.png` });
  await clickText(p, 'おはよう平原');
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${SHOT}/u02-region-320.png` });
  await clickText(p, 'めざめ');
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${SHOT}/u03-dialogue-320.png` });
  await runDialogue(p);
  await p.waitForTimeout(300);
  await clickText(p, 'そうげん');
  await p.waitForTimeout(1000);
  await p.screenshot({ path: `${SHOT}/u04-battle-320.png` });
  // open skill submenu (CD labels) on narrow width
  for (let i = 0; i < 50; i++) {
    const sk = p.getByRole('button', { name: 'スキル' });
    if ((await sk.count()) > 0 && (await sk.first().isEnabled())) { await sk.first().click(); break; }
    await p.waitForTimeout(120);
  }
  await p.waitForTimeout(250);
  await p.screenshot({ path: `${SHOT}/u05-skillmenu-320.png` });
  await p.close();
}

// ── 390px: Will exhaustion UX (deplete then try) ─────────────────────
{
  const p = await newPage(390, 844);
  await p.goto(`${HOST}/adventure-demo.html#nowill`, { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(800);
  await clickText(p, 'おはよう平原');
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${SHOT}/u06-region-nowill.png` });
  // tap the first battle node anyway to see the error flash (intro event first)
  await clickText(p, 'めざめ');
  await p.waitForTimeout(300);
  await runDialogue(p);
  await p.waitForTimeout(300);
  await clickText(p, 'そうげん');
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${SHOT}/u07-nowill-flash.png` });
  await p.close();
}

// ── 390px: defeat flow (weak player vs lord via #weak) ───────────────
{
  const p = await newPage(390, 844);
  await p.goto(`${HOST}/adventure-demo.html#weak`, { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(800);
  await clickText(p, 'おはよう平原');
  await p.waitForTimeout(400);
  await clickText(p, 'めざめ');
  await runDialogue(p);
  await p.waitForTimeout(300);
  await clickText(p, 'そうげん');
  await p.waitForTimeout(800);
  // guard forever until defeat
  for (let i = 0; i < 300; i++) {
    if ((await p.getByText('つづける', { exact: false }).count()) > 0) break;
    const g = p.getByRole('button', { name: 'ぼうぎょ' });
    if ((await g.count()) > 0 && (await g.first().isEnabled())) await g.first().click().catch(() => {});
    await p.waitForTimeout(120);
  }
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${SHOT}/u08-defeat.png` });
  await p.close();
}

// ── character creation on 320px + long name ──────────────────────────
{
  const p = await newPage(320, 568);
  await p.goto(`${HOST}/character-demo.html`, { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${SHOT}/u09-create-320.png` });
  await clickText(p, 'つぎへ'); await p.waitForTimeout(300);
  await clickText(p, 'つぎへ'); await p.waitForTimeout(300);
  await clickText(p, 'つぎへ'); await p.waitForTimeout(300);
  await p.getByRole('textbox').fill('ながいなまえのハンターさんですよ'); // 16 chars (max)
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${SHOT}/u10-create-longname-320.png` });
  await p.close();
}

// ── status panel long-name (via job/closet demo mocks: skip — covered by creation) ──

console.log('pageerrors:', errors.length);
errors.slice(0, 8).forEach((e) => console.log(e));
await browser.close();
console.log('DONE');
