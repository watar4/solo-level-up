import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addShadow,
  deleteShadow,
  subscribeShadows,
  updateShadow,
} from '../lib/firestore';
import {
  SHADOW_EQUIP_LIMIT,
  SHADOW_TEMPLATES,
} from '../lib/shadows';
import { applyShadowExp, shadowExpForBossWin } from '../lib/shadowGrowth';
import type { Shadow, ShadowRarity } from '../types';

// One equipped shadow's growth outcome after a boss win — the caller turns
// notable ones (level-up / evolution) into SystemToasts.
export interface ShadowGrowth {
  shadow: Shadow;         // post-growth state
  levelsGained: number;
  evolved: boolean;
  newStageName?: string;
}

export interface ShadowsData {
  shadows: Shadow[];
  equippedShadows: Shadow[];
  equippedCount: number;
  equipShadow: (id: string) => Promise<void>;
  unequipShadow: (id: string) => Promise<void>;
  awardShadow: (templateId: string) => Promise<Shadow | null>;
  discardShadow: (id: string) => Promise<void>;
  // Grant boss-victory EXP to every equipped shadow. Persists level/exp and
  // returns each shadow's growth so the battle UI can toast level-ups.
  gainShadowExpForWin: (floor: number) => Promise<ShadowGrowth[]>;
}

export function useShadows(uid: string | null): ShadowsData {
  const [shadows, setShadows] = useState<Shadow[]>([]);

  useEffect(() => {
    if (!uid) {
      setShadows([]);
      return;
    }
    return subscribeShadows(uid, setShadows);
  }, [uid]);

  const equipShadow = useCallback(
    async (id: string): Promise<void> => {
      const target = shadows.find((s) => s.id === id);
      if (!target || target.equipped) return;
      const equippedCount = shadows.filter((s) => s.equipped).length;
      if (equippedCount >= SHADOW_EQUIP_LIMIT) return;
      await updateShadow(id, { equipped: true });
    },
    [shadows]
  );

  const unequipShadow = useCallback(async (id: string): Promise<void> => {
    await updateShadow(id, { equipped: false });
  }, []);

  // Award (create) a new shadow from a template id. Returns the locally-built
  // shadow object (with the generated Firestore id) for the caller to feed
  // into a system toast.
  const awardShadow = useCallback(
    async (templateId: string): Promise<Shadow | null> => {
      if (!uid) return null;
      const template = SHADOW_TEMPLATES.find((t) => t.id === templateId);
      if (!template) return null;
      const partial: Omit<Shadow, 'id'> = {
        uid,
        templateId: template.id,
        name: template.name,
        stat: template.stat,
        rarity: template.rarity as ShadowRarity,
        equipped: false,
        createdAt: Date.now(),
      };
      const id = await addShadow(partial);
      return { ...partial, id };
    },
    [uid]
  );

  const discardShadow = useCallback(async (id: string): Promise<void> => {
    await deleteShadow(id);
  }, []);

  const equippedShadows = useMemo(
    () => shadows.filter((s) => s.equipped),
    [shadows]
  );

  const gainShadowExpForWin = useCallback(
    async (floor: number): Promise<ShadowGrowth[]> => {
      const gain = shadowExpForBossWin(floor);
      const growths: ShadowGrowth[] = [];
      await Promise.all(
        equippedShadows.map(async (s) => {
          const result = applyShadowExp(s, gain);
          growths.push({
            shadow: { ...s, level: result.level, exp: result.exp },
            levelsGained: result.levelsGained,
            evolved: result.evolved,
            newStageName: result.newStageName,
          });
          await updateShadow(s.id, { level: result.level, exp: result.exp });
        })
      );
      return growths;
    },
    [equippedShadows]
  );

  return {
    shadows,
    equippedShadows,
    equippedCount: equippedShadows.length,
    equipShadow,
    unequipShadow,
    awardShadow,
    discardShadow,
    gainShadowExpForWin,
  };
}
