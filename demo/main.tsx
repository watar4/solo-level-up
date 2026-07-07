import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { AdventurePanel } from '../src/components/adventure/AdventurePanel';
import { defaultCampaign, type CampaignState } from '../src/lib/story/campaign';
import type { Character, Quest, Shadow } from '../src/types';

const demoShadows: Shadow[] = [
  { id: 's1', uid: 'demo', templateId: 'vit-e', name: '影の守護神', stat: 'VIT', rarity: 'epic', equipped: true, createdAt: 0, level: 12, exp: 0 },
  { id: 's2', uid: 'demo', templateId: 'agi-e', name: '影の風狼', stat: 'AGI', rarity: 'epic', equipped: true, createdAt: 0, level: 12, exp: 0 },
  { id: 's3', uid: 'demo', templateId: 'int-r', name: '影の魔導士', stat: 'INT', rarity: 'rare', equipped: true, createdAt: 0, level: 10, exp: 0 },
];

// Standalone demo harness — mounts the real AdventurePanel with mock data so
// the campaign can be driven end-to-end in a browser without Firebase auth.
// Not part of the app build; used only for verification screenshots.

const today = new Date().toISOString().slice(0, 10);

const character: Character = {
  uid: 'demo',
  name: 'デモ勇者',
  level: 60,
  exp: 0,
  totalExp: 0,
  stats: { STR: 99, AGI: 60, INT: 60, VIT: 99, PER: 80 },
  statPoints: 0,
  createdAt: 0,
  lastSeenAt: 0,
  appearance: { hunterClass: 'knight', primaryColor: '#3a6abc', accentColor: '#c8d0d8' },
  consumables: { potion: 3, 'power-crystal': 1 },
};

// A long consecutive completion history so every chapter's continuity gate is
// satisfied and all chapters are selectable for the demo.
const history: string[] = (() => {
  const days: string[] = [];
  const d = new Date();
  for (let i = 0; i < 700; i++) {
    days.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() - 1);
  }
  return days;
})();

const mockQuests: Quest[] = [
  { id: 'q', uid: 'demo', title: '鍛錬', type: 'daily', targetStat: 'STR', difficulty: 'C', completedDates: history, streak: history.length, createdAt: 0 },
];

function Demo() {
  // #finale seeds chapters 1-11 cleared so only the final chapter (+ending)
  // remains to drive. #nowill starts with 0 Will (shortage UX). #weak swaps
  // in a fragile Lv1 hunter (defeat UX).
  const hash = window.location.hash;
  const finale = hash === '#finale';
  const noWill = hash === '#nowill';
  const weak = hash === '#weak';
  const [campaign, setCampaign] = useState<CampaignState>({
    ...defaultCampaign(today),
    will: { stock: noWill ? 0 : 3, earnedToday: noWill ? 3 : 0, date: today },
    ...(finale ? { chapter: 12, clearedChapters: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], medals: ['hayaoki', 'kyouyaru', 'shuuchuu', 'harahachi', 'kotsukotsu', 'undou', 'oyasumi', 'yokkame', 'homeru', 'bochibochi', 'ippozutsu'] } : {}),
  });

  const demoChar: Character = weak
    ? { ...character, level: 1, stats: { STR: 3, AGI: 3, INT: 3, VIT: 1, PER: 1 } }
    : character;

  return (
    <AdventurePanel
      character={{ ...demoChar, campaign }}
      effectiveStats={demoChar.stats}
      quests={mockQuests}
      campaign={campaign}
      equippedShadows={weak ? [] : demoShadows}
      // Keep Will topped up so the full chapter can be walked in one demo run
      // (except the #nowill shortage scenario).
      onSaveCampaign={async (c) => setCampaign(noWill ? c : { ...c, will: { ...c.will, stock: 3 } })}
      onAwardGold={async () => {}}
      onAwardShadow={async () => ({ id: 's1', name: 'ねむりの影' })}
      onShadowGrowth={async () => []}
      onUseConsumable={async () => true}
      onEnqueueEvent={(e) => console.log('[event]', e.primary)}
      onClose={() => console.log('[close]')}
    />
  );
}

createRoot(document.getElementById('root')!).render(<Demo />);
