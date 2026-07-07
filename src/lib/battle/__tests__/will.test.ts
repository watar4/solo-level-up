import { describe, it, expect } from 'vitest';
import {
  initWill,
  earnWill,
  canFight,
  spendWill,
  refundOnFirstLordLoss,
  ungrantWill,
  rollDay,
  WILL_MAX,
  WILL_DAILY_EARN_CAP,
} from '../will';

const DAY = '2026-07-07';
const NEXT = '2026-07-08';

describe('will system', () => {
  it('earns 1 per daily quest up to the stock cap', () => {
    let s = initWill(DAY);
    for (let i = 0; i < 5; i++) s = earnWill(s, 'daily', DAY).state;
    expect(s.stock).toBe(WILL_MAX);
  });

  it('honours the per-day earn cap even after spending frees stock', () => {
    let s = initWill(DAY);
    // earn the daily max (3)
    s = earnWill(s, 'daily', DAY).state;
    s = earnWill(s, 'daily', DAY).state;
    s = earnWill(s, 'daily', DAY).state;
    expect(s.earnedToday).toBe(WILL_DAILY_EARN_CAP);
    // spend two, then try to earn again the same day → blocked by daily cap
    s = spendWill(s, 'lord'); // costs 2
    const r = earnWill(s, 'daily', DAY);
    expect(r.granted).toBe(0);
    expect(r.state.stock).toBe(1);
  });

  it('resets the daily earn counter on a new day but keeps stock', () => {
    let s = initWill(DAY);
    s = earnWill(s, 'daily', DAY).state;
    s = earnWill(s, 'daily', DAY).state;
    s = earnWill(s, 'daily', DAY).state; // earnedToday=3, stock=3
    const rolled = rollDay(s, NEXT);
    expect(rolled.earnedToday).toBe(0);
    expect(rolled.stock).toBe(3);
    const r = earnWill(rolled, 'daily', NEXT);
    // stock already full so nothing granted, but earning is no longer day-capped
    expect(r.granted).toBe(0);
  });

  it('weekly quests grant 2, clamped by remaining room', () => {
    let s = initWill(DAY); // stock 0, room 3
    const r = earnWill(s, 'weekly', DAY);
    expect(r.granted).toBe(2);
    expect(r.state.stock).toBe(2);
  });

  it('gates fights on cost and spends correctly', () => {
    let s = initWill(DAY);
    s = earnWill(s, 'daily', DAY).state; // stock 1
    expect(canFight(s, 'mob')).toBe(true);
    expect(canFight(s, 'lord')).toBe(false);
    s = spendWill(s, 'mob');
    expect(s.stock).toBe(0);
    expect(() => spendWill(s, 'mob')).toThrow();
  });

  it('refunds one will on a first lord loss, capped', () => {
    const s = { stock: WILL_MAX, earnedToday: 0, date: DAY };
    expect(refundOnFirstLordLoss(s).stock).toBe(WILL_MAX); // cannot exceed cap
    const low = { stock: 0, earnedToday: 3, date: DAY };
    expect(refundOnFirstLordLoss(low).stock).toBe(1);
  });

  it('ungrantWill takes back exactly the logged grant (closes the toggle farm)', () => {
    // complete → +1; uncheck → −1; complete again → +1: net one grant.
    let s = initWill(DAY);
    s = earnWill(s, 'daily', DAY).state;           // stock 1, earned 1
    s = ungrantWill(s, 1, DAY);                    // back to 0 / 0
    expect(s.stock).toBe(0);
    expect(s.earnedToday).toBe(0);
    const again = earnWill(s, 'daily', DAY);
    expect(again.granted).toBe(1);                 // NOT capped out by the toggle
    expect(again.state.stock).toBe(1);
    expect(again.state.earnedToday).toBe(1);
  });

  it('ungrantWill clamps at zero and ignores a 0 grant', () => {
    let s = initWill(DAY);
    s = earnWill(s, 'daily', DAY).state;           // 1/1
    s = spendWill(s, 'mob');                       // stock 0, earned 1
    const after = ungrantWill(s, 1, DAY);          // stock clamps at 0, earned → 0
    expect(after.stock).toBe(0);
    expect(after.earnedToday).toBe(0);
    expect(ungrantWill(after, 0, DAY)).toEqual(after); // legacy log: no-op
  });
});
