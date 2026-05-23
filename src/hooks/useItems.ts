import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addItem,
  deleteItem,
  subscribeItems,
  updateItem,
} from '../lib/firestore';
import { getWeaponTemplate, equippedWeapon } from '../lib/items';
import type { Item, ItemKind } from '../types';

export interface ItemsData {
  items: Item[];
  equippedWeapon: Item | null;
  equipWeapon: (id: string) => Promise<void>;
  unequipWeapon: (id: string) => Promise<void>;
  discardItem: (id: string) => Promise<void>;
  awardWeapon: (templateId: string) => Promise<Item | null>;
}

export function useItems(uid: string | null): ItemsData {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    if (!uid) {
      setItems([]);
      return;
    }
    return subscribeItems(uid, setItems);
  }, [uid]);

  // Equip a weapon — also unequips any currently-equipped weapon so only one
  // is ever active at a time. Done sequentially so Firestore sees a coherent
  // state at any tick.
  const equipWeapon = useCallback(
    async (id: string): Promise<void> => {
      const target = items.find((i) => i.id === id);
      if (!target || target.equipped) return;
      const currentlyEquipped = items.find(
        (i) => i.kind === target.kind && i.equipped
      );
      if (currentlyEquipped) {
        await updateItem(currentlyEquipped.id, { equipped: false });
      }
      await updateItem(id, { equipped: true });
    },
    [items]
  );

  const unequipWeapon = useCallback(async (id: string): Promise<void> => {
    await updateItem(id, { equipped: false });
  }, []);

  const discardItem = useCallback(async (id: string): Promise<void> => {
    await deleteItem(id);
  }, []);

  const awardWeapon = useCallback(
    async (templateId: string): Promise<Item | null> => {
      if (!uid) return null;
      const template = getWeaponTemplate(templateId);
      if (!template) return null;
      const partial: Omit<Item, 'id'> = {
        uid,
        kind: 'weapon' satisfies ItemKind,
        templateId: template.id,
        name: template.name,
        stat: template.stat,
        rarity: template.rarity,
        equipped: false,
        createdAt: Date.now(),
      };
      const id = await addItem(partial);
      return { ...partial, id };
    },
    [uid]
  );

  const equipped = useMemo(() => equippedWeapon(items), [items]);

  return {
    items,
    equippedWeapon: equipped,
    equipWeapon,
    unequipWeapon,
    discardItem,
    awardWeapon,
  };
}
