// Will (戦意) — docs/redesign/03-battle-system.md §1.
// The core loop: completing habit quests is the ONLY way to earn the right to
// fight, so battle becomes the reward for habits instead of a free side-mode.
// Pure logic over a small state object; persistence (Firestore progress/will)
// is wired in a later increment (docs/redesign/07-implementation.md §4).

export const WILL_MAX = 3;              // stock cap
export const WILL_DAILY_EARN_CAP = 3;  // most that can be earned per day
export const WILL_PER_DAILY_QUEST = 1;
export const WILL_PER_WEEKLY_QUEST = 2;

export type BattleKind = 'mob' | 'elite' | 'lord' | 'corridor';

// Will cost to attempt each battle kind.
export const WILL_COST: Record<BattleKind, number> = {
  mob: 1,
  elite: 1,
  lord: 2,
  corridor: 1,
};

export interface WillState {
  stock: number;        // 0..WILL_MAX
  earnedToday: number;  // resets when `date` rolls over
  date: string;         // YYYY-MM-DD the earnedToday counter belongs to
}

export function initWill(date: string): WillState {
  return { stock: 0, earnedToday: 0, date };
}

// Normalise the daily-earn counter against today's date. Stock persists across
// days; only the per-day earn cap resets.
export function rollDay(state: WillState, today: string): WillState {
  if (state.date === today) return state;
  return { ...state, earnedToday: 0, date: today };
}

export type WillSource = 'daily' | 'weekly';

// Earn Will from completing a quest, honouring both the stock cap and the
// daily earn cap. Returns the new state plus how much was actually granted
// (0 if capped) for UI feedback.
export interface EarnResult {
  state: WillState;
  granted: number;
}

export function earnWill(state: WillState, source: WillSource, today: string): EarnResult {
  const rolled = rollDay(state, today);
  const requested = source === 'weekly' ? WILL_PER_WEEKLY_QUEST : WILL_PER_DAILY_QUEST;

  const dailyRoom = Math.max(0, WILL_DAILY_EARN_CAP - rolled.earnedToday);
  const stockRoom = Math.max(0, WILL_MAX - rolled.stock);
  const granted = Math.min(requested, dailyRoom, stockRoom);

  return {
    state: {
      ...rolled,
      stock: rolled.stock + granted,
      earnedToday: rolled.earnedToday + granted,
    },
    granted,
  };
}

export function canFight(state: WillState, kind: BattleKind): boolean {
  return state.stock >= WILL_COST[kind];
}

// Spend Will to start a battle. Throws if there isn't enough — callers should
// gate on canFight() first.
export function spendWill(state: WillState, kind: BattleKind): WillState {
  const cost = WILL_COST[kind];
  if (state.stock < cost) {
    throw new Error(`Not enough Will: need ${cost}, have ${state.stock}`);
  }
  return { ...state, stock: state.stock - cost };
}

// Refund on a lord's FIRST defeat only (docs §1: "領主戦は初回敗北のみ 1 返還").
// The caller tracks whether this lord has been attempted before.
export function refundOnFirstLordLoss(state: WillState): WillState {
  return { ...state, stock: Math.min(WILL_MAX, state.stock + 1) };
}

// Take back Will granted by a quest completion that is being unchecked. The
// exact grant is read from the completion log, so this never removes Will the
// quest didn't give (closes the check→uncheck→check farming loop). Both the
// stock and the daily earn counter roll back, each clamped at 0.
export function ungrantWill(state: WillState, granted: number, today: string): WillState {
  const rolled = rollDay(state, today);
  const dec = Math.max(0, granted);
  if (dec === 0) return rolled;
  return {
    ...rolled,
    stock: Math.max(0, rolled.stock - dec),
    earnedToday: Math.max(0, rolled.earnedToday - dec),
  };
}
