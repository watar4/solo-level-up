import type { MealEntry } from '../types';

// AI auto-fill for the meal Record form — sends a meal photo (or a nutrition
// facts label photo) and/or the dish name to Gemini and gets back structured
// kcal + PFC to prefill the form. Same "bring your own key" model as mealAi.ts
// (free AI Studio tier; the key never leaves the browser except in this
// request). The result only fills the form — the user reviews and saves.

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export type EstimateSource = 'label' | 'photo' | 'name';

export interface MealEstimate {
  name: string;
  kcal: number;
  protein: number; // g
  fat: number;     // g
  carbs: number;   // g
  source: EstimateSource;
  note?: string;   // short basis, e.g. "1包装あたり" / "茶碗1杯150g+焼き鮭1切れ"
}

// The model must answer with JSON only (enforced additionally via
// responseMimeType). Label photos are read exactly (OCR); dish photos are
// estimated at one serving; name-only falls back to a typical serving.
const SYSTEM_PROMPT = `あなたは食事記録アプリの栄養データ抽出エンジンです。入力は「食事の写真」「食品の栄養成分表示ラベルの写真」「メニュー名のみ」のいずれかです。
必ず次の形のJSONオブジェクトだけを返してください(説明文やコードフェンスは禁止):
{"name": "短い料理名", "kcal": 数値, "protein": 数値, "fat": 数値, "carbs": 数値, "source": "label" | "photo" | "name", "note": "短い補足"}

判定ルール:
- 画像が栄養成分表示ラベルの場合: source="label"。表の数値を正確に読み取る。基準量を確認し、「1食あたり」「1包装あたり」の値を優先して返す(noteに基準量を明記)。「100gあたり」しか無い場合はその値を返し、noteに「100gあたり」と書く。「炭水化物」表記が無く「糖質」と「食物繊維」がある場合は合算して carbs とする。
- 料理・食品の写真の場合: source="photo"。写っている量(1人前)を推定し、日本の一般的な食品成分の知識に基づく現実的な値を返す。noteに推定根拠を短く(例「茶碗1杯の白米150g+焼き鮭1切れ」)。
- 画像が無い場合: source="name"。メニュー名から一般的な1人前を推定する。
- name はメニュー名が与えられていればそれを優先し、無ければ画像から短い料理名を付ける。
- 単位は kcal と g。数値のみ(単位文字を含めない)。
- 食品が写っていない・判読不能な場合は {"error": "短い理由"} を返す。`;

// ----- response parsing (pure, unit-tested) -----

function toNum(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 10) / 10);
}

// Parse the model's JSON answer into a MealEstimate. Tolerates code fences and
// surrounding prose (finds the outermost {...}); derives kcal from PFC when
// missing; clamps to sane ranges so a hallucinated number can't wreck the log.
export function parseMealEstimate(raw: string): MealEstimate {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AIの応答を解釈できませんでした。もう一度お試しください。');

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    throw new Error('AIの応答を解釈できませんでした。もう一度お試しください。');
  }
  if (typeof obj.error === 'string' && obj.error) {
    throw new Error(`読み取れませんでした: ${obj.error}`);
  }

  const protein = Math.min(500, toNum(obj.protein));
  const fat = Math.min(500, toNum(obj.fat));
  const carbs = Math.min(1000, toNum(obj.carbs));
  let kcal = Math.round(Math.min(5000, toNum(obj.kcal)));
  if (kcal === 0 && (protein || fat || carbs)) {
    kcal = Math.round(protein * 4 + fat * 9 + carbs * 4);
  }
  if (kcal === 0 && protein === 0 && fat === 0 && carbs === 0) {
    throw new Error('栄養値を読み取れませんでした。写真を撮り直すか、手入力してください。');
  }

  const source: EstimateSource =
    obj.source === 'label' || obj.source === 'name' ? obj.source : 'photo';
  return {
    name: typeof obj.name === 'string' ? obj.name.trim() : '',
    kcal,
    protein,
    fat,
    carbs,
    source,
    note: typeof obj.note === 'string' && obj.note.trim() ? obj.note.trim() : undefined,
  };
}

// The user-turn text for the request (pure, unit-tested).
export function buildEstimateMessage(name?: string, hasImage?: boolean): string {
  if (name && hasImage) {
    return `メニュー名: ${name}\nこの画像を読み取り、栄養値をJSONで返してください。`;
  }
  if (hasImage) return 'この画像を読み取り、栄養値をJSONで返してください。';
  return `メニュー名: ${name ?? ''}\nこの料理の一般的な1人前の栄養値をJSONで返してください。`;
}

// Human-readable label for where the numbers came from (shown under the form).
export function estimateSourceLabel(est: Pick<MealEstimate, 'source' | 'note'>): string {
  const base =
    est.source === 'label'
      ? '栄養成分表示を読み取りました'
      : est.source === 'photo'
        ? '写真から推定しました(目安)'
        : 'メニュー名から推定しました(目安)';
  return est.note ? `${base} — ${est.note}` : base;
}

// ----- image preprocessing (browser only) -----

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('画像を読み込めませんでした。'));
    img.src = url;
  });
}

// Downscale a picked photo to keep the request small (labels stay legible at
// 1280px) and re-encode as JPEG. Returns the base64 payload for inline_data.
export async function fileToInlineImage(
  file: File,
  maxDim = 1280,
  quality = 0.85
): Promise<{ data: string; mimeType: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const w0 = img.naturalWidth || img.width;
    const h0 = img.naturalHeight || img.height;
    if (!w0 || !h0) throw new Error('画像を読み込めませんでした。');
    const scale = Math.min(1, maxDim / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const cx = canvas.getContext('2d');
    if (!cx) throw new Error('画像の変換に失敗しました。');
    cx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    return { data: dataUrl.slice(dataUrl.indexOf(',') + 1), mimeType: 'image/jpeg' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ----- Gemini call -----

interface GeminiPart {
  text?: string;
}
interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}

export interface MealEstimateParams {
  apiKey: string;
  model: string;
  name?: string;
  image?: { data: string; mimeType: string };
}

// Browser → Gemini multimodal call (same direct-CORS path as requestMealReview).
// Throws an Error with a human-readable Japanese message on any failure.
export async function requestMealEstimate({
  apiKey,
  model,
  name,
  image,
}: MealEstimateParams): Promise<MealEstimate> {
  const url = `${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const parts: Record<string, unknown>[] = [
    { text: buildEstimateMessage(name, Boolean(image)) },
  ];
  if (image) {
    parts.push({ inline_data: { mime_type: image.mimeType, data: image.data } });
  }

  // Low temperature: this is extraction, not prose. JSON mode keeps the answer
  // parseable; thinking is disabled on the flash family (same reasoning as
  // mealAi.ts — it eats the output budget).
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: 1024,
    temperature: 0.2,
    responseMimeType: 'application/json',
  };
  if (/2\.5-flash/.test(model)) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts }],
        generationConfig,
      }),
    });
  } catch (err) {
    throw new Error(
      `通信に失敗しました(ネットワーク / CORS)。${err instanceof Error ? err.message : String(err)}`
    );
  }

  const data = (await res.json().catch(() => null)) as GeminiResponse | null;
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `APIエラー (HTTP ${res.status})`);
  }

  const text = (data?.candidates ?? [])
    .flatMap((c) => c.content?.parts ?? [])
    .map((p) => p.text)
    .filter((t): t is string => !!t)
    .join('\n')
    .trim();

  if (!text) {
    const blocked = data?.promptFeedback?.blockReason;
    throw new Error(
      blocked ? `安全フィルタでブロックされました (${blocked})。` : 'AIから空の応答が返りました。'
    );
  }
  return parseMealEstimate(text);
}

// Convenience: what the form fields should become after an estimate. Keeps the
// user's own dish name when they typed one (pure, unit-tested).
export function applyEstimateToForm(
  est: MealEstimate,
  currentName: string
): Pick<MealEntry, 'name' | 'kcal' | 'protein' | 'fat' | 'carbs'> {
  return {
    name: currentName.trim() ? currentName.trim() : est.name,
    kcal: est.kcal,
    protein: est.protein,
    fat: est.fat,
    carbs: est.carbs,
  };
}
