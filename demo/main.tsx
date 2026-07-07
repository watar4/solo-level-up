import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { AdventurePanel } from '../src/components/adventure/AdventurePanel';
import { defaultCampaign, type CampaignState } from '../src/lib/story/campaign';
import type { Character } from '../src/types';

// Standalone demo harness — mounts the real AdventurePanel with mock data so
// the campaign can be driven end-to-end in a browser without Firebase auth.
// Not part of the app build; used only for verification screenshots.

const today = new Date().toISOString().slice(0, 10);

const character: Character = {
  uid: 'demo',
  name: 'デモ勇者',
  level: 20,
  exp: 0,
  totalExp: 0,
  stats: { STR: 40, AGI: 30, INT: 30, VIT: 40, PER: 40 },
  statPoints: 0,
  createdAt: 0,
  lastSeenAt: 0,
  appearance: { hunterClass: 'knight', primaryColor: '#3a6abc', accentColor: '#c8d0d8' },
  consumables: { potion: 3, 'power-crystal': 1 },
};

function Demo() {
  const [campaign, setCampaign] = useState<CampaignState>({
    ...defaultCampaign(today),
    will: { stock: 3, earnedToday: 0, date: today },
  });

  return (
    <AdventurePanel
      character={{ ...character, campaign }}
      effectiveStats={character.stats}
      quests={[]}
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
