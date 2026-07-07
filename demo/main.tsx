import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { AdventurePanel } from '../src/components/adventure/AdventurePanel';
import { defaultCampaign, type CampaignState } from '../src/lib/story/campaign';
import type { Character, Quest } from '../src/types';

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
  // remains to drive.
  const finale = window.location.hash === '#finale';
  const [campaign, setCampaign] = useState<CampaignState>({
    ...defaultCampaign(today),
    will: { stock: 3, earnedToday: 0, date: today },
    ...(finale ? { chapter: 12, clearedChapters: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], medals: ['hayaoki', 'kyouyaru', 'shuuchuu', 'harahachi', 'kotsukotsu', 'undou', 'oyasumi', 'yokkame', 'homeru', 'bochibochi', 'ippozutsu'] } : {}),
  });

  return (
    <AdventurePanel
      character={{ ...character, campaign }}
      effectiveStats={character.stats}
      quests={mockQuests}
      campaign={campaign}
      equippedShadows={[]}
      // Keep Will topped up so the full chapter can be walked in one demo run.
      onSaveCampaign={async (c) => setCampaign({ ...c, will: { ...c.will, stock: 3 } })}
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
