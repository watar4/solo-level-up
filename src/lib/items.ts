import type { Item, ShadowRarity, StatKey } from '../types';
import { ALL_STATS } from '../types';

// Weapons are the only item kind for now. Bonus is flat +N to the
// weapon's primary stat when equipped — these stack with the player's
// base stats, replacing the old "shadows give passive bonus" pipeline.
const WEAPON_BONUS: Record<ShadowRarity, number> = {
  normal: 3,
  rare: 6,
  epic: 12,
  legendary: 20,
};

export function weaponBonusFor(rarity: ShadowRarity): number {
  return WEAPON_BONUS[rarity];
}

export interface WeaponTemplate {
  id: string;
  name: string;
  stat: StatKey;
  rarity: ShadowRarity;
}

// 5 stats × 4 rarities = 20 templates. Names lean into the stat archetype.
export const WEAPON_TEMPLATES: WeaponTemplate[] = [
  // STR — swords, axes
  { id: 'w-str-n', name: '鉄剣', stat: 'STR', rarity: 'normal' },
  { id: 'w-str-r', name: '鋼の剣', stat: 'STR', rarity: 'rare' },
  { id: 'w-str-e', name: '業火の大剣', stat: 'STR', rarity: 'epic' },
  { id: 'w-str-l', name: '覇王剣', stat: 'STR', rarity: 'legendary' },
  // AGI — bows
  { id: 'w-agi-n', name: '短弓', stat: 'AGI', rarity: 'normal' },
  { id: 'w-agi-r', name: '双月の弓', stat: 'AGI', rarity: 'rare' },
  { id: 'w-agi-e', name: '疾風の弓', stat: 'AGI', rarity: 'epic' },
  { id: 'w-agi-l', name: '閃光の弓', stat: 'AGI', rarity: 'legendary' },
  // INT — staves
  { id: 'w-int-n', name: '魔導書', stat: 'INT', rarity: 'normal' },
  { id: 'w-int-r', name: '賢者の杖', stat: 'INT', rarity: 'rare' },
  { id: 'w-int-e', name: '業炎の杖', stat: 'INT', rarity: 'epic' },
  { id: 'w-int-l', name: '破滅の杖', stat: 'INT', rarity: 'legendary' },
  // VIT — shields
  { id: 'w-vit-n', name: '鉄盾', stat: 'VIT', rarity: 'normal' },
  { id: 'w-vit-r', name: '鋼の盾', stat: 'VIT', rarity: 'rare' },
  { id: 'w-vit-e', name: '聖盾', stat: 'VIT', rarity: 'epic' },
  { id: 'w-vit-l', name: '不滅の盾', stat: 'VIT', rarity: 'legendary' },
  // PER — daggers
  { id: 'w-per-n', name: '短刀', stat: 'PER', rarity: 'normal' },
  { id: 'w-per-r', name: '双月の双剣', stat: 'PER', rarity: 'rare' },
  { id: 'w-per-e', name: '影刃', stat: 'PER', rarity: 'epic' },
  { id: 'w-per-l', name: '真理の刃', stat: 'PER', rarity: 'legendary' },
];

const WEAPON_BY_ID = new Map(WEAPON_TEMPLATES.map((t) => [t.id, t] as const));

export function getWeaponTemplate(id: string): WeaponTemplate | undefined {
  return WEAPON_BY_ID.get(id);
}

// Chest drop probability when the boss is defeated — independent of the
// shadow-extraction roll. The chance scales gently with the floor so the
// player isn't drowning in weapons by floor 30 and isn't empty-handed
// either.
const BASE_CHEST_CHANCE = 0.25;
const CHEST_CHANCE_PER_FLOOR = 0.012; // +1.2% per floor
const CHEST_CHANCE_CAP = 0.65;

export function treasureChestChance(floor: number): number {
  return Math.min(
    CHEST_CHANCE_CAP,
    BASE_CHEST_CHANCE + Math.max(0, floor - 1) * CHEST_CHANCE_PER_FLOOR
  );
}

// Weapon roll on chest open. Rarity weights bias up with both player
// level and current floor — the deeper you climb, the better the loot.
export function rollChestWeapon(
  args: { playerLevel: number; floor: number },
  rng: () => number = Math.random
): WeaponTemplate {
  const power = args.playerLevel + args.floor * 1.5;
  const quality = Math.min(1, power / 80);
  const r = rng();
  let rarity: ShadowRarity;
  if (r < 0.03 + quality * 0.20) rarity = 'legendary';
  else if (r < 0.12 + quality * 0.25) rarity = 'epic';
  else if (r < 0.40 + quality * 0.20) rarity = 'rare';
  else rarity = 'normal';
  const stat = ALL_STATS[Math.floor(rng() * ALL_STATS.length)];
  // Fallback to the right rarity if the (stat, rarity) combo is somehow
  // missing — should never happen because the table is complete.
  return (
    WEAPON_TEMPLATES.find((t) => t.stat === stat && t.rarity === rarity) ??
    WEAPON_TEMPLATES.find((t) => t.rarity === rarity)!
  );
}

export function equippedWeapon(items: Item[]): Item | null {
  return items.find((i) => i.kind === 'weapon' && i.equipped) ?? null;
}

// Effective stat bonus from the currently-equipped weapon. {} if nothing
// equipped. Returned as a Partial so callers can spread it into a full
// stats map cleanly.
export function weaponStatBonus(items: Item[]): Partial<Record<StatKey, number>> {
  const w = equippedWeapon(items);
  if (!w) return {};
  return { [w.stat]: weaponBonusFor(w.rarity) };
}
