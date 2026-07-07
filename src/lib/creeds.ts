import type { Character, Quest } from '../types';
import { sumMedalPassive, type MedalId } from './story/medals';

// Creeds (信条) — docs/redesign/05-character.md §1 STEP3. A playstyle
// declaration granting a small, changeable passive. Wired into quest EXP and a
// few progression knobs below (alongside the EXP-type medal passives, which
// were defined in P1 but only combat passives were consumed until now).

export type CreedId = 'morning' | 'night' | 'steady' | 'focused' | 'collector' | 'thrifty';

export interface CreedDef {
  id: CreedId;
  jp: string;
  desc: string;
}

export const CREEDS: CreedDef[] = [
  { id: 'morning', jp: '朝型', desc: '午前中に終えたクエストの EXP +10%' },
  { id: 'night', jp: '夜型', desc: '18時以降のクエストの EXP +10%' },
  { id: 'steady', jp: 'コツコツ', desc: 'ストリーク補正の上限 2.0→2.2倍' },
  { id: 'focused', jp: '一点突破', desc: '週次クエストの EXP +20%' },
  { id: 'collector', jp: '収集家', desc: '影の抽出成功率 +5%' },
  { id: 'thrifty', jp: '倹約家', desc: 'ショップ購入額 -8%' },
];

export const CREED_BY_ID: Record<CreedId, CreedDef> = Object.fromEntries(
  CREEDS.map((c) => [c.id, c])
) as Record<CreedId, CreedDef>;

export const DEFAULT_CREED: CreedId = 'steady';

function medals(character: Character): MedalId[] {
  return (character.campaign?.medals ?? []) as MedalId[];
}

// Multiplier applied to a quest's base EXP at completion time. Combines the
// creed with the time/type-conditional medal EXP passives.
export function questExpMultiplier(character: Character, quest: Quest, hour: number): number {
  const creed = character.creed as CreedId | undefined;
  const owned = medals(character);
  let bonus = 0;

  // creed
  if (creed === 'morning' && hour < 12) bonus += 0.10;
  if (creed === 'night' && hour >= 18) bonus += 0.10;
  if (creed === 'focused' && quest.type === 'weekly') bonus += 0.20;

  // medals (time/type-conditional ones we can evaluate here)
  bonus += sumMedalPassive(owned, 'allExp');
  if (hour < 12) bonus += sumMedalPassive(owned, 'morningQuestExp');
  if (hour >= 18) bonus += sumMedalPassive(owned, 'nightQuestExp');
  if (quest.type === 'daily') bonus += sumMedalPassive(owned, 'todayQuestExp');

  return 1 + bonus;
}

// Streak-multiplier ceiling (base 2.0), raised by the steady creed and the
// yokkame medal.
export function streakCapFor(character: Character): number {
  const creed = character.creed as CreedId | undefined;
  let cap = 2.0;
  if (creed === 'steady') cap += 0.2;
  cap += sumMedalPassive(medals(character), 'streakCapBonus');
  return cap;
}

// Extra shadow-extraction success chance from creed + medals.
export function extractionBonusFor(character: Character): number {
  const creed = character.creed as CreedId | undefined;
  let b = sumMedalPassive(medals(character), 'extractionOdds');
  if (creed === 'collector') b += 0.05;
  return b;
}

// Shop discount fraction (0..1) from the thrifty creed.
export function shopDiscountFor(character: Character): number {
  return character.creed === 'thrifty' ? 0.08 : 0;
}
