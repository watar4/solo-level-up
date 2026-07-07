import { describe, it, expect } from 'vitest';
import type { CoachContext } from '../context';
import { buildDigest } from '../digest';

function ctx(partial: Partial<CoachContext> = {}): CoachContext {
  return {
    today: '2026-07-07',
    character: { name: 'ハンター', level: 5, rank: 'E', daysSinceLastSeen: 0, freezeStock: 1 },
    quests: { dailyTotal: 3, dailyDoneToday: 0, topStreak: null, atRisk: [], recent7d: [] },
    weight: { latest: null, delta14d: null, target: null, loggedToday: false },
    meals: { gradeToday: null, avgScore7d: null, loggedToday: false },
    economy: { gold: 0, savingsProgress: null, budgetLeft: null },
    campaign: null,
    ...partial,
  };
}

describe('buildDigest — call-to-action priority (docs 09 §2)', () => {
  it('prioritises protecting an at-risk streak', () => {
    const d = buildDigest(
      ctx({
        quests: { dailyTotal: 3, dailyDoneToday: 1, topStreak: null, atRisk: [{ title: '腕立て', streak: 12 }], recent7d: [] },
      })
    );
    expect(d.callToAction).toContain('腕立て');
    expect(d.callToAction).toContain('12');
    expect(d.mood).toBe('nudge');
  });

  it('mentions the freeze shield in the at-risk CTA when stock remains', () => {
    const d = buildDigest(
      ctx({
        character: { name: 'ハンター', level: 5, rank: 'E', daysSinceLastSeen: 0, freezeStock: 1 },
        quests: { dailyTotal: 1, dailyDoneToday: 0, topStreak: null, atRisk: [{ title: 'X', streak: 4 }], recent7d: [] },
      })
    );
    expect(d.callToAction).toContain('継続の盾');
  });

  it('gives a rescue CTA when returning after 3+ days with nothing at risk', () => {
    const d = buildDigest(
      ctx({
        character: { name: 'ハンター', level: 5, rank: 'E', daysSinceLastSeen: 5, freezeStock: 0 },
        quests: { dailyTotal: 2, dailyDoneToday: 0, topStreak: null, atRisk: [], recent7d: [] },
      })
    );
    expect(d.mood).toBe('rescue');
    expect(d.headline).toContain('5日');
  });

  it('nudges remaining count when dailies are open', () => {
    const d = buildDigest(
      ctx({ quests: { dailyTotal: 4, dailyDoneToday: 1, topStreak: null, atRisk: [], recent7d: [] } })
    );
    expect(d.callToAction).toContain('3件');
    expect(d.mood).toBe('nudge');
  });

  it('praises when everything is done', () => {
    const d = buildDigest(
      ctx({ quests: { dailyTotal: 3, dailyDoneToday: 3, topStreak: null, atRisk: [], recent7d: [] } })
    );
    expect(d.mood).toBe('praise');
  });

  it('falls back to a create-quest prompt for a brand-new account', () => {
    const d = buildDigest(
      ctx({ quests: { dailyTotal: 0, dailyDoneToday: 0, topStreak: null, atRisk: [], recent7d: [] } })
    );
    expect(d.callToAction).toContain('クエスト');
    expect(d.mood).toBe('nudge');
  });

  it('is deterministic for a given day', () => {
    const input = ctx({ quests: { dailyTotal: 2, dailyDoneToday: 2, topStreak: null, atRisk: [], recent7d: [] } });
    expect(buildDigest(input)).toEqual(buildDigest(input));
  });

  it('caps bullets at 3 lines', () => {
    const d = buildDigest(
      ctx({
        quests: { dailyTotal: 3, dailyDoneToday: 2, topStreak: { title: 'A', streak: 9 }, atRisk: [], recent7d: [] },
        weight: { latest: 70, delta14d: -1.2, target: 65, loggedToday: false },
        meals: { gradeToday: 'B', avgScore7d: 78, loggedToday: true },
      })
    );
    expect(d.bullets.length).toBeLessThanOrEqual(3);
  });
});
