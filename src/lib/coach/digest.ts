// AI coach — rule-based digest (docs/redesign/09-ai-coach.md §2).
//
// Turns a CoachContext into the startup greeting + "one thing to do today",
// deterministically and with no LLM. This alone satisfies the core ask ("open
// the app → a short summary of recent activity + a nudge toward one action")
// and is the guaranteed fallback when no local model is loaded.
//
// Voice: the story guide Aria — plain です・ます, no emoji, never pushy. Copy
// variants are picked by a hash of ctx.today (NOT Math.random) so the output is
// stable for a given day and fully testable.

import type { CoachContext } from './context';

export type CoachMood = 'praise' | 'nudge' | 'rescue';

export interface CoachDigest {
  headline: string;
  bullets: string[]; // recent activity, at most 3 lines
  callToAction: string;
  mood: CoachMood;
}

// Small stable hash → index, so copy is deterministic per day.
function pick<T>(variants: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return variants[Math.abs(h) % variants.length];
}

function buildHeadline(ctx: CoachContext): string {
  const { name, daysSinceLastSeen } = ctx.character;
  if (daysSinceLastSeen >= 3) {
    return pick(
      [
        `おかえりなさい、${name}さん。${daysSinceLastSeen}日ぶりですね。`,
        `${name}さん、お久しぶりです。記録は消えていません。`,
      ],
      ctx.today
    );
  }
  if (daysSinceLastSeen >= 1) {
    return pick(
      [`おかえりなさい、${name}さん。`, `${name}さん、今日もよろしくお願いします。`],
      ctx.today
    );
  }
  return pick(
    [`${name}さん、調子はいかがですか。`, `${name}さん、今日の進捗を見てみましょう。`],
    ctx.today
  );
}

// Up to 3 recent-activity lines, in "what's most worth saying" order.
function buildBullets(ctx: CoachContext): string[] {
  const out: string[] = [];
  const q = ctx.quests;

  if (q.dailyTotal > 0) {
    out.push(`今日のデイリーは ${q.dailyDoneToday}/${q.dailyTotal} 件 完了しています。`);
  }
  if (q.topStreak && q.topStreak.streak >= 2) {
    out.push(`「${q.topStreak.title}」が ${q.topStreak.streak}日 続いています。`);
  }
  if (ctx.weight.delta14d != null && ctx.weight.delta14d !== 0) {
    const d = ctx.weight.delta14d;
    out.push(
      d < 0
        ? `体重は この2週間で ${Math.abs(d)}kg 減りました。`
        : `体重は この2週間で ${d}kg 増えています。`
    );
  }
  if (out.length < 3 && ctx.meals.avgScore7d != null) {
    out.push(`直近の食事スコアは 平均 ${ctx.meals.avgScore7d}点 です。`);
  }
  return out.slice(0, 3);
}

// The single most useful next action. First matching rule wins.
function buildCta(ctx: CoachContext): { text: string; mood: CoachMood } {
  const q = ctx.quests;
  const c = ctx.character;

  // 1) A streak is on the line today → protect the biggest one.
  if (q.atRisk.length > 0) {
    const top = q.atRisk[0];
    const shield =
      c.freezeStock > 0
        ? '(今日抜けても 継続の盾で1日ぶんは守れます)'
        : '';
    return {
      text: `まずは「${top.title}」を。連続${top.streak}日を 今日つなぎましょう。${shield}`,
      mood: 'nudge',
    };
  }

  // 2) Returning after an absence → gentle restart.
  if (c.daysSinceLastSeen >= 3) {
    return {
      text: '四日目から、いきましょう。軽いものを ひとつだけ選んでください。',
      mood: 'rescue',
    };
  }

  // 3) Dailies still open → nudge the remaining count.
  if (q.dailyTotal > 0 && q.dailyDoneToday < q.dailyTotal) {
    const remaining = q.dailyTotal - q.dailyDoneToday;
    return {
      text: `残りのクエストは ${remaining}件。今日、ひとつだけでも 進めましょう。`,
      mood: 'nudge',
    };
  }

  // 4) Quests done but no weight/meal logged today → nudge a record.
  if (q.dailyTotal > 0 && !ctx.weight.loggedToday && ctx.weight.target != null) {
    return { text: '今日の体重を まだ記録していません。1タップで残しておきましょう。', mood: 'nudge' };
  }
  if (q.dailyTotal > 0 && !ctx.meals.loggedToday && ctx.meals.avgScore7d != null) {
    return { text: '食事の記録が まだありません。今日のぶんを 残しておきましょう。', mood: 'nudge' };
  }

  // 5) Everything done → praise + look ahead.
  if (q.dailyTotal > 0 && q.dailyDoneToday >= q.dailyTotal) {
    return {
      text: pick(
        [
          '今日のクエストは すべて完了です。お見事でした。明日も この調子で。',
          '完璧です。今日はよく積み上げました。ゆっくり休んでください。',
        ],
        ctx.today
      ),
      mood: 'praise',
    };
  }

  // Fallback (brand-new account, no dailies yet).
  return {
    text: 'まずは 小さなクエストを ひとつ 作ってみましょう。そこから始まります。',
    mood: 'nudge',
  };
}

export function buildDigest(ctx: CoachContext): CoachDigest {
  const cta = buildCta(ctx);
  return {
    headline: buildHeadline(ctx),
    bullets: buildBullets(ctx),
    callToAction: cta.text,
    mood: cta.mood,
  };
}
