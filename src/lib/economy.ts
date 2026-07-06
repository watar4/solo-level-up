import type { Character, Difficulty } from '../types';
import { isMiniBossFloor } from './boss';

// ── Gold sources ───────────────────────────────────────────────────────
//
// The gold economy ties the three loops together:
//   habits (quests) → gold → shop items → boss tower
//   real-world savings (yen) → gold → same sinks
// Quest gold sits at roughly half the EXP value so a day of habits funds
// a potion, a strong week funds a gacha pull.

export const QUEST_GOLD: Record<Difficulty, number> = {
  E: 5,
  D: 10,
  C: 20,
  B: 40,
  A: 80,
  S: 150,
};

// Boss victory purse. Grows with the floor so the tower stays the best
// gold-per-minute sink for a built character. Mini-boss floors pay 1.5×.
export function bossGoldReward(floor: number): number {
  const base = 30 + Math.max(0, floor - 1) * 10;
  return isMiniBossFloor(floor) ? Math.round(base * 1.5) : base;
}

// Real yen → gold conversion for savings deposits. 100円 = 1G keeps a
// 10,000円 deposit (100G) comparable to a strong quest week — meaningful
// but not economy-breaking.
export const YEN_PER_GOLD = 100;

export function goldForSavings(amountYen: number): number {
  return Math.max(0, Math.floor(amountYen / YEN_PER_GOLD));
}

// Month-end reward when card spending stayed within the budget goal.
export const BUDGET_REWARD_GOLD = 300;
export const BUDGET_REWARD_EXP = 200;

export function walletGold(character: Pick<Character, 'gold'>): number {
  return Math.max(0, character.gold ?? 0);
}

// Compact display for gold readouts in tight HUD slots. Full precision up
// to 6 digits, then 万/億 units so the number can never blow the layout.
export function formatGold(n: number): string {
  const v = Math.max(0, Math.floor(n));
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}億`;
  if (v >= 1_000_000) return `${Math.floor(v / 10_000)}万`;
  return v.toLocaleString('ja-JP');
}

// ── Consumables catalog ────────────────────────────────────────────────
//
// Counts live on the character doc (`consumables[templateId]`), purchases
// and battle usage are single-field patches. Effects resolve inside the
// boss battle loop.

export type ConsumableEffect =
  | { type: 'heal'; percent: number }          // restore % of max HP
  | { type: 'attack-boost'; multiplier: number } // next attack × multiplier
  | { type: 'revive'; percent: number };        // auto-revive once at % HP

export interface ConsumableTemplate {
  id: string;
  name: string;
  icon: string;      // emoji — consistent with SystemEvent icons
  price: number;     // gold
  description: string;
  effect: ConsumableEffect;
}

export const CONSUMABLES: ConsumableTemplate[] = [
  {
    id: 'potion',
    name: 'ポーション',
    icon: '🧪',
    price: 60,
    description: 'HPを40%回復する',
    effect: { type: 'heal', percent: 0.4 },
  },
  {
    id: 'hi-potion',
    name: 'ハイポーション',
    icon: '💠',
    price: 150,
    description: 'HPを全回復する',
    effect: { type: 'heal', percent: 1 },
  },
  {
    id: 'power-crystal',
    name: '力の結晶',
    icon: '💥',
    price: 100,
    description: '次の攻撃のダメージが2倍になる',
    effect: { type: 'attack-boost', multiplier: 2 },
  },
  {
    id: 'phoenix-feather',
    name: '不死鳥の羽根',
    icon: '🪶',
    price: 350,
    description: '戦闘不能時、一度だけHP50%で復活する(持っているだけで発動)',
    effect: { type: 'revive', percent: 0.5 },
  },
];

const CONSUMABLE_BY_ID = new Map(CONSUMABLES.map((c) => [c.id, c] as const));

export function getConsumable(id: string): ConsumableTemplate | undefined {
  return CONSUMABLE_BY_ID.get(id);
}

export function consumableCount(character: Pick<Character, 'consumables'>, id: string): number {
  return Math.max(0, character.consumables?.[id] ?? 0);
}

// ── Weapon gacha ───────────────────────────────────────────────────────
// A gold sink that reuses the chest-loot roll. Priced so it takes a few
// days of quests — impulse-buyable but not spammable.
export const WEAPON_GACHA_PRICE = 400;
