import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  drainWeightInbox,
  loadCharacter,
  subscribeQuests,
  createCharacter,
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
} from '../lib/firestore';
import {
  buildMasterCharacter,
  buildMasterShadows,
  isMasterEmail,
} from '../lib/masterConfig';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type {
  ActivityLevel,
  Character,
  DietType,
  HunterAppearance,
  NutritionTarget,
  Quest,
  StatKey,
  SystemEvent,
  UnlockState,
} from '../types';
import { DIFFICULTY_EXP, EMPTY_UNLOCK } from '../types';
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
  createCharacterWithName: (name: string, appearance?: HunterAppearance) => Promise<void>;
  toggleQuest: (quest: Quest) => Promise<void>;
  removeQuestWithRefund: (quest: Quest) => Promise<void>;
  editQuest: (quest: Quest, patch: QuestEditPatch) => Promise<void>;
  moveQuest: (quest: Quest, direction: 'up' | 'down') => Promise<void>;
  reorderActive: (from: number, to: number) => Promise<void>;
  renameCharacter: (name: string) => Promise<void>;
  updateAppearance: (appearance: HunterAppearance) => Promise<void>;
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

function streakMultiplier(type: Quest['type'], streak: number): number {
  if (type !== 'daily') return 1;
  return Math.min(2, 1 + 0.1 * Math.max(0, streak - 1));
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
        } else {
          setCharacter(c);
          setNeedsCharacter(!c);
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
    async (name: string, appearance?: HunterAppearance) => {
      if (!user) return;
      const c = await createCharacter(
        user.uid,
        name.trim() || 'Hunter',
        appearance
      );
      setCharacter(c);
      setNeedsCharacter(false);
    },
    [user]
  );

  const completeQuest = useCallback(
    async (quest: Quest): Promise<void> => {
      if (!user || !character) return;
      const today = todayKey();
      const baseExp = DIFFICULTY_EXP[quest.difficulty];
      const newStreak =
        quest.type === 'daily'
          ? quest.completedDates.includes(yesterdayKey())
            ? quest.streak + 1
            : 1
          : quest.streak;
      const expGained = Math.round(baseExp * streakMultiplier(quest.type, newStreak));
      const statGain = STAT_PER_DIFFICULTY[quest.difficulty] ?? 1;

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

      const eventsAll: SystemEvent[] = [];
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
          lastSeenAt: updated.lastSeenAt,
          unlocked: updated.unlocked,
          title: updated.title,
        }),
        logCompletion(user.uid, quest.id, expGained, today),
      ]);

      setCharacter(updated);
      enqueue(eventsAll);
    },
    [user, character, quests, enqueue]
  );

  const uncompleteQuest = useCallback(
    async (quest: Quest): Promise<void> => {
      if (!user || !character) return;
      const today = todayKey();
      const baseExp = DIFFICULTY_EXP[quest.difficulty];
      const expRefund = Math.round(baseExp * streakMultiplier(quest.type, quest.streak));
      const statRefund = STAT_PER_DIFFICULTY[quest.difficulty] ?? 1;

      const newDates = quest.completedDates.filter((d) => d !== today);
      const newStreak = recomputeStreak(quest.type, newDates);

      const newTotalExp = Math.max(0, character.totalExp - expRefund);
      const { level: newLevel, exp: newExp } = levelFromTotalExp(newTotalExp);
      const levelDiff = newLevel - character.level;
      const newStats: Record<StatKey, number> = {
        ...character.stats,
        [quest.targetStat]: Math.max(0, character.stats[quest.targetStat] - statRefund),
      };
      const newStatPoints = Math.max(0, character.statPoints + levelDiff * 5);

      const logs = await getCompletionsForQuest(user.uid, quest.id);
      const todaysLogIds = logs.filter((l) => l.date === today).map((l) => l.id);

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
          lastSeenAt: Date.now(),
        }),
        todaysLogIds.length ? deleteCompletions(todaysLogIds) : Promise.resolve(),
      ]);

      setCharacter({
        ...character,
        level: newLevel,
        exp: newExp,
        totalExp: newTotalExp,
        stats: newStats,
        statPoints: newStatPoints,
        lastSeenAt: Date.now(),
      });
    },
    [user, character]
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

        const newTotalExp = Math.max(0, character.totalExp - expRefund);
        const { level: newLevel, exp: newExp } = levelFromTotalExp(newTotalExp);
        const levelDiff = newLevel - character.level;
        const newStats: Record<StatKey, number> = {
          ...character.stats,
          [quest.targetStat]: Math.max(0, character.stats[quest.targetStat] - statRefund),
        };
        const newStatPoints = Math.max(0, character.statPoints + levelDiff * 5);

        await Promise.all([
          deleteQuest(quest.id),
          updateCharacter(user.uid, {
            level: newLevel,
            exp: newExp,
            totalExp: newTotalExp,
            stats: newStats,
            statPoints: newStatPoints,
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
      const trimmed = name.trim() || 'Hunter';
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
      if (!user || !character || amount <= 0) return;
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
        lastSeenAt: Date.now(),
      };
      setCharacter(updated);
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
    [user, character, enqueue]
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
    ]);
    // Delete the character doc itself
    await deleteCharacter(uid);

    setCharacter(null);
    setQuests([]);
    setNeedsCharacter(true);
    setPendingEvents([]);
  }, [user, quests]);

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
    setEquippedSkills,
    incrementBossesDefeated,
    allocateStatPoint,
    setWeightTarget,
    setNutritionConfig,
    setNutritionTarget,
    awardNutritionExp,
    resetAccount,
    enqueueEvent,
    awardExp,
    initializeMaster,
    isMaster: isMasterEmail(user?.email),
  };
}

export { isQuestDoneToday };
