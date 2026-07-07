import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const HOST = process.argv[2] || 'http://localhost:5176';
const SHOT = process.env.SHOT_DIR || 'demo/shots';
mkdirSync(SHOT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const errors = [];
async function page() {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  return p;
}
const clickText = (p, t) => p.getByText(t, { exact: false }).first().click({ timeout: 4000 });

// Creation wizard
{
  const p = await page();
  await p.goto(`${HOST}/character-demo.html`, { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${SHOT}/20-create-appearance.png` });
  await clickText(p, 'つぎへ');           // → class
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${SHOT}/21-create-class.png` });
  await clickText(p, 'つぎへ');           // → creed
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${SHOT}/22-create-creed.png` });
  await clickText(p, 'つぎへ');           // → name
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${SHOT}/23-create-name.png` });
  await p.close();
}
// Closet
{
  const p = await page();
  await p.goto(`${HOST}/character-demo.html#closet`, { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${SHOT}/24-closet.png` });
  await p.close();
}
// Job / guild
{
  const p = await page();
  await p.goto(`${HOST}/character-demo.html#job`, { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${SHOT}/25-job.png` });
  await p.close();
}

console.log('pageerrors:', errors.length);
errors.slice(0, 8).forEach((e) => console.log(e));
await browser.close();
console.log('DONE');
