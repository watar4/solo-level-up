import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const HOST = process.argv[2] || 'http://localhost:5178';
const SHOT = process.env.SHOT_DIR || 'demo/shots';
mkdirSync(SHOT, { recursive: true });

const browser = await chromium.launch({
  headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'],
});
const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
p.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
const clickText = (t) => p.getByText(t, { exact: false }).first().click({ timeout: 4000 });
const visible = async (t) => (await p.getByText(t, { exact: false }).count()) > 0;

await p.goto(`${HOST}/adventure-demo.html#finale`, { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(900);

await clickText('グーたら城');
await p.waitForTimeout(500);

async function dialogue() {
  for (let i = 0; i < 20; i++) {
    const b = p.getByRole('button', { name: 'つぎへ' });
    if ((await b.count()) === 0) return;
    await b.click().catch(() => {});
    await p.waitForTimeout(150);
  }
}
async function fight(shotName) {
  let shotted = false;
  for (let i = 0; i < 200; i++) {
    if (await visible('つづける')) return;
    const ult = p.getByRole('button', { name: 'おくぎ' });
    if ((await ult.count()) > 0 && (await ult.first().isEnabled())) {
      await ult.first().click().catch(() => {});
      if (shotName && !shotted) { await p.waitForTimeout(120); await p.screenshot({ path: `${SHOT}/${shotName}.png` }); shotted = true; }
    } else {
      const atk = p.getByRole('button', { name: 'たたかう' });
      if ((await atk.count()) > 0 && (await atk.first().isEnabled())) await atk.first().click().catch(() => {});
    }
    await p.waitForTimeout(110);
  }
}

// nodes: intro, 3 mobs, elite, prelord, lord
const nodes = ['たどりつく', 'マクラヘイ', 'オフトナー', 'ユメマボロシ', 'ネボスケリオン', 'ボスの間の前', 'サボり魔王グータラ'];
for (const label of nodes) {
  await clickText(label);
  await p.waitForTimeout(500);
  if (label === 'たどりつく' || label === 'ボスの間の前') { await dialogue(); await p.waitForTimeout(300); continue; }
  await fight(label === 'サボり魔王グータラ' ? '30-ultimate-cutin' : null);
  await p.waitForTimeout(300);
  if (await visible('つづける')) { await clickText('つづける'); await p.waitForTimeout(400); }
  await dialogue(); // lord-clear dialogue (leads to ending on ch12)
  await p.waitForTimeout(500);
}

await p.waitForTimeout(800);
await p.screenshot({ path: `${SHOT}/31-ending.png` });
console.log('pageerrors:', errors.length, '| ending visible:', await visible('ダラリア大陸、平和'));
errors.slice(0, 6).forEach((e) => console.log(e));
await browser.close();
console.log('DONE');
