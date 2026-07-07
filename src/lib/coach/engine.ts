// AI coach — pluggable engine (docs/redesign/09-ai-coach.md §3).
//
// The coach's "brain" behind a stable interface so the UI never cares which
// engine answers. Two real engines ship: `rules` (deterministic, always
// available, zero cost, no rate limit) and `webllm` (on-device LLM, opt-in —
// see webllm.ts). `gemini` is reserved in the union only; it has per-call rate
// limits so it is intentionally not built here.

import type { CoachContext } from './context';
import type { CoachDigest } from './digest';

export type CoachEngineKind = 'rules' | 'webllm' | 'gemini';

export interface CoachMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface CoachEngine {
  kind: CoachEngineKind;
  // Rephrase the digest in the engine's own words. `null` = "use the rule-based
  // text as-is" (the rules engine always returns null here).
  narrate(ctx: CoachContext, digest: CoachDigest): Promise<string | null>;
  // Log-aware chat. `onToken` receives incremental text for streaming UIs.
  chat(ctx: CoachContext, history: CoachMessage[], onToken?: (t: string) => void): Promise<string>;
}

// True when on-device inference is even possible on this browser.
export function webgpuAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

// The engine to use by default. WebLLM only when the caller says a model is
// ready (download is a deliberate opt-in); otherwise rules.
export function detectBestEngine(localModelReady: boolean): CoachEngineKind {
  if (localModelReady && webgpuAvailable()) return 'webllm';
  return 'rules';
}

// ----- rules engine -----------------------------------------------------------

// A tiny keyword classifier so the always-on engine can still answer the most
// common questions from the context, with no model. Anything it can't classify
// gets a friendly pointer to enable the on-device AI.
function answerFromRules(ctx: CoachContext, question: string): string {
  const q = question.toLowerCase();
  const has = (...keys: string[]) => keys.some((k) => question.includes(k) || q.includes(k));

  if (has('連続', 'ストリーク', 'streak', '継続')) {
    const top = ctx.quests.topStreak;
    const risk = ctx.quests.atRisk;
    if (risk.length) {
      return `いま「${risk[0].title}」の連続${risk[0].streak}日が 今日で途切れそうです。${
        ctx.character.freezeStock > 0 ? '継続の盾が1つあるので1日ぶんは守れますが、' : ''
      }できれば今日ひとつ 進めておきましょう。`;
    }
    if (top && top.streak > 0) {
      return `最長は「${top.title}」の ${top.streak}日連続です。この調子で積み上げていきましょう。`;
    }
    return 'いまは連続中のデイリーはありません。今日から ひとつ 始めてみましょう。';
  }

  if (has('体重', 'weight', 'ダイエット', '減量')) {
    if (ctx.weight.latest == null) return 'まだ体重の記録がありません。まず1回 測って残してみましょう。';
    let s = `最新の体重は ${ctx.weight.latest}kg です。`;
    if (ctx.weight.delta14d != null) {
      s +=
        ctx.weight.delta14d < 0
          ? `この2週間で ${Math.abs(ctx.weight.delta14d)}kg 減っています。順調です。`
          : `この2週間で ${ctx.weight.delta14d}kg 増えています。`;
    }
    if (ctx.weight.target != null) s += ` 目標は ${ctx.weight.target}kg です。`;
    return s;
  }

  if (has('食事', '栄養', 'カロリー', 'ごはん', 'meal', '食べ')) {
    if (ctx.meals.gradeToday) return `今日の食事評価は ${ctx.meals.gradeToday} です。`;
    if (ctx.meals.avgScore7d != null) return `直近の食事スコアは 平均 ${ctx.meals.avgScore7d}点 です。`;
    return 'まだ食事の記録がありません。今日のぶんから 残してみましょう。';
  }

  if (has('貯金', '節約', 'お金', '予算', 'savings', 'budget')) {
    const parts: string[] = [];
    if (ctx.economy.savingsProgress != null) {
      parts.push(`貯金目標の進捗は ${Math.round(ctx.economy.savingsProgress * 100)}% です。`);
    }
    if (ctx.economy.budgetLeft != null) {
      parts.push(
        ctx.economy.budgetLeft >= 0
          ? `今月の予算は あと ${ctx.economy.budgetLeft.toLocaleString('ja-JP')}円 残っています。`
          : `今月は 予算を ${Math.abs(ctx.economy.budgetLeft).toLocaleString('ja-JP')}円 超えています。`
      );
    }
    return parts.length ? parts.join(' ') : '貯金や予算の目標を設定すると、ここで進捗をお伝えできます。';
  }

  if (has('今日', 'なにを', '何を', 'what', 'todo', 'やる')) {
    const remaining = ctx.quests.dailyTotal - ctx.quests.dailyDoneToday;
    if (remaining > 0) return `今日のデイリーは 残り ${remaining}件 です。軽いものから ひとつ どうぞ。`;
    return '今日のデイリーは すべて完了しています。お見事でした。';
  }

  return 'より詳しい相談には 端末内AI(ローカルモデル)のダウンロードが必要です。設定から有効にできます。それまでは 連続・体重・食事・貯金 についてなら お答えできます。';
}

export function createRulesEngine(): CoachEngine {
  return {
    kind: 'rules',
    async narrate() {
      return null; // use the rule-based digest text directly
    },
    async chat(ctx, history, onToken) {
      const last = [...history].reverse().find((m) => m.role === 'user');
      const answer = last ? answerFromRules(ctx, last.text) : 'ご用件をどうぞ。';
      onToken?.(answer);
      return answer;
    },
  };
}
