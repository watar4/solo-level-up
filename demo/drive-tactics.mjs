import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const HOST = process.argv[2] || 'http://localhost:5179';
const SHOT = process.env.SHOT_DIR || 'demo/shots';
mkdirSync(SHOT, { recursive: true });

const browser = await chromium.launch({
  headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'],
});
const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
p.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
const clickText = (t) => p.getByText(t, { exact: false }).first().click({ timeout: 4000 });

await p.goto(`${HOST}/adventure-demo.html`, { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(800);
await clickText('おはよう平原');
await p.waitForTimeout(400);
// intro dialogue
await clickText('めざめ');
await p.waitForTimeout(300);
for (let i = 0; i < 12; i++) {
  const b = p.getByRole('button', { name: 'つぎへ' });
  if ((await b.count()) === 0) break;
  await b.click().catch(() => {}); await p.waitForTimeout(140);
}
await p.waitForTimeout(300);
// first battle
await clickText('そうげん');
await p.waitForTimeout(900);
// wait for the player's turn, then open さくせん
for (let i = 0; i < 60; i++) {
  const sk = p.getByRole('button', { name: 'さくせん' });
  if ((await sk.count()) > 0 && (await sk.first().isEnabled())) { await sk.first().click(); break; }
  await p.waitForTimeout(120);
}
await p.waitForTimeout(300);
await p.screenshot({ path: `${SHOT}/40-tactics-menu.png` });

console.log('pageerrors:', errors.length);
errors.slice(0, 6).forEach((e) => console.log(e));
await browser.close();
console.log('DONE');
