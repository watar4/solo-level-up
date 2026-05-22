import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  loadCharacter,
  subscribeQuests,
  createCharacter,
  updateCharacter,
  updateQuest,
  logCompletion,
} from '../lib/firestore';
import type { Character, LevelUpEvent, Quest, StatKey } from '../types';
import { DIFFICULTY_EXP } from '../types';
import {
  applyExp,
  rankForLevel,
  todayKey,
  yesterdayKey,
  thisWeekKey,
} from '../lib/leveling';

export interface GameData {
  character: Character | null;
  quests: Quest[];
  loading: boolean;
  needsCharacter: boolean;
  lastLevelUp: LevelUpEvent | null;
  clearLevelUp: () => void;
  createCharacterWithName: (name: string) => Promise<void>;
  completeQuest: (quest: Quest) => Promise<void>;
}

function isQuestDoneToday(quest: Quest): boolean {
  if (quest.type === 'daily') return quest.completedDates.includes(todayKey());
  if (quest.type === 'weekly') {
    const wk = thisWeekKey();
    // Reuse the "completedDates" field for weeks too.
    return quest.completedDates.some((d) => d.startsWith(wk));
  }
  return quest.completedDates.length > 0;
}

export function useGameData(user: User | null): GameData {
  const [character, setCharacter] = useState<Character | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsCharacter, setNeedsCharacter] = useState(false);
  const [lastLevelUp, setLastLevelUp] = useState<LevelUpEvent | null>(null);

  // Load character whenever the signed-in user changes.
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

  // Subscribe to quest changes once we know who the user is.
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

  const completeQuest = useCallback(
    async (quest: Quest) => {
      if (!user || !character) return;
      if (isQuestDoneToday(quest)) return;

      const today = todayKey();
      const baseExp = DIFFICULTY_EXP[quest.difficulty];
      const newStreak =
        quest.type === 'daily'
          ? quest.completedDates.includes(yesterdayKey())
            ? quest.streak + 1
            : 1
          : quest.streak;
      // 10% bonus per streak day, capped at +100%.
      const streakMultiplier =
        quest.type === 'daily' ? Math.min(2, 1 + 0.1 * Math.max(0, newStreak - 1)) : 1;
      const expGained = Math.round(baseExp * streakMultiplier);

      // Stat reward: small bump proportional to difficulty.
      const statGain =
        { E: 1, D: 1, C: 2, B: 3, A: 5, S: 8 }[quest.difficulty] ?? 1;

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

      // Persist quest progress, character state, and a completion log entry.
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
        logCompletion(user.uid, quest.id, expGained),
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

  const clearLevelUp = useCallback(() => setLastLevelUp(null), []);

  return {
    character,
    quests,
    loading,
    needsCharacter,
    lastLevelUp,
    clearLevelUp,
    createCharacterWithName,
    completeQuest,
  };
}

export { isQuestDoneToday };
