import { useCallback, useEffect, useState } from 'react';
import {
  addShadow,
  deleteShadow,
  subscribeShadows,
  updateShadow,
} from '../lib/firestore';
import {
  SHADOW_EQUIP_LIMIT,
  SHADOW_TEMPLATES,
  totalShadowBonus,
} from '../lib/shadows';
import type { Shadow, ShadowRarity, StatKey } from '../types';

export interface ShadowsData {
  shadows: Shadow[];
  equippedCount: number;
  bonus: Record<StatKey, number>;
  equipShadow: (id: string) => Promise<void>;
  unequipShadow: (id: string) => Promise<void>;
  awardShadow: (templateId: string) => Promise<Shadow | null>;
  discardShadow: (id: string) => Promise<void>;
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

  const equippedCount = shadows.filter((s) => s.equipped).length;
  const bonus = totalShadowBonus(shadows);

  return {
    shadows,
    equippedCount,
    bonus,
    equipShadow,
    unequipShadow,
    awardShadow,
    discardShadow,
  };
}
