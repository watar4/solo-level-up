import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { CharacterCreation } from '../src/components/CharacterCreation';
import { ClosetPanel } from '../src/components/ClosetPanel';
import { JobPanel } from '../src/components/JobPanel';
import type { Character, StatKey } from '../src/types';
import type { CampaignState } from '../src/lib/story/campaign';

// Demo harness for キャラクリ v2 (no Firebase). Hash routes:
//   (default) creation wizard · #closet · #job

const stats: Record<StatKey, number> = { STR: 60, AGI: 40, INT: 40, VIT: 55, PER: 45 };
const campaign: CampaignState = {
  version: 1, will: { stock: 3, earnedToday: 0, date: '2026-07-07' },
  chapter: 5, clearedChapters: [1, 2, 3, 4], clearedNodes: {},
  medals: ['hayaoki', 'kyouyaru', 'shuuchuu', 'harahachi', 'kotsukotsu', 'undou'],
  defeatedEnemies: [], dialogueSeen: [], lordAttempts: [],
};
const mock: Character = {
  uid: 'demo', name: 'デモ勇者', level: 45, exp: 0, totalExp: 0, stats,
  statPoints: 5, createdAt: 0, lastSeenAt: 0,
  appearance: {
    hunterClass: 'knight', primaryColor: '#3a6abc', accentColor: '#c8d0d8',
    skin: '#cf9c70', hair: 'ponytail', hairColor: '#8a5a2a', eyes: 'sharp',
    eyeColor: '#2f6ab0', outfit: 'knight', accessory: 'scar',
  },
  job: { base: 'knight', tier2: 'k-knight' },
  creed: 'steady',
  campaign,
};

// A JUST-created character: full v2 appearance, but no campaign / unlocked yet.
const freshMock: Character = {
  uid: 'demo', name: 'できたてハンター', level: 1, exp: 0, totalExp: 0,
  stats: { STR: 10, AGI: 10, INT: 10, VIT: 10, PER: 10 },
  statPoints: 0, createdAt: 0, lastSeenAt: 0,
  appearance: {
    hunterClass: 'mage', primaryColor: '#7a3ac3', accentColor: '#dbb56a',
    skin: '#f3c79b', hair: 'short', hairColor: '#5a3a22', eyes: 'normal',
    eyeColor: '#3a2a1a', outfit: 'mage', accessory: 'none',
  },
  job: { base: 'mage' },
  creed: 'steady',
};

function Demo() {
  const [hash] = useState(() => window.location.hash);
  if (hash === '#closet') {
    return <ClosetPanel character={mock} onClose={() => {}} onSave={async () => {}} />;
  }
  if (hash === '#closet-fresh') {
    return <ClosetPanel character={freshMock} onClose={() => {}} onSave={async () => {}} />;
  }
  if (hash === '#job') {
    return <JobPanel character={mock} onClose={() => {}} onAdvance={async () => {}} onChangeCreed={async () => {}} />;
  }
  return <CharacterCreation onCreate={async () => {}} />;
}

createRoot(document.getElementById('root')!).render(<Demo />);
