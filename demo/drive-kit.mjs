import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:5175/adventure-demo.html';
const SHOT = process.env.SHOT_DIR || 'demo/shots';
mkdirSync(SHOT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

const clickText = (t) => page.getByText(t, { exact: false }).first().click({ timeout: 4000 });

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${SHOT}/10-worldmap-all.png` });

// Enter chapter 5 (kit-generated sprites) and reach a battle.
await clickText('つかいすぎ廃坑');
await page.waitForTimeout(500);
await page.screenshot({ path: `${SHOT}/11-region-ch5.png` });

await clickText('たどりつく'); // intro event
await page.waitForTimeout(400);
for (let i = 0; i < 12; i++) {
  const b = page.getByRole('button', { name: 'つぎへ' });
  if ((await b.count()) === 0) break;
  await b.click().catch(() => {});
  await page.waitForTimeout(150);
}
await page.waitForTimeout(400);
// first battle node = first mob (コゼニトリ)
await clickText('コゼニトリ');
await page.waitForTimeout(900);
await page.screenshot({ path: `${SHOT}/12-battle-ch5-kit.png` });

console.log('pageerrors:', errors.length);
errors.slice(0, 5).forEach((e) => console.log(e));
await browser.close();
console.log('DONE');
