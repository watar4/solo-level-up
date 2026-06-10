import type { AISettings, Category, Difficulty, Question } from '../types/question';
import { validateQuestions } from './validate';

export interface GenerateParams {
  category: Category;
  subCategory?: string;
  difficulty: Difficulty;
  count: number;
  /** 重複回避のため、既存問題の設問文を渡してプロンプトに含める */
  avoidQuestions?: string[];
}

/** DS検定リテラシーレベル★1相当の問題を生成させるプロンプト（方式A/B共通の方針） */
export function buildPrompt(p: GenerateParams): string {
  const avoid =
    p.avoidQuestions && p.avoidQuestions.length > 0
      ? `\n\n# 既存問題（これらと内容が重複しないようにすること）\n${p.avoidQuestions
          .slice(0, 40)
          .map((q) => `- ${q}`)
          .join('\n')}`
      : '';

  return `あなたは「データサイエンティスト検定 リテラシーレベル（DS検定★）」の作問専門家です。
以下の条件で練習問題を ${p.count} 問作成してください。

# 条件
- カテゴリ: ${p.category}
${p.subCategory ? `- サブカテゴリ: ${p.subCategory}` : ''}
- 難易度: ${p.difficulty}（1=易, 2=中, 3=難。リテラシーレベル★1相当を逸脱しない）
- 出題範囲: スキルチェックリスト★1相当、および数理・データサイエンス・AI（リテラシーレベル）モデルカリキュラム。
- 選択式（単一選択 "single" または複数選択 "multiple"）。
- 各問に必ず正解と、根拠のある簡潔な解説を含めること。
- 実在の試験問題・市販問題集の転記は禁止（オリジナルで作問）。

# 出力形式（厳守）
- 出力は下記スキーマの JSON 配列のみ。前置き・後置き・説明文・Markdownのコードフェンス（\`\`\`）は一切付けない。
- choices の key は "a","b","c","d" を用いる。answer は正解 key の配列。
- 各オブジェクトは次のキーを持つ:
  id(string), category(string,上記カテゴリ), subCategory(string), type("single"|"multiple"),
  difficulty(number 1-3), question(string), choices(配列 of {key,text}),
  answer(string配列), explanation(string), tags(string配列), source("AI生成"), origin("ai-generated")

JSON配列のみを出力してください。${avoid}`;
}

/** コードフェンスや前後の余分なテキストを除去して JSON 配列部分を取り出す */
export function extractJsonArray(text: string): string {
  let t = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    t = t.slice(start, end + 1);
  }
  return t;
}

export class AIError extends Error {
  constructor(
    message: string,
    public kind: 'no-key' | 'http' | 'parse' | 'empty' | 'network',
  ) {
    super(message);
    this.name = 'AIError';
  }
}

/**
 * 方式B（BYOK）: ブラウザから Anthropic Messages API を直接呼び出して問題を生成する。
 * APIキーは引数（localStorage 由来）でのみ受け取り、コードには一切埋め込まない。
 */
export async function generateQuestions(
  settings: AISettings,
  params: GenerateParams,
): Promise<Question[]> {
  if (!settings.apiKey) {
    throw new AIError('APIキーが設定されていません。設定画面で入力してください。', 'no-key');
  }

  const prompt = buildPrompt(params);
  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: settings.model || 'claude-sonnet-4-6',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (e) {
    throw new AIError(`通信に失敗しました: ${(e as Error).message}`, 'network');
  }

  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = j?.error?.message ? `: ${j.error.message}` : '';
    } catch {
      /* ignore */
    }
    throw new AIError(`APIエラー (HTTP ${res.status})${detail}`, 'http');
  }

  const data = await res.json();
  const text: string = Array.isArray(data?.content)
    ? data.content
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { text: string }) => b.text)
        .join('')
    : '';

  if (!text.trim()) throw new AIError('AIからの応答が空でした。', 'empty');

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonArray(text));
  } catch {
    throw new AIError('AI応答をJSONとして解析できませんでした。', 'parse');
  }

  const list = Array.isArray(parsed) ? parsed : [parsed];
  const { questions, errors } = validateQuestions(list);
  if (questions.length === 0) {
    throw new AIError(`有効な問題が得られませんでした。${errors.slice(0, 3).join(' / ')}`, 'parse');
  }
  // 生成元・ID を正規化（ID は呼び出し側で最終採番する想定だが安全側で付与）
  return questions.map((q, i) => ({
    ...q,
    origin: 'ai-generated' as const,
    source: q.source ?? 'AI生成',
    id: q.id && q.id.startsWith('ai-') ? q.id : `ai-${Date.now()}-${i}`,
  }));
}
