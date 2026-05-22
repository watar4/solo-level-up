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
import type { Character, LevelUpEvent, Quest, StatKey } from '../types';
import { DIFFICULTY_EXP } from '../types';
import {
  applyExp,
  levelFromTotalExp,
  rankForLevel,
  todayKey,
  yesterdayKey,
  thisWeekKey,
  previousDayKey,
} from '../lib/leveling';

export interface GameData {
  character: Character | null;
  quests: Quest[];
  loading: boolean;
  needsCharacter: boolean;
  lastLevelUp: LevelUpEvent | null;
  busyQuestId: string | null;
  clearLevelUp: () => void;
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

// Streak multiplier identical to the one used at completion time, so refunding
// uses the same number of EXP that was awarded.
function streakMultiplier(type: Quest['type'], streak: number): number {
  if (type !== 'daily') return 1;
  return Math.min(2, 1 + 0.1 * Math.max(0, streak - 1));
}

// Re-derive streak by walking backwards from yesterday through the remaining
// completion dates. Pure function — no Firestore reads needed.
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

export function useGameData(user: User | null): GameData {
  const [character, setCharacter] = useState<Character | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsCharacter, setNeedsCharacter] = useState(false);
  const [lastLevelUp, setLastLevelUp] = useState<LevelUpEvent | null>(null);
  const [busyQuestId, setBusyQuestId] = useState<string | null>(null);

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

  const createCharacterWithName = useCallback(
    async (name: string) => {
      if (!user) return;
      const c = await createCharacter(user.uid, name.trim() || 'Hunter');
      setCharacter(c);
      setNeedsCharacter(false);
    },
    [user]
  );

  // Complete-today path: award EXP, bump stat, possibly level up, log it.
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
      const updated: Character = {
        ...character,
        level: exp.level,
        exp: exp.exp,
        totalExp: exp.totalExp,
        stats,
        statPoints: character.statPoints + exp.statPointsGained,
        lastSeenAt: Date.now(),
      };

      await Promise.all([
        updateQuest(quest.id, {
          completedDates: [...quest.completedDates, today],
          streak: newStreak,
          lastCompletedAt: Date.now(),
          archived: quest.type === 'one-time' ? true : quest.archived ?? false,
        }),
        updateCharacter(user.uid, {
          level: updated.level,
          exp: updated.exp,
          totalExp: updated.totalExp,
          stats: updated.stats,
          statPoints: updated.statPoints,
          lastSeenAt: updated.lastSeenAt,
        }),
        logCompletion(user.uid, quest.id, expGained, today),
      ]);

      setCharacter(updated);

      if (exp.levelsGained > 0) {
        setLastLevelUp({
          fromLevel: oldLevel,
          toLevel: updated.level,
          statPointsGained: exp.statPointsGained,
          newRank:
            rankForLevel(oldLevel) !== rankForLevel(updated.level)
              ? rankForLevel(updated.level)
              : undefined,
        });
      }
    },
    [user, character]
  );

  // Uncheck-today path: refund EXP + stat using the same formula that awarded
  // them, recompute streak from the remaining dates, delete today's completion
  // log entries.
  const uncompleteQuest = useCallback(
    async (quest: Quest): Promise<void> => {
      if (!user || !character) return;
      const today = todayKey();
      const baseExp = DIFFICULTY_EXP[quest.difficulty];
      // The current quest.streak is the streak that was applied at completion,
      // so it tells us exactly how much EXP to refund.
      const expRefund = Math.round(baseExp * streakMultiplier(quest.type, quest.streak));
      const statRefund = STAT_PER_DIFFICULTY[quest.difficulty] ?? 1;

      const newDates = quest.completedDates.filter((d) => d !== today);
      const newStreak = recomputeStreak(quest.type, newDates);

      const newTotalExp = Math.max(0, character.totalExp - expRefund);
      const { level: newLevel, exp: newExp } = levelFromTotalExp(newTotalExp);
      const levelDiff = newLevel - character.level; // negative or zero
      const newStats: Record<StatKey, number> = {
        ...character.stats,
        [quest.targetStat]: Math.max(0, character.stats[quest.targetStat] - statRefund),
      };
      const newStatPoints = Math.max(0, character.statPoints + levelDiff * 5);

      // Wipe today's completion log entry(ies). Old entries (pre date-field)
      // will simply not match and stay — harmless for history.
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

  // Delete a quest AND refund every EXP/stat it ever granted. Level is
  // recomputed from the resulting lifetime EXP — keeps the books balanced.
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

  const clearLevelUp = useCallback(() => setLastLevelUp(null), []);

  return {
    character,
    quests,
    loading,
    needsCharacter,
    lastLevelUp,
    busyQuestId,
    clearLevelUp,
    createCharacterWithName,
    toggleQuest,
    removeQuestWithRefund,
  };
}

export { isQuestDoneToday };
