#!/usr/bin/env node
// 方式A（ローカル事前生成）: ローカルPCで実行して問題を生成し、
// 検証のうえ src/data/questions.json に追記します。
//
// 使い方:
//   cp .env.example .env  &&  .env に ANTHROPIC_API_KEY を設定
//   npm run generate -- --category "データサイエンス力" --subCategory "統計数理基礎" --difficulty 2 --count 5
//   （--dry-run を付けると追記せず標準出力に表示）
//
// セキュリティ: APIキーは .env / 環境変数からのみ読み込みます。キーは絶対にコミットしないでください。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'src/data/questions.json');

const CATEGORIES = [
  'データサイエンス力',
  'データエンジニアリング力',
  'ビジネス力',
  '数理・データサイエンス・AIリテラシー',
];

// ---- 簡易 .env ローダ（依存ゼロ） ----
function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// ---- 引数パース ----
function parseArgs(argv) {
  const args = { difficulty: 2, count: 5, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--category') args.category = argv[++i];
    else if (a === '--subCategory') args.subCategory = argv[++i];
    else if (a === '--difficulty') args.difficulty = Number(argv[++i]);
    else if (a === '--count') args.count = Number(argv[++i]);
    else if (a === '--model') args.model = argv[++i];
  }
  return args;
}

// ---- スキーマ検証（src/lib/validate.ts と同等の最小実装） ----
function validate(q, idx) {
  const errors = [];
  if (!CATEGORIES.includes(q.category)) errors.push(`[#${idx}] category 不正: ${q.category}`);
  if (!['single', 'multiple'].includes(q.type)) errors.push(`[#${idx}] type 不正`);
  if (![1, 2, 3].includes(Number(q.difficulty))) errors.push(`[#${idx}] difficulty 不正`);
  if (typeof q.question !== 'string' || !q.question.trim()) errors.push(`[#${idx}] question 空`);
  if (!Array.isArray(q.choices) || q.choices.length < 2) errors.push(`[#${idx}] choices 不足`);
  const keys = new Set((q.choices || []).map((c) => c.key));
  if (!Array.isArray(q.answer) || q.answer.length === 0) errors.push(`[#${idx}] answer 空`);
  for (const a of q.answer || []) if (!keys.has(a)) errors.push(`[#${idx}] answer "${a}" が choices に無い`);
  if (q.type === 'single' && (q.answer || []).length !== 1) errors.push(`[#${idx}] single の answer は1件`);
  if (typeof q.explanation !== 'string' || !q.explanation.trim()) errors.push(`[#${idx}] explanation 空`);
  return errors;
}

function buildPrompt({ category, subCategory, difficulty, count }, avoid) {
  const avoidBlock =
    avoid.length > 0
      ? `\n\n# 既存問題（重複しないこと）\n${avoid.slice(0, 50).map((q) => `- ${q}`).join('\n')}`
      : '';
  return `あなたは「データサイエンティスト検定 リテラシーレベル（DS検定★）」の作問専門家です。
以下の条件で練習問題を ${count} 問作成してください。

# 条件
- カテゴリ: ${category}
${subCategory ? `- サブカテゴリ: ${subCategory}` : ''}
- 難易度: ${difficulty}（1=易, 2=中, 3=難。リテラシーレベル★1相当を逸脱しない）
- 選択式（"single" か "multiple"）。各問に正解と根拠のある解説を必ず含める。
- 実在の試験問題・市販問題集の転記は禁止（オリジナル作問）。

# 出力（厳守）
JSON配列のみを出力。前置き・後置き・コードフェンス禁止。各要素のキー:
id, category, subCategory, type, difficulty, question, choices([{key,text}]),
answer(配列), explanation, tags(配列), source("AI生成"), origin("ai-generated")。
choices の key は "a","b","c","d"。${avoidBlock}`;
}

function extractJson(text) {
  let t = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const s = t.indexOf('[');
  const e = t.lastIndexOf(']');
  if (s !== -1 && e !== -1 && e > s) t = t.slice(s, e + 1);
  return t;
}

async function callApi(apiKey, model, prompt, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ model, max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
      }
      const data = await res.json();
      return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    } catch (err) {
      console.error(`  ! 試行 ${attempt}/${retries} 失敗: ${err.message}`);
      if (attempt === retries) throw err;
      const wait = 2 ** attempt * 1000;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

function nextIdFactory(existing) {
  const prefix = 'ai';
  let n = 1;
  const used = new Set(existing.map((q) => q.id));
  return () => {
    let id;
    do {
      id = `${prefix}-${String(Date.now()).slice(-6)}${String(n++).padStart(3, '0')}`;
    } while (used.has(id));
    used.add(id);
    return id;
  };
}

async function main() {
  loadEnv();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('エラー: ANTHROPIC_API_KEY が未設定です。.env に設定してください（コミット禁止）。');
    process.exit(1);
  }
  const args = parseArgs(process.argv.slice(2));
  if (!args.category || !CATEGORIES.includes(args.category)) {
    console.error(`エラー: --category は次のいずれか: ${CATEGORIES.join(' / ')}`);
    process.exit(1);
  }
  const model = args.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

  const existing = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const avoid = existing.filter((q) => q.category === args.category).map((q) => q.question);

  console.log(`生成: ${args.category}${args.subCategory ? ` / ${args.subCategory}` : ''} 難易度${args.difficulty} × ${args.count}問（model=${model}）`);

  const text = await callApi(apiKey, model, buildPrompt(args, avoid), 3);
  let parsed;
  try {
    parsed = JSON.parse(extractJson(text));
  } catch {
    console.error('エラー: 応答をJSONとして解析できませんでした。');
    console.error(text.slice(0, 500));
    process.exit(1);
  }
  const list = Array.isArray(parsed) ? parsed : [parsed];

  const nextId = nextIdFactory(existing);
  const valid = [];
  list.forEach((q, i) => {
    const errs = validate(q, i);
    if (errs.length) {
      console.error(`  スキップ #${i}: ${errs.join(' / ')}`);
      return;
    }
    valid.push({
      ...q,
      id: nextId(),
      difficulty: Number(q.difficulty),
      tags: Array.isArray(q.tags) ? q.tags : [],
      imageUrl: q.imageUrl ?? null,
      source: q.source || 'AI生成',
      origin: 'ai-generated',
    });
  });

  if (valid.length === 0) {
    console.error('有効な問題が得られませんでした。');
    process.exit(1);
  }

  if (args.dryRun) {
    console.log(`\n[dry-run] ${valid.length}問（追記しません）:\n`);
    console.log(JSON.stringify(valid, null, 2));
    return;
  }

  const merged = existing.concat(valid);
  fs.writeFileSync(DATA_PATH, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log(`✓ ${valid.length}問を追記しました（合計 ${merged.length}問）→ ${path.relative(ROOT, DATA_PATH)}`);
  console.log('  内容を git diff で確認し、問題なければコミットしてください。');
}

main().catch((e) => {
  console.error('失敗:', e.message);
  process.exit(1);
});
