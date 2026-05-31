import type { MealEntry, NutritionTarget } from '../types';
import { MEAL_SLOT_LABELS } from '../types';
import { evaluateDay, sumMeals } from './nutrition';

// "Bring your own key" meal review — builds a compact prompt from the logged
// meals + the daily nutrition target and calls the Anthropic Messages API
// directly from the browser. The key is supplied by the caller (see
// useAiSettings) and never leaves the browser except in this request.

export type AiRange = 'day' | 'week';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

const SYSTEM_PROMPT = `あなたは育成アプリ「ソロ・レベルアップ」に組み込まれた管理栄養士兼パーソナルコーチです。
ユーザーの食事記録と1日の栄養目標を比較し、日本語で評価とアドバイスを返してください。

方針:
- まず良かった点を1〜2個、具体的に褒める。
- 次に改善点を、すぐ実行できる具体策として2〜3個示す(例「朝食にゆで卵1個でP+6g」のように定量的に)。
- カロリーとタンパク質を最重視し、脂質・炭水化物は補足的に扱う。
- 目標との過不足を数字で語る。極端な制限や不健康な助言はしない。
- 落ち着いた、励ます「システム」風の口調。絵文字とMarkdown見出しは使わない。
- 短い段落と箇条書きで簡潔に、全体で300〜400字程度にまとめる。`;

function fmtTarget(t: NutritionTarget): string {
  return `カロリー ${t.kcal}kcal / P ${t.protein}g / F ${t.fat}g / C ${t.carbs}g`;
}

function fmtDay(date: string, items: MealEntry[], target: NutritionTarget): string {
  const totals = sumMeals(items);
  const ev = evaluateDay(totals, target);
  const lines = items
    .map(
      (m) =>
        `  - [${MEAL_SLOT_LABELS[m.slot]}] ${m.name}: ${Math.round(m.kcal)}kcal / P${m.protein} F${m.fat} C${m.carbs}`
    )
    .join('\n');
  const sum = `  合計 ${Math.round(totals.kcal)}kcal / P${Math.round(totals.protein)} F${Math.round(totals.fat)} C${Math.round(totals.carbs)}`;
  return `${date}(評価 ${ev.grade} / ${ev.score}点)\n${sum}\n${lines || '  (記録なし)'}`;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// The N calendar dates ending at `today` (inclusive), oldest first.
function lastNDates(today: string, n: number): string[] {
  const base = new Date(`${today}T00:00:00`);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    out.push(toKey(d));
  }
  return out;
}

// Assemble the user-message text fed to Claude for a daily or weekly review.
export function buildMealReviewMessage(
  meals: MealEntry[],
  target: NutritionTarget,
  range: AiRange,
  today: string
): string {
  const dates = range === 'day' ? [today] : lastNDates(today, 7);

  const byDate = new Map<string, MealEntry[]>();
  for (const m of meals) {
    const arr = byDate.get(m.date) ?? [];
    arr.push(m);
    byDate.set(m.date, arr);
  }

  const blocks = dates
    .filter((d) => byDate.has(d))
    .map((d) => fmtDay(d, byDate.get(d) as MealEntry[], target));

  const header =
    range === 'day'
      ? `【本日(${today})の食事を評価してください】`
      : '【直近1週間の食事を評価してください】';

  return `${header}

1日の栄養目標: ${fmtTarget(target)}

${blocks.join('\n\n') || '(この期間の食事記録はありません)'}`;
}

interface AnthropicTextBlock {
  type: string;
  text?: string;
}
interface AnthropicResponse {
  content?: AnthropicTextBlock[];
  error?: { message?: string; type?: string };
}

export interface MealReviewParams {
  apiKey: string;
  model: string;
  message: string;
}

// Direct browser → Claude call. Requires the dangerous-direct-browser-access
// header; Anthropic returns the matching CORS headers so this works without a
// backend proxy. Throws an Error with a human-readable message on failure.
export async function requestMealReview({
  apiKey,
  model,
  message,
}: MealReviewParams): Promise<string> {
  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: message }],
      }),
    });
  } catch (err) {
    // Network-level failure (offline, CORS rejected, etc.).
    throw new Error(
      `通信に失敗しました(ネットワーク / CORS)。${err instanceof Error ? err.message : String(err)}`
    );
  }

  const data = (await res.json().catch(() => null)) as AnthropicResponse | null;

  if (!res.ok) {
    const msg = data?.error?.message ?? `APIエラー (HTTP ${res.status})`;
    throw new Error(msg);
  }

  const text = (data?.content ?? [])
    .filter((b) => b.type === 'text' && b.text)
    .map((b) => b.text as string)
    .join('\n')
    .trim();

  if (!text) throw new Error('AIから空の応答が返りました。');
  return text;
}
