import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  loadCharacter,
  subscribeQuests,
  createCharacter,
  updateCharacter,
  updateQuest,
  deleteQuest,
  logCompletion,
  getCompletionsForQuest,
  deleteCompletions,
} from '../lib/firestore';
import type {
  Character,
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
  thisWeekKey,
  previousDayKey,
} from '../lib/leveling';
import {
  buildAchievementContext,
  newlyUnlockedAchievements,
  type AchievementDef,
} from '../lib/achievements';
import { newlyUnlockedSkills, type SkillDef } from '../lib/skills';

export interface GameData {
  character: Character | null;
  quests: Quest[];
  loading: boolean;
  needsCharacter: boolean;
  busyQuestId: string | null;
  pendingEvents: SystemEvent[];
  popEvent: () => void;
  createCharacterWithName: (name: string) => Promise<void>;
  toggleQuest: (quest: Quest) => Promise<void>;
  removeQuestWithRefund: (quest: Quest) => Promise<void>;
}

function isQuestDoneToday(quest: Quest): boolean {
  if (quest.type === 'daily') return quest.completedDates.includes(todayKey());
  if (quest.type === 'weekly') {
    const wk = thisWeekKey();
    return quest.completedDates.some((d) => d.startsWith(wk));
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
      .then((c) => {
        if (cancelled) return;
        setCharacter(c);
        setNeedsCharacter(!c);
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
    async (name: string) => {
      if (!user) return;
      const c = await createCharacter(user.uid, name.trim() || 'Hunter');
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

  const popEvent = useCallback(() => {
    setPendingEvents((prev) => prev.slice(1));
  }, []);

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
  };
}

export { isQuestDoneToday };
