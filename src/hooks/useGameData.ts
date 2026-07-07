import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  drainWeightInbox,
  loadCharacter,
  subscribeQuests,
  createCharacter,
  createQuest,
  updateCharacter,
  deleteCharacter,
  updateQuest,
  deleteQuest,
  logCompletion,
  getCompletionsForQuest,
  getAllCompletions,
  deleteCompletions,
  deleteAllByUid,
  addShadow,
  setFocusGate,
  deleteFocusGate,
} from '../lib/firestore';
import {
  buildMasterCharacter,
  buildMasterShadows,
  isMasterEmail,
} from '../lib/masterConfig';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type {
  ActivityLevel,
  Character,
  DietType,
  HunterAppearance,
  NutritionTarget,
  Quest,
  SavingsGoal,
  StatKey,
  SystemEvent,
  UnlockState,
} from '../types';
import { DIFFICULTY_EXP, EMPTY_UNLOCK } from '../types';
import { QUEST_GOLD, getConsumable } from '../lib/economy';
import {
  applyExp,
  levelFromTotalExp,
  rankForLevel,
  todayKey,
  yesterdayKey,
  previousDayKey,
} from '../lib/leveling';
import {
  buildAchievementContext,
  newlyUnlockedAchievements,
  type AchievementDef,
} from '../lib/achievements';
import { newlyUnlockedSkills, type SkillDef } from '../lib/skills';
import { ensureCampaign, defaultCampaign, type CampaignState } from '../lib/story/campaign';
import { earnWill, ungrantWill } from '../lib/battle/will';
import { questExpMultiplier, streakCapFor, shopDiscountFor, DEFAULT_CREED } from '../lib/creeds';
import { migrateAppearance } from '../lib/appearance';
import { JOB_BY_ID, TIER2_LEVEL, TIER3_LEVEL } from '../lib/jobs';
import { nextStreak, reconcileFreeze, weekStartKey } from '../lib/streak';

export interface QuestEditPatch {
  title: string;
  description: string;
  type: Quest['type'];
  targetStat: StatKey;
  difficulty: Quest['difficulty'];
}

export interface GameData {
  character: Character | null;
  quests: Quest[];
  loading: boolean;
  needsCharacter: boolean;
  busyQuestId: string | null;
  pendingEvents: SystemEvent[];
  popEvent: () => void;
  createCharacterWithName: (name: string, appearance?: HunterAppearance, creed?: string) => Promise<void>;
  toggleQuest: (quest: Quest) => Promise<void>;
  removeQuestWithRefund: (quest: Quest) => Promise<void>;
  editQuest: (quest: Quest, patch: QuestEditPatch) => Promise<void>;
  moveQuest: (quest: Quest, direction: 'up' | 'down') => Promise<void>;
  reorderActive: (from: number, to: number) => Promise<void>;
  renameCharacter: (name: string) => Promise<void>;
  updateAppearance: (appearance: HunterAppearance) => Promise<void>;
  updateCreed: (creed: string) => Promise<void>;
  // Advance to a tier-2 (Lv20) or tier-3 (Lv40) job node.
  advanceJob: (nodeId: string) => Promise<void>;
  setEquippedSkills: (skillIds: string[]) => Promise<void>;
  incrementBossesDefeated: () => Promise<void>;
  allocateStatPoint: (stat: StatKey) => Promise<void>;
  setWeightTarget: (target: number | null) => Promise<void>;
  // Persist the nutrition-goal inputs (diet preset / activity level / deadline).
  // Pass only the fields you want to change; null on weightTargetDate clears it.
  setNutritionConfig: (patch: {
    dietType?: DietType;
    activityLevel?: ActivityLevel;
    weightTargetDate?: string | null;
  }) => Promise<void>;
  // Store a manual PFC/kcal override (null reverts to the auto-computed value).
  setNutritionTarget: (target: NutritionTarget | null) => Promise<void>;
  // Grant the once-daily "hit your nutrition goal" EXP. No-ops (returns false)
  // if already granted for `dateKey`. Returns true when EXP was awarded.
  awardNutritionExp: (amount: number, dateKey: string) => Promise<boolean>;
  // Enable/disable the iOS focus gate. Pass a fresh secret to enable (also
  // seeds the public gate doc), or null to disable (removes the gate doc).
  setGateSecret: (secret: string | null) => Promise<void>;
  resetAccount: () => Promise<void>;
  // Master-only: overwrite the current character + grant 5 legendary
  // shadows. Visible/usable in the UI only for emails in MASTER_EMAILS.
  initializeMaster: () => Promise<void>;
  isMaster: boolean;
  // Lets external systems (shadow drops, boss rewards) push events into the
  // shared SystemToast queue.
  enqueueEvent: (event: SystemEvent) => void;
  // Apply EXP gained from non-quest sources (boss reward, etc).
  awardExp: (amount: number) => Promise<void>;
  // ----- gold economy -----
  // Grant gold from non-quest sources (boss purse, savings conversion).
  addGold: (amount: number) => Promise<void>;
  // Spend gold if the wallet covers it. Returns false (no write) otherwise.
  spendGold: (amount: number) => Promise<boolean>;
  // Shop purchase: price check + wallet decrement + consumable increment in
  // one character patch. Returns false when gold is insufficient.
  buyConsumable: (consumableId: string) => Promise<boolean>;
  // Consume one unit (battle usage). Returns false when none held.
  useConsumable: (consumableId: string) => Promise<boolean>;
  // Record a shadow template as "seen" for the dex (survives discards).
  recordDexShadow: (templateId: string) => Promise<void>;
  // ----- story campaign -----
  // Current campaign save-state (Will, chapter progress, medals). Always
  // defined (defaults seeded on read); persist changes via saveCampaign.
  campaign: CampaignState;
  saveCampaign: (next: CampaignState) => Promise<void>;
  // ----- real-world savings link -----
  setSavingsGoal: (goal: SavingsGoal | null) => Promise<void>;
  setMonthlyBudget: (amount: number | null) => Promise<void>;
  // Guard so the under-budget month reward fires once per YYYY-MM.
  markBudgetRewarded: (month: string) => Promise<void>;
}

function isQuestDoneToday(quest: Quest): boolean {
  // Daily and weekly are both checkable once per day; weekly simply
  // accumulates those daily checks across the week (see weeklyCompletionCount).
  if (quest.type === 'daily' || quest.type === 'weekly') {
    return quest.completedDates.includes(todayKey());
  }
  return quest.completedDates.length > 0;
}

const STAT_PER_DIFFICULTY: Record<string, number> = {
  E: 1,
  D: 1,
  C: 2,
  B: 3,
  A: 5,
  S: 8,
};

function streakMultiplier(type: Quest['type'], streak: number, cap = 2): number {
  if (type !== 'daily') return 1;
  return Math.min(cap, 1 + 0.1 * Math.max(0, streak - 1));
}

function recomputeStreak(type: Quest['type'], remainingDates: string[]): number {
  if (type !== 'daily') return 0;
  const set = new Set(remainingDates);
  let cursor = yesterdayKey();
  let count = 0;
  while (set.has(cursor)) {
    count++;
    cursor = previousDayKey(cursor);
  }
  return count;
}

function ensureUnlocked(c: Character): UnlockState {
  return c.unlocked ?? EMPTY_UNLOCK;
}

// One-time upgrade of pre-v2 characters: expand the appearance to the parts
// model, seed job.base from the old class, default the creed, and re-derive
// the level from lifetime EXP under the resloped curve. Returns the patch to
// persist, or null when nothing needs migrating.
function migrateCharacterFields(c: Character): Partial<Character> | null {
  const patch: Partial<Character> = {};
  if (c.appearance && !c.appearance.hair) patch.appearance = migrateAppearance(c.appearance);
  if (!c.job) patch.job = { base: c.appearance?.hunterClass ?? 'knight' };
  if (!c.creed) patch.creed = DEFAULT_CREED;
  // Curve reslope (leveling.ts): the new curve is cheaper, so pre-reslope
  // saves derive a HIGHER level from the same totalExp. Re-derive here (with
  // the stat-point award for the gained levels) so the jump happens once at
  // load — not as a surprise inside the first EXP refund. Upgrade-only:
  // synthetic saves whose stored level exceeds the derived one (e.g. the
  // master seed) are left alone.
  const derived = levelFromTotalExp(c.totalExp);
  if (derived.level > c.level) {
    patch.level = derived.level;
    patch.exp = derived.exp;
    patch.statPoints = c.statPoints + (derived.level - c.level) * 5;
  }
  return Object.keys(patch).length ? patch : null;
}

function achievementEvent(a: AchievementDef): SystemEvent {
  return {
    id: `achievement:${a.id}:${Date.now()}`,
    kind: 'achievement',
    title: '称号獲得',
    primary: a.name,
    secondary: a.description,
    icon: a.icon,
    accent: 'gold',
  };
}

function skillEvent(s: SkillDef): SystemEvent {
  return {
    id: `skill:${s.id}:${Date.now()}`,
    kind: 'skill',
    title: 'スキル解放',
    primary: s.name,
    secondary: s.description,
    icon: s.icon,
    accent: 'purple',
  };
}

// Evaluate achievements + skills against the given character/quest state.
// Returns the patched character + the events to enqueue. Pure — caller persists.
function evaluateUnlocks(character: Character, quests: Quest[]): {
  patched: Character;
  events: SystemEvent[];
} {
  const ctx = buildAchievementContext(character, quests);
  const newAchievements = newlyUnlockedAchievements(ctx);
  const newSkills = newlyUnlockedSkills(character, quests);
  if (!newAchievements.length && !newSkills.length) {
    return { patched: character, events: [] };
  }

  const unlock = ensureUnlocked(character);
  const now = Date.now();
  const achievements = [...unlock.achievements, ...newAchievements.map((a) => a.id)];
  const skills = [...unlock.skills, ...newSkills.map((s) => s.id)];
  const achievementDates = { ...unlock.achievementDates };
  const skillDates = { ...unlock.skillDates };
  let extraStatPoints = 0;
  let title = character.title;
  for (const a of newAchievements) {
    achievementDates[a.id] = now;
    if (a.reward?.statPoints) extraStatPoints += a.reward.statPoints;
    if (a.reward?.title) title = a.reward.title;
  }
  for (const s of newSkills) {
    skillDates[s.id] = now;
  }

  const patched: Character = {
    ...character,
    unlocked: { achievements, achievementDates, skills, skillDates },
    statPoints: character.statPoints + extraStatPoints,
    title,
  };

  const events: SystemEvent[] = [
    ...newAchievements.map(achievementEvent),
    ...newSkills.map(skillEvent),
  ];
  return { patched, events };
}

export function useGameData(user: User | null): GameData {
  const [character, setCharacter] = useState<Character | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsCharacter, setNeedsCharacter] = useState(false);
  const [pendingEvents, setPendingEvents] = useState<SystemEvent[]>([]);
  const [busyQuestId, setBusyQuestId] = useState<string | null>(null);
  // Last YYYY-MM-DD we published "gate open" for, to avoid redundant writes.
  const gateWriteRef = useRef<string | null>(null);
  // Fire the returning-user catch-up nudge at most once per session.
  const catchupShownRef = useRef(false);

  // Always-current mirror of `character`. The small mutators below (gold,
  // dex, campaign, consumables …) are frequently CHAINED inside one async
  // flow (battle rewards: gold → shadow → campaign). Each useCallback closes
  // over the render-time `character`, so spreading that would silently revert
  // the previous step's field both locally and — because the character doc has
  // no live snapshot subscription — on the next absolute-value write to
  // Firestore. Mutators therefore read from this ref and commit through
  // commitCharacter, which updates the ref synchronously so the next awaited
  // step in the same chain sees the fresh value.
  const characterRef = useRef<Character | null>(null);
  useEffect(() => {
    characterRef.current = character;
  }, [character]);
  const commitCharacter = useCallback((next: Character) => {
    characterRef.current = next;
    setCharacter(next);
  }, []);

  const enqueue = useCallback((events: SystemEvent[]) => {
    if (events.length) setPendingEvents((prev) => [...prev, ...events]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setCharacter(null);
      setQuests([]);
      setLoading(false);
      setNeedsCharacter(false);
      return;
    }
    setLoading(true);
    loadCharacter(user.uid)
      .then(async (c) => {
        if (cancelled) return;
        if (!c && isMasterEmail(user.email)) {
          // Master email signing in for the first time — skip the regular
          // character-creation step and provision a maxed account directly.
          const master = buildMasterCharacter(user.uid);
          if (db) await setDoc(doc(db, 'characters', user.uid), master);
          // Seed legendary shadow army (fire-and-forget so combat is
          // already playable once the dashboard renders).
          for (const s of buildMasterShadows(user.uid)) {
            try {
              await addShadow(s);
            } catch (err) {
              console.error('[master] shadow seed failed', err);
            }
          }
          if (cancelled) return;
          setCharacter(master);
          setNeedsCharacter(false);
        } else if (c) {
          const patch = migrateCharacterFields(c);
          if (patch) {
            const merged = { ...c, ...patch };
            setCharacter(merged);
            updateCharacter(user.uid, patch).catch((err) =>
              console.error('[migrate] character upgrade failed', err)
            );
          } else {
            setCharacter(c);
          }
          setNeedsCharacter(false);
        } else {
          setCharacter(null);
          setNeedsCharacter(true);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load character', err);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeQuests(user.uid, setQuests);
  }, [user]);

  // Live-sync the character doc across devices/tabs. The initial-load effect
  // above still owns first load, master provisioning, migration and creation;
  // this only folds in changes made ELSEWHERE (another device or tab) so a
  // single account never silently drifts between devices. We skip snapshots
  // carrying our own un-acked local writes (`hasPendingWrites`) so an in-flight
  // reward chain — which drives state through `characterRef`/`commitCharacter`
  // and writes absolute values — is never clobbered by its own echo. Remote
  // fields are merged over the current character so a peer on an older schema
  // can't drop a field we hold locally.
  useEffect(() => {
    if (!user || !db) return;
    const ref = doc(db, 'characters', user.uid);
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists() || snap.metadata.hasPendingWrites) return;
        const cur = characterRef.current;
        // Wait for the initial load to establish the character (avoids racing
        // creation / master provisioning on first sign-in).
        if (!cur) return;
        const remote = snap.data() as Character;
        if (remote.uid !== cur.uid) return;
        commitCharacter({ ...cur, ...remote });
      },
      (err) => console.error('[character:subscribe] failed', err)
    );
  }, [user, commitCharacter]);

  // Returning-user catch-up nudge (docs 08 §1, L0). When a user who was last
  // active on an earlier day opens the app with unfinished dailies, surface a
  // single toast so the loop has a starting point even without push. Evaluated
  // once per session, and only after quests have actually arrived (so we don't
  // decide off an empty first snapshot). Never nags within the same day or a
  // brand-new account with no quests.
  useEffect(() => {
    if (catchupShownRef.current || loading || !character || quests.length === 0) return;
    catchupShownRef.current = true;
    const seen = new Date(character.lastSeenAt || 0);
    const lastSeenDay = `${seen.getFullYear()}-${String(seen.getMonth() + 1).padStart(2, '0')}-${String(seen.getDate()).padStart(2, '0')}`;
    if (lastSeenDay >= todayKey()) return; // already active today
    // The always-on CoachCard now carries the day-to-day catch-up (remaining
    // count, at-risk streaks). The toast is reserved for a real return-from-
    // absence (3+ days away) so we don't double up with the card every morning.
    const awayDays = Math.round(
      (new Date(`${todayKey()}T00:00:00`).getTime() - new Date(`${lastSeenDay}T00:00:00`).getTime()) /
        86_400_000
    );
    if (awayDays < 3) return;
    const remaining = quests.filter((q) => !q.archived && q.type === 'daily' && !isQuestDoneToday(q));
    if (remaining.length === 0) return;
    enqueue([
      {
        id: `reminder:catchup:${Date.now()}`,
        kind: 'reminder',
        title: 'おかえりなさい',
        primary: `${awayDays}日ぶりですね`,
        secondary: '記録は消えていません。四日目から、いきましょう。',
        icon: '📋',
        accent: 'gold',
      },
    ]);
  }, [character, quests, loading, enqueue]);

  // Publish the focus-gate "open today" state whenever a quest is completed
  // today. The iOS automation polls the public gate doc; writing today's date
  // unlocks it. We only write once per day (gateWriteRef guard) and never
  // re-lock here — the gate naturally re-locks at midnight because the stored
  // date no longer equals the new day.
  useEffect(() => {
    if (!user || !character?.gateSecret) return;
    const today = todayKey();
    const anyDoneToday = quests.some(isQuestDoneToday);
    if (anyDoneToday && gateWriteRef.current !== today) {
      gateWriteRef.current = today;
      setFocusGate(character.gateSecret, user.uid, today).catch((err) =>
        console.error('[gate] publish failed', err)
      );
    }
  }, [user, character?.gateSecret, quests]);

  // Drain the iOS-Shortcut weight inbox on sign-in. Each row in
  // `weightInbox` for this uid is converted into a real `weightEntries`
  // doc and removed. Surfaces a single toast covering the whole batch.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    drainWeightInbox(user.uid)
      .then((count) => {
        if (cancelled || count <= 0) return;
        enqueue([
          {
            id: `inbox:weight:${Date.now()}`,
            kind: 'inbox',
            title: 'ヘルスケア同期',
            primary: `${count} 件の体重を取り込み`,
            secondary: 'iPhone から自動連携されたデータです',
            icon: '⚖️',
            accent: 'cyan',
          },
        ]);
      })
      .catch((err) => console.error('[inbox:drain] failed', err));
    return () => {
      cancelled = true;
    };
  }, [user, enqueue]);

  // Retroactively check for unlocks whenever character or quests change.
  // Runs after both have loaded; only persists when something actually changes.
  useEffect(() => {
    if (!user || !character || !quests.length) return;
    const { patched, events } = evaluateUnlocks(character, quests);
    if (events.length) {
      setCharacter(patched);
      enqueue(events);
      updateCharacter(user.uid, {
        unlocked: patched.unlocked,
        statPoints: patched.statPoints,
        title: patched.title,
      }).catch((err) => console.error('Failed to persist unlocks', err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, character?.uid, quests.length]);

  const createCharacterWithName = useCallback(
    async (name: string, appearance?: HunterAppearance, creed?: string) => {
      if (!user) return;
      const c = await createCharacter(
        user.uid,
        name.trim() || '名もなきハンター',
        appearance
      );
      // Seed job (from chosen class) + creed alongside the base character.
      // Awaited so the chosen creed can't be silently lost to a failed
      // fire-and-forget write (the load-time migration would then backfill
      // the default creed instead of the user's pick).
      const job = { base: appearance?.hunterClass ?? 'knight' as const };
      const chosenCreed = creed ?? DEFAULT_CREED;
      const withMeta: Character = { ...c, job, creed: chosenCreed };
      commitCharacter(withMeta);
      setNeedsCharacter(false);
      try {
        await updateCharacter(user.uid, { job, creed: chosenCreed });
      } catch (err) {
        console.error('[create] job/creed seed failed', err);
      }
      // Seed a first-session quick win (docs 08 §3). A trivially easy daily so
      // the very first tap lands a completion + reward, closing the loop on day
      // one. Fire-and-forget: it surfaces via the quest subscription and its
      // absence must never block character creation.
      try {
        await createQuest({
          uid: user.uid,
          title: 'コップ一杯の水をのむ',
          description: 'まずは ひとつ。ここから 始まります。',
          type: 'daily',
          targetStat: 'VIT',
          difficulty: 'E',
          completedDates: [],
          streak: 0,
          createdAt: Date.now(),
          archived: false,
        });
      } catch (err) {
        console.error('[create] first-session quest seed failed', err);
      }
    },
    [user]
  );

  const completeQuest = useCallback(
    async (quest: Quest): Promise<void> => {
      if (!user || !character) return;
      const today = todayKey();
      const baseExp = DIFFICULTY_EXP[quest.difficulty];
      // Streak with three-day-quitter recovery (docs 08 §2): a missed day is
      // covered by a weekly freeze token or decays the streak instead of
      // resetting it to 1. Reconcile the token stock for the current week first.
      const freezeNow = reconcileFreeze(character.streakFreeze, weekStartKey(new Date()));
      const streakRes = nextStreak(quest, today, yesterdayKey(), freezeNow);
      const newStreak = streakRes.streak;
      const freezeAfter = streakRes.freezeUsed
        ? { ...freezeNow, stock: freezeNow.stock - 1 }
        : freezeNow;
      const expMult = streakMultiplier(quest.type, newStreak, streakCapFor(character))
        * questExpMultiplier(character, quest, new Date().getHours());
      const expGained = Math.round(baseExp * expMult);
      const statGain = STAT_PER_DIFFICULTY[quest.difficulty] ?? 1;
      const goldGained = QUEST_GOLD[quest.difficulty];

      const oldLevel = character.level;
      const exp = applyExp(character.level, character.exp, character.totalExp, expGained);
      const stats: Record<StatKey, number> = {
        ...character.stats,
        [quest.targetStat]: character.stats[quest.targetStat] + statGain,
      };
      let updated: Character = {
        ...character,
        level: exp.level,
        exp: exp.exp,
        totalExp: exp.totalExp,
        stats,
        statPoints: character.statPoints + exp.statPointsGained,
        gold: (character.gold ?? 0) + goldGained,
        streakFreeze: freezeAfter,
        lastSeenAt: Date.now(),
      };

      // Reflect quest's new state in the in-memory copy used for evaluation.
      const updatedQuest: Quest = {
        ...quest,
        completedDates: [...quest.completedDates, today],
        streak: newStreak,
        lastCompletedAt: Date.now(),
        archived: quest.type === 'one-time' ? true : quest.archived ?? false,
      };
      const updatedQuests = quests.map((q) => (q.id === quest.id ? updatedQuest : q));

      // Evaluate unlocks against the post-completion state.
      const { patched, events } = evaluateUnlocks(updated, updatedQuests);
      updated = patched;

      // Earn Will (戦意) — the resource that gates story battles. Daily/weekly
      // quests grant it up to the per-day + stock caps (docs 03 §1).
      const camp = ensureCampaign(character.campaign, today);
      const willRes = earnWill(camp.will, quest.type === 'weekly' ? 'weekly' : 'daily', today);
      const nextCampaign: CampaignState = { ...camp, will: willRes.state };
      updated = { ...updated, campaign: nextCampaign };

      const eventsAll: SystemEvent[] = [];
      if (willRes.granted > 0) {
        eventsAll.push({
          id: `will:${Date.now()}`,
          kind: 'boss',
          title: '戦意 上昇',
          primary: `戦意 +${willRes.granted}`,
          secondary: `ストック ${willRes.state.stock}/3 ― 冒険で使える`,
          icon: '⚔️',
          accent: 'rose',
        });
      }
      if (exp.levelsGained > 0) {
        eventsAll.push({
          id: `level-up:${Date.now()}`,
          kind: 'level-up',
          title: 'Level Up!',
          primary: `Lv.${oldLevel} → Lv.${exp.level}`,
          secondary: `+${exp.statPointsGained} ステータスポイント`,
          icon: '⭐',
          accent: 'cyan',
        });
        const oldRank = rankForLevel(oldLevel);
        const newRank = rankForLevel(exp.level);
        if (oldRank !== newRank) {
          eventsAll.push({
            id: `rank-up:${Date.now()}`,
            kind: 'level-up',
            title: 'ランクアップ',
            primary: `${oldRank}  →  ${newRank}`,
            secondary: `あなたは ${newRank} ランクハンターに昇格した`,
            icon: '🏅',
            accent: 'gold',
          });
        }
      }
      if (streakRes.freezeUsed) {
        eventsAll.push({
          id: `streak-freeze:${Date.now()}`,
          kind: 'streak',
          title: '継続の盾',
          primary: `連続 ${newStreak}日 を まもった`,
          secondary: `フリーズを 1つ 使用(残り ${freezeAfter.stock})。四日目、いきましょう。`,
          icon: '🛡️',
          accent: 'cyan',
        });
      }
      eventsAll.push(...events);

      await Promise.all([
        updateQuest(quest.id, {
          completedDates: updatedQuest.completedDates,
          streak: updatedQuest.streak,
          lastCompletedAt: updatedQuest.lastCompletedAt,
          archived: updatedQuest.archived,
        }),
        updateCharacter(user.uid, {
          level: updated.level,
          exp: updated.exp,
          totalExp: updated.totalExp,
          stats: updated.stats,
          statPoints: updated.statPoints,
          gold: updated.gold,
          streakFreeze: updated.streakFreeze,
          lastSeenAt: updated.lastSeenAt,
          unlocked: updated.unlocked,
          title: updated.title,
          campaign: updated.campaign,
        }),
        logCompletion(user.uid, quest.id, expGained, today, willRes.granted),
      ]);

      commitCharacter(updated);
      enqueue(eventsAll);
    },
    [user, character, quests, enqueue]
  );

  const uncompleteQuest = useCallback(
    async (quest: Quest): Promise<void> => {
      const cur = characterRef.current;
      if (!user || !cur) return;
      const today = todayKey();

      // Refund exactly what today's completion granted, read from the
      // completion log. Recomputing from the current creed/medals/hour would
      // let a user farm EXP by toggling (complete under a bonus, switch it
      // off, uncheck for a smaller refund — or the honest-user inverse).
      const logs = await getCompletionsForQuest(user.uid, quest.id);
      const todaysLogs = logs.filter((l) => l.date === today);
      const baseExp = DIFFICULTY_EXP[quest.difficulty];
      // Fallback (legacy: completion predates the log, should not happen in
      // practice): recompute with the current modifiers.
      const expRefund = todaysLogs.length
        ? todaysLogs.reduce((sum, l) => sum + l.expGained, 0)
        : Math.round(
            baseExp * streakMultiplier(quest.type, quest.streak, streakCapFor(cur))
              * questExpMultiplier(cur, quest, new Date().getHours())
          );
      const willRefund = todaysLogs.reduce((sum, l) => sum + (l.willGained ?? 0), 0);
      const statRefund = STAT_PER_DIFFICULTY[quest.difficulty] ?? 1;

      const newDates = quest.completedDates.filter((d) => d !== today);
      const newStreak = recomputeStreak(quest.type, newDates);

      const newTotalExp = Math.max(0, cur.totalExp - expRefund);
      const { level: newLevel, exp: newExp } = levelFromTotalExp(newTotalExp);
      const levelDiff = newLevel - cur.level;
      const newStats: Record<StatKey, number> = {
        ...cur.stats,
        [quest.targetStat]: Math.max(0, cur.stats[quest.targetStat] - statRefund),
      };
      const newStatPoints = Math.max(0, cur.statPoints + levelDiff * 5);
      // Gold is flat per difficulty (no streak multiplier), so the refund is
      // exact — clamped only in case older completions predate the economy.
      const newGold = Math.max(0, (cur.gold ?? 0) - QUEST_GOLD[quest.difficulty]);
      // Take back the Will this completion granted (from the log — closes the
      // check→uncheck→check Will farm).
      const camp = ensureCampaign(cur.campaign, today);
      const newCampaign: CampaignState = { ...camp, will: ungrantWill(camp.will, willRefund, today) };

      const todaysLogIds = todaysLogs.map((l) => l.id);
      const updated: Character = {
        ...cur,
        level: newLevel,
        exp: newExp,
        totalExp: newTotalExp,
        stats: newStats,
        statPoints: newStatPoints,
        gold: newGold,
        campaign: newCampaign,
        lastSeenAt: Date.now(),
      };

      await Promise.all([
        updateQuest(quest.id, {
          completedDates: newDates,
          streak: newStreak,
          archived: quest.type === 'one-time' ? false : quest.archived ?? false,
        }),
        updateCharacter(user.uid, {
          level: newLevel,
          exp: newExp,
          totalExp: newTotalExp,
          stats: newStats,
          statPoints: newStatPoints,
          gold: newGold,
          campaign: newCampaign,
          lastSeenAt: updated.lastSeenAt,
        }),
        todaysLogIds.length ? deleteCompletions(todaysLogIds) : Promise.resolve(),
      ]);

      commitCharacter(updated);
    },
    [user, commitCharacter]
  );

  const toggleQuest = useCallback(
    async (quest: Quest): Promise<void> => {
      if (busyQuestId) return;
      setBusyQuestId(quest.id);
      try {
        if (isQuestDoneToday(quest)) {
          await uncompleteQuest(quest);
        } else {
          await completeQuest(quest);
        }
      } catch (err) {
        console.error('[quest:toggle] failed', err);
        throw err;
      } finally {
        setBusyQuestId(null);
      }
    },
    [busyQuestId, completeQuest, uncompleteQuest]
  );

  const removeQuestWithRefund = useCallback(
    async (quest: Quest): Promise<void> => {
      if (!user || !character) {
        await deleteQuest(quest.id);
        return;
      }
      if (busyQuestId) return;
      setBusyQuestId(quest.id);
      try {
        const logs = await getCompletionsForQuest(user.uid, quest.id);
        const expRefund = logs.reduce((sum, l) => sum + l.expGained, 0);
        const statRefund =
          (STAT_PER_DIFFICULTY[quest.difficulty] ?? 1) * logs.length;
        const goldRefund = QUEST_GOLD[quest.difficulty] * logs.length;

        const newTotalExp = Math.max(0, character.totalExp - expRefund);
        const { level: newLevel, exp: newExp } = levelFromTotalExp(newTotalExp);
        const levelDiff = newLevel - character.level;
        const newStats: Record<StatKey, number> = {
          ...character.stats,
          [quest.targetStat]: Math.max(0, character.stats[quest.targetStat] - statRefund),
        };
        const newStatPoints = Math.max(0, character.statPoints + levelDiff * 5);
        const newGold = Math.max(0, (character.gold ?? 0) - goldRefund);

        await Promise.all([
          deleteQuest(quest.id),
          updateCharacter(user.uid, {
            level: newLevel,
            exp: newExp,
            totalExp: newTotalExp,
            stats: newStats,
            statPoints: newStatPoints,
            gold: newGold,
            lastSeenAt: Date.now(),
          }),
          logs.length ? deleteCompletions(logs.map((l) => l.id)) : Promise.resolve(),
        ]);

        setCharacter({
          ...character,
          level: newLevel,
          exp: newExp,
          totalExp: newTotalExp,
          stats: newStats,
          statPoints: newStatPoints,
          gold: newGold,
          lastSeenAt: Date.now(),
        });
      } finally {
        setBusyQuestId(null);
      }
    },
    [user, character, busyQuestId]
  );

  const editQuest = useCallback(
    async (quest: Quest, patch: QuestEditPatch): Promise<void> => {
      // If switching away from "daily" the stored streak no longer applies — reset it.
      const typeChanged = patch.type !== quest.type;
      const streakReset = typeChanged && patch.type !== 'daily' ? { streak: 0 } : {};
      await updateQuest(quest.id, {
        title: patch.title,
        description: patch.description,
        type: patch.type,
        targetStat: patch.targetStat,
        difficulty: patch.difficulty,
        ...streakReset,
      });
    },
    []
  );

  const moveQuest = useCallback(
    async (quest: Quest, direction: 'up' | 'down'): Promise<void> => {
      const active = quests.filter((q) => !q.archived);
      const idx = active.findIndex((q) => q.id === quest.id);
      if (idx < 0) return;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= active.length) return;
      const reordered = [...active];
      [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
      // Normalize: persist sequential order so the manual arrangement sticks
      // even for quests that previously had no `order` field.
      await Promise.all(
        reordered.map((q, i) =>
          q.order === i ? Promise.resolve() : updateQuest(q.id, { order: i })
        )
      );
    },
    [quests]
  );

  // Generic arbitrary reorder, used by drag-and-drop. `from` and `to` are
  // indices into the active (non-archived) list.
  const reorderActive = useCallback(
    async (from: number, to: number): Promise<void> => {
      const active = quests.filter((q) => !q.archived);
      if (
        from === to ||
        from < 0 ||
        to < 0 ||
        from >= active.length ||
        to >= active.length
      ) {
        return;
      }
      const reordered = [...active];
      const [moved] = reordered.splice(from, 1);
      reordered.splice(to, 0, moved);
      await Promise.all(
        reordered.map((q, i) =>
          q.order === i ? Promise.resolve() : updateQuest(q.id, { order: i })
        )
      );
    },
    [quests]
  );

  const renameCharacter = useCallback(
    async (name: string): Promise<void> => {
      if (!user || !character) return;
      const trimmed = name.trim() || '名もなきハンター';
      if (trimmed === character.name) return;
      await updateCharacter(user.uid, { name: trimmed });
      setCharacter({ ...character, name: trimmed });
    },
    [user, character]
  );

  const updateAppearance = useCallback(
    async (appearance: HunterAppearance): Promise<void> => {
      if (!user || !character) return;
      await updateCharacter(user.uid, { appearance });
      setCharacter({ ...character, appearance });
    },
    [user, character]
  );

  const updateCreed = useCallback(
    async (creed: string): Promise<void> => {
      const cur = characterRef.current;
      if (!user || !cur) return;
      commitCharacter({ ...cur, creed });
      await updateCharacter(user.uid, { creed });
    },
    [user, commitCharacter]
  );

  const advanceJob = useCallback(
    async (nodeId: string): Promise<void> => {
      const cur = characterRef.current;
      if (!user || !cur) return;
      const node = JOB_BY_ID[nodeId];
      if (!node) return;
      const base = cur.job?.base ?? cur.appearance?.hunterClass ?? 'knight';
      const job = { ...(cur.job ?? { base }), base };
      // Validate the advancement: level gate, correct lineage, not already
      // advanced. The UI (advancementOptions) enforces the same rules; this
      // guards the persistence layer against arbitrary node ids.
      if (node.tier === 2) {
        if (cur.level < TIER2_LEVEL || node.parent !== base || job.tier2) return;
        job.tier2 = nodeId;
      } else if (node.tier === 3) {
        if (cur.level < TIER3_LEVEL || !job.tier2 || node.parent !== job.tier2 || job.tier3) return;
        job.tier3 = nodeId;
      } else {
        return; // tier-1 nodes are not an advancement target
      }
      commitCharacter({ ...cur, job });
      await updateCharacter(user.uid, { job });
    },
    [user, commitCharacter]
  );

  const setEquippedSkills = useCallback(
    async (skillIds: string[]): Promise<void> => {
      if (!user || !character) return;
      const trimmed = skillIds.slice(0, 5);
      await updateCharacter(user.uid, { equippedSkills: trimmed });
      setCharacter({ ...character, equippedSkills: trimmed });
    },
    [user, character]
  );

  const incrementBossesDefeated = useCallback(async (): Promise<void> => {
    if (!user || !character) return;
    const next = (character.bossesDefeated ?? 0) + 1;
    await updateCharacter(user.uid, { bossesDefeated: next });
    setCharacter({ ...character, bossesDefeated: next });
  }, [user, character]);

  // Master-only — overwrite the current character with the maxed seed and
  // top up the shadow army. Gated by isMasterEmail at the UI layer so a
  // regular user can never reach this branch.
  const initializeMaster = useCallback(async (): Promise<void> => {
    if (!user || !isMasterEmail(user.email)) return;
    const master = buildMasterCharacter(user.uid);
    if (db) await setDoc(doc(db, 'characters', user.uid), master);
    for (const s of buildMasterShadows(user.uid)) {
      try {
        await addShadow(s);
      } catch (err) {
        console.error('[master] shadow seed failed', err);
      }
    }
    setCharacter(master);
    setNeedsCharacter(false);
  }, [user]);

  const allocateStatPoint = useCallback(
    async (stat: StatKey): Promise<void> => {
      if (!user || !character || character.statPoints <= 0) return;
      const newStats: Record<StatKey, number> = {
        ...character.stats,
        [stat]: character.stats[stat] + 1,
      };
      const newPoints = character.statPoints - 1;
      // Optimistic update — Firestore write happens in the background. The
      // worst case (write fails) is one wrongly-displayed stat point until
      // the snapshot subscription catches up.
      setCharacter({ ...character, stats: newStats, statPoints: newPoints });
      try {
        await updateCharacter(user.uid, {
          stats: newStats,
          statPoints: newPoints,
        });
      } catch (err) {
        console.error('[stat:allocate] failed, rolling back', err);
        setCharacter(character);
        throw err;
      }
    },
    [user, character]
  );

  const setWeightTarget = useCallback(
    async (target: number | null): Promise<void> => {
      if (!user || !character) return;
      const value =
        target === null ? null : Math.round(target * 10) / 10;
      // Firestore doesn't have a typed "clear field" semantic in our wrapper,
      // so we store null to mean "no target" and surface it as undefined to
      // the UI in the local state.
      await updateCharacter(user.uid, {
        weightTarget: value as number | undefined,
      });
      setCharacter({
        ...character,
        weightTarget: value === null ? undefined : value,
      });
    },
    [user, character]
  );

  const setNutritionConfig = useCallback(
    async (patch: {
      dietType?: DietType;
      activityLevel?: ActivityLevel;
      weightTargetDate?: string | null;
    }): Promise<void> => {
      if (!user || !character) return;
      const next: Character = { ...character };
      const update: Partial<Character> = {};
      if (patch.dietType !== undefined) {
        next.dietType = patch.dietType;
        update.dietType = patch.dietType;
      }
      if (patch.activityLevel !== undefined) {
        next.activityLevel = patch.activityLevel;
        update.activityLevel = patch.activityLevel;
      }
      if (patch.weightTargetDate !== undefined) {
        const v = patch.weightTargetDate;
        next.weightTargetDate = v === null ? undefined : v;
        // null is stored to mean "cleared" (same convention as weightTarget).
        update.weightTargetDate = (v === null ? null : v) as string | undefined;
      }
      setCharacter(next);
      await updateCharacter(user.uid, update);
    },
    [user, character]
  );

  const setNutritionTarget = useCallback(
    async (target: NutritionTarget | null): Promise<void> => {
      if (!user || !character) return;
      setCharacter({
        ...character,
        nutritionTarget: target === null ? undefined : target,
      });
      await updateCharacter(user.uid, {
        nutritionTarget: (target === null ? null : target) as NutritionTarget | undefined,
      });
    },
    [user, character]
  );

  const enqueueEvent = useCallback(
    (event: SystemEvent) => {
      enqueue([event]);
    },
    [enqueue]
  );

  const awardExp = useCallback(
    async (amount: number): Promise<void> => {
      const cur = characterRef.current;
      if (!user || !cur || amount <= 0) return;
      const oldLevel = cur.level;
      const result = applyExp(cur.level, cur.exp, cur.totalExp, amount);
      const updated: Character = {
        ...cur,
        level: result.level,
        exp: result.exp,
        totalExp: result.totalExp,
        statPoints: cur.statPoints + result.statPointsGained,
        lastSeenAt: Date.now(),
      };
      commitCharacter(updated);
      await updateCharacter(user.uid, {
        level: updated.level,
        exp: updated.exp,
        totalExp: updated.totalExp,
        statPoints: updated.statPoints,
        lastSeenAt: updated.lastSeenAt,
      });
      if (result.levelsGained > 0) {
        const events: SystemEvent[] = [
          {
            id: `level-up:boss:${Date.now()}`,
            kind: 'level-up',
            title: 'Level Up!',
            primary: `Lv.${oldLevel} → Lv.${result.level}`,
            secondary: `+${result.statPointsGained} ステータスポイント`,
            icon: '⭐',
            accent: 'cyan',
          },
        ];
        const oldRank = rankForLevel(oldLevel);
        const newRank = rankForLevel(result.level);
        if (oldRank !== newRank) {
          events.push({
            id: `rank-up:boss:${Date.now()}`,
            kind: 'level-up',
            title: 'ランクアップ',
            primary: `${oldRank}  →  ${newRank}`,
            secondary: `${newRank} ランクハンターに昇格`,
            icon: '🏅',
            accent: 'gold',
          });
        }
        enqueue(events);
      }
    },
    [user, commitCharacter, enqueue]
  );

  // ----- gold economy -------------------------------------------------

  const addGold = useCallback(
    async (amount: number): Promise<void> => {
      const cur = characterRef.current;
      if (!user || !cur || amount <= 0) return;
      const newGold = (cur.gold ?? 0) + Math.round(amount);
      commitCharacter({ ...cur, gold: newGold });
      await updateCharacter(user.uid, { gold: newGold });
    },
    [user, commitCharacter]
  );

  const spendGold = useCallback(
    async (amount: number): Promise<boolean> => {
      const cur = characterRef.current;
      if (!user || !cur || amount <= 0) return false;
      const wallet = cur.gold ?? 0;
      if (wallet < amount) return false;
      const newGold = wallet - Math.round(amount);
      commitCharacter({ ...cur, gold: newGold });
      try {
        await updateCharacter(user.uid, { gold: newGold });
        return true;
      } catch (err) {
        console.error('[gold:spend] failed, rolling back', err);
        commitCharacter(cur);
        throw err;
      }
    },
    [user, commitCharacter]
  );

  const buyConsumable = useCallback(
    async (consumableId: string): Promise<boolean> => {
      const cur = characterRef.current;
      if (!user || !cur) return false;
      const template = getConsumable(consumableId);
      if (!template) return false;
      const price = Math.round(template.price * (1 - shopDiscountFor(cur))); // 倹約家 creed
      const wallet = cur.gold ?? 0;
      if (wallet < price) return false;
      const consumables = {
        ...(cur.consumables ?? {}),
        [consumableId]: (cur.consumables?.[consumableId] ?? 0) + 1,
      };
      const newGold = wallet - price;
      commitCharacter({ ...cur, gold: newGold, consumables });
      try {
        await updateCharacter(user.uid, { gold: newGold, consumables });
        return true;
      } catch (err) {
        console.error('[shop:buy] failed, rolling back', err);
        commitCharacter(cur);
        throw err;
      }
    },
    [user, commitCharacter]
  );

  const useConsumable = useCallback(
    async (consumableId: string): Promise<boolean> => {
      const cur = characterRef.current;
      if (!user || !cur) return false;
      const held = cur.consumables?.[consumableId] ?? 0;
      if (held <= 0) return false;
      const consumables = { ...(cur.consumables ?? {}), [consumableId]: held - 1 };
      commitCharacter({ ...cur, consumables });
      try {
        await updateCharacter(user.uid, { consumables });
        return true;
      } catch (err) {
        console.error('[item:use] failed, rolling back', err);
        commitCharacter(cur);
        throw err;
      }
    },
    [user, commitCharacter]
  );

  const recordDexShadow = useCallback(
    async (templateId: string): Promise<void> => {
      const cur = characterRef.current;
      if (!user || !cur) return;
      const seen = cur.dexShadows ?? [];
      if (seen.includes(templateId)) return;
      const dexShadows = [...seen, templateId];
      commitCharacter({ ...cur, dexShadows });
      await updateCharacter(user.uid, { dexShadows });
    },
    [user, commitCharacter]
  );

  const saveCampaign = useCallback(
    async (next: CampaignState): Promise<void> => {
      const cur = characterRef.current;
      if (!user || !cur) return;
      commitCharacter({ ...cur, campaign: next });
      try {
        await updateCharacter(user.uid, { campaign: next });
      } catch (err) {
        console.error('[campaign:save] failed, rolling back', err);
        commitCharacter(cur);
        throw err;
      }
    },
    [user, commitCharacter]
  );

  // ----- real-world savings config --------------------------------------

  const setSavingsGoal = useCallback(
    async (goal: SavingsGoal | null): Promise<void> => {
      if (!user || !character) return;
      setCharacter({ ...character, savingsGoal: goal ?? undefined });
      await updateCharacter(user.uid, {
        savingsGoal: (goal === null ? null : goal) as SavingsGoal | undefined,
      });
    },
    [user, character]
  );

  const setMonthlyBudget = useCallback(
    async (amount: number | null): Promise<void> => {
      if (!user || !character) return;
      setCharacter({ ...character, monthlyBudget: amount ?? undefined });
      await updateCharacter(user.uid, {
        monthlyBudget: (amount === null ? null : amount) as number | undefined,
      });
    },
    [user, character]
  );

  const markBudgetRewarded = useCallback(
    async (month: string): Promise<void> => {
      if (!user || !character) return;
      setCharacter({ ...character, lastBudgetRewardMonth: month });
      await updateCharacter(user.uid, { lastBudgetRewardMonth: month });
    },
    [user, character]
  );

  // Once-daily nutrition reward. Self-contained (does not call awardExp) so
  // the EXP bump and the lastNutritionRewardDate guard land in a single
  // setCharacter/updateCharacter pair — avoids a stale-closure race that would
  // otherwise clobber one of the two writes.
  const awardNutritionExp = useCallback(
    async (amount: number, dateKey: string): Promise<boolean> => {
      if (!user || !character || amount <= 0) return false;
      if (character.lastNutritionRewardDate === dateKey) return false; // already today
      const oldLevel = character.level;
      const result = applyExp(
        character.level,
        character.exp,
        character.totalExp,
        amount
      );
      const updated: Character = {
        ...character,
        level: result.level,
        exp: result.exp,
        totalExp: result.totalExp,
        statPoints: character.statPoints + result.statPointsGained,
        lastNutritionRewardDate: dateKey,
        lastSeenAt: Date.now(),
      };
      setCharacter(updated);
      await updateCharacter(user.uid, {
        level: updated.level,
        exp: updated.exp,
        totalExp: updated.totalExp,
        statPoints: updated.statPoints,
        lastNutritionRewardDate: dateKey,
        lastSeenAt: updated.lastSeenAt,
      });
      const events: SystemEvent[] = [
        {
          id: `nutrition:${dateKey}`,
          kind: 'nutrition',
          title: '食事目標 達成',
          primary: `+${amount} EXP`,
          secondary: '本日の栄養バランスをクリア',
          icon: '🍽️',
          accent: 'cyan',
        },
      ];
      if (result.levelsGained > 0) {
        events.push({
          id: `level-up:nutrition:${Date.now()}`,
          kind: 'level-up',
          title: 'Level Up!',
          primary: `Lv.${oldLevel} → Lv.${result.level}`,
          secondary: `+${result.statPointsGained} ステータスポイント`,
          icon: '⭐',
          accent: 'cyan',
        });
        const oldRank = rankForLevel(oldLevel);
        const newRank = rankForLevel(result.level);
        if (oldRank !== newRank) {
          events.push({
            id: `rank-up:nutrition:${Date.now()}`,
            kind: 'level-up',
            title: 'ランクアップ',
            primary: `${oldRank}  →  ${newRank}`,
            secondary: `${newRank} ランクハンターに昇格`,
            icon: '🏅',
            accent: 'gold',
          });
        }
      }
      enqueue(events);
      return true;
    },
    [user, character, enqueue]
  );

  // Enable the focus gate with a fresh secret (seeds the public gate doc with
  // today's state) or disable it (null → clear the field + delete the doc).
  const setGateSecret = useCallback(
    async (secret: string | null): Promise<void> => {
      if (!user || !character) return;
      const prev = character.gateSecret;
      await updateCharacter(user.uid, {
        gateSecret: (secret === null ? null : secret) as string | undefined,
      });
      setCharacter({ ...character, gateSecret: secret ?? undefined });
      if (secret) {
        const today = todayKey();
        const anyDoneToday = quests.some(isQuestDoneToday);
        gateWriteRef.current = anyDoneToday ? today : null;
        await setFocusGate(secret, user.uid, anyDoneToday ? today : '');
      } else if (prev) {
        await deleteFocusGate(prev).catch((err) =>
          console.error('[gate] delete failed', err)
        );
      }
    },
    [user, character, quests]
  );

  const popEvent = useCallback(() => {
    setPendingEvents((prev) => prev.slice(1));
  }, []);

  // Hard reset: wipe completions, quests, character — auth stays so the user
  // lands back on the character-creation screen without re-login.
  const resetAccount = useCallback(async (): Promise<void> => {
    if (!user) return;
    const { uid } = user;
    // Delete completion log entries in chunks-of-Promise.all
    const completions = await getAllCompletions(uid);
    if (completions.length) {
      await deleteCompletions(completions.map((c) => c.id));
    }
    // Delete every quest doc
    await Promise.all(quests.map((q) => deleteQuest(q.id)));
    // Wipe the remaining per-user collections. The auth uid survives a reset,
    // so anything left here would resurrect under the next character. API keys
    // are intentionally left intact so existing external integrations (iOS
    // Shortcuts, etc.) keep working after a reset.
    await Promise.all([
      deleteAllByUid('meals', uid),
      deleteAllByUid('mealPresets', uid),
      deleteAllByUid('weightEntries', uid),
      deleteAllByUid('shadows', uid),
      deleteAllByUid('items', uid),
      deleteAllByUid('bossAttempts', uid),
      deleteAllByUid('weightInbox', uid),
      deleteAllByUid('savingsEntries', uid),
    ]);
    // The focus-gate doc is keyed by its secret (not listable by uid), so it
    // can't go through deleteAllByUid — remove it directly if one exists.
    if (character?.gateSecret) {
      await deleteFocusGate(character.gateSecret).catch(() => {});
    }
    // Delete the character doc itself
    await deleteCharacter(uid);

    setCharacter(null);
    setQuests([]);
    setNeedsCharacter(true);
    setPendingEvents([]);
  }, [user, quests, character]);

  return {
    character,
    quests,
    loading,
    needsCharacter,
    busyQuestId,
    pendingEvents,
    popEvent,
    createCharacterWithName,
    toggleQuest,
    removeQuestWithRefund,
    editQuest,
    moveQuest,
    reorderActive,
    renameCharacter,
    updateAppearance,
    updateCreed,
    advanceJob,
    setEquippedSkills,
    incrementBossesDefeated,
    allocateStatPoint,
    setWeightTarget,
    setNutritionConfig,
    setNutritionTarget,
    awardNutritionExp,
    setGateSecret,
    resetAccount,
    enqueueEvent,
    awardExp,
    addGold,
    spendGold,
    buyConsumable,
    useConsumable,
    recordDexShadow,
    campaign: character ? ensureCampaign(character.campaign, todayKey()) : defaultCampaign(todayKey()),
    saveCampaign,
    setSavingsGoal,
    setMonthlyBudget,
    markBudgetRewarded,
    initializeMaster,
    isMaster: isMasterEmail(user?.email),
  };
}

export { isQuestDoneToday };
