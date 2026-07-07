import { describe, it, expect } from 'vitest';
import type { Character, StatKey } from '../../types';
import {
  renderAvatar, normalizeAppearance, migrateAppearance, randomAppearance,
} from '../appearance';
import {
  classStatBonus, resolveJobNode, advancementOptions, jobCombatMods, effectiveTier,
} from '../jobs';
import { questExpMultiplier, streakCapFor, shopDiscountFor, extractionBonusFor } from '../creeds';

function char(p: Partial<Character> = {}): Character {
  const stats: Record<StatKey, number> = { STR: 10, AGI: 10, INT: 10, VIT: 10, PER: 10 };
  return {
    uid: 't', name: 'テスト', level: 1, exp: 0, totalExp: 0, stats,
    statPoints: 0, createdAt: 0, lastSeenAt: 0,
    appearance: { hunterClass: 'knight', primaryColor: '#fff', accentColor: '#000' },
    ...p,
  };
}

describe('appearance (parts avatar)', () => {
  it('renders a 24×24 rectangular grid for varied parts', () => {
    const a = renderAvatar({
      hunterClass: 'mage', primaryColor: '#7a3ac3', accentColor: '#dbb56a',
      skin: '#cf9c70', hair: 'ponytail', hairColor: '#2f5aa0', eyes: 'sharp',
      eyeColor: '#c0392b', outfit: 'robe', accessory: 'glasses',
    });
    expect(a.grid.length).toBe(24);
    for (const row of a.grid) expect(row.length).toBe(24);
  });

  it('normalizes a legacy appearance and migrates it to v2', () => {
    const legacy = { hunterClass: 'hunter' as const, primaryColor: '#2f8a3e', accentColor: '#8a5a2a' };
    const norm = normalizeAppearance(legacy);
    expect(norm.hair).toBeTruthy();
    const migrated = migrateAppearance(legacy);
    expect(migrated.hair).toBeTruthy();
    expect(migrated.hunterClass).toBe('hunter');
    // already-v2 passes through
    expect(migrateAppearance(migrated)).toBe(migrated);
  });

  it('randomAppearance is deterministic under a seeded rng and valid', () => {
    let s = 1;
    const rng = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const a = randomAppearance('scout', rng);
    expect(a.hunterClass).toBe('scout');
    expect(renderAvatar(a).grid.length).toBe(24);
  });
});

describe('jobs (class mechanics)', () => {
  it('class stat bonus scales +1/level for the two growth stats', () => {
    const b0 = classStatBonus(char({ level: 1 }));
    expect(b0.STR ?? 0).toBe(0);
    const b = classStatBonus(char({ level: 21 })); // knight → STR/VIT
    expect(b.STR).toBe(20);
    expect(b.VIT).toBe(20);
    expect(b.INT ?? 0).toBe(0);
  });

  it('resolveJobNode respects the level gates', () => {
    const c = char({ level: 19, job: { base: 'knight', tier2: 'k-knight' } });
    expect(resolveJobNode(c).tier).toBe(1); // Lv19 < 20 → still base
    expect(effectiveTier({ ...c, level: 20 })).toBe(2);
    const c3 = char({ level: 39, job: { base: 'knight', tier2: 'k-knight', tier3: 'k-paladin' } });
    expect(resolveJobNode(c3).tier).toBe(2);
    expect(effectiveTier({ ...c3, level: 40 })).toBe(3);
  });

  it('advancement options appear at Lv20 and Lv40', () => {
    expect(advancementOptions(char({ level: 19 }))).toHaveLength(0);
    const t2 = advancementOptions(char({ level: 20 }));
    expect(t2.length).toBe(2);
    expect(t2.every((n) => n.tier === 2 && n.base === 'knight')).toBe(true);
    const t3 = advancementOptions(char({ level: 40, job: { base: 'knight', tier2: 'k-knight' } }));
    expect(t3.length).toBe(2);
    expect(t3.every((n) => n.tier === 3 && n.parent === 'k-knight')).toBe(true);
  });

  it('combat mods are class-specific and scale with tier', () => {
    const knight = jobCombatMods(char({ level: 1 }));
    expect(knight.damageTakenMult).toBeCloseTo(0.92);
    expect(knight.atbBonus).toBe(0);
    const mage = jobCombatMods(char({ appearance: { hunterClass: 'mage', primaryColor: '#0', accentColor: '#0' } }));
    expect(mage.cooldownReduction).toBe(1);
    // tier2 knight = stronger reduction + bigger ultimate
    const t2 = jobCombatMods(char({ level: 20, job: { base: 'knight', tier2: 'k-knight' } }));
    expect(t2.damageTakenMult).toBeCloseTo(0.88);
    expect(t2.ultimatePower).toBeGreaterThan(knight.ultimatePower);
  });
});

describe('creeds (progression passives)', () => {
  const daily = { type: 'daily' as const };
  const weekly = { type: 'weekly' as const };

  it('morning/night creed applies by hour', () => {
    const m = char({ creed: 'morning' });
    expect(questExpMultiplier(m, daily as never, 9)).toBeCloseTo(1.10);
    expect(questExpMultiplier(m, daily as never, 15)).toBeCloseTo(1.0);
    const n = char({ creed: 'night' });
    expect(questExpMultiplier(n, daily as never, 20)).toBeCloseTo(1.10);
  });

  it('focused creed boosts weekly quests; allExp medal is unconditional', () => {
    const f = char({ creed: 'focused' });
    expect(questExpMultiplier(f, weekly as never, 15)).toBeCloseTo(1.20);
    const withMedal = char({ creed: 'focused', campaign: { version: 1, will: { stock: 0, earnedToday: 0, date: '' }, chapter: 1, clearedChapters: [], clearedNodes: {}, medals: ['tsuzuketa'], defeatedEnemies: [], dialogueSeen: [], lordAttempts: [] } });
    expect(questExpMultiplier(withMedal, weekly as never, 15)).toBeCloseTo(1.30); // +0.20 creed +0.10 allExp
  });

  it('streak cap, shop discount and extraction bonus reflect creed/medals', () => {
    expect(streakCapFor(char({ creed: 'steady' }))).toBeCloseTo(2.2);
    expect(shopDiscountFor(char({ creed: 'thrifty' }))).toBeCloseTo(0.08);
    expect(extractionBonusFor(char({ creed: 'collector' }))).toBeCloseTo(0.05);
    expect(streakCapFor(char({}))).toBeCloseTo(2.0);
  });
});
