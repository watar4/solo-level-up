import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { CoachCard } from '../src/components/CoachCard';
import { CoachPanel } from '../src/components/CoachPanel';
import { buildCoachContext } from '../src/lib/coach/context';
import { createRulesEngine } from '../src/lib/coach/engine';
import type { CoachEngineApi } from '../src/hooks/useCoachEngine';
import type { Character, Quest } from '../src/types';

// Coach demo harness (no Firebase, no WebGPU): renders the real CoachCard +
// CoachPanel against a mock context and the rules engine, to smoke-test render
// + streaming chat end-to-end.

const character: Character = {
  uid: 'demo', name: 'デモ勇者', level: 12, exp: 0, totalExp: 0,
  stats: { STR: 20, AGI: 15, INT: 15, VIT: 18, PER: 12 },
  statPoints: 0, createdAt: 0, lastSeenAt: new Date('2026-07-06T09:00:00').getTime(),
  streakFreeze: { stock: 1, weekStartDate: '2026-07-06' },
  weightTarget: 65,
};

const quests: Quest[] = [
  { id: 'a', uid: 'demo', title: '腕立て10回', type: 'daily', targetStat: 'STR', difficulty: 'C', completedDates: ['2026-07-06'], streak: 12, createdAt: 0 },
  { id: 'b', uid: 'demo', title: '読書15分', type: 'daily', targetStat: 'INT', difficulty: 'D', completedDates: ['2026-07-07'], streak: 3, createdAt: 0 },
  { id: 'c', uid: 'demo', title: '散歩', type: 'daily', targetStat: 'AGI', difficulty: 'E', completedDates: [], streak: 0, createdAt: 0 },
];

const ctx = buildCoachContext({ today: '2026-07-07', character, quests });

const rules = createRulesEngine();
const engine: CoachEngineApi = {
  kind: 'rules', status: 'rules', webgpu: false, modelId: null, progress: null, error: null,
  downloadModel: async () => {}, activate: async () => {}, removeModel: async () => {},
  narrate: (c, d) => rules.narrate(c, d),
  chat: (c, h, onToken) => rules.chat(c, h, onToken),
};

function App() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ maxWidth: 560, margin: '2rem auto', padding: '0 1rem' }}>
      <CoachCard ctx={ctx} onOpenChat={() => setOpen(true)} />
      {open && (
        <CoachPanel open={open} uid="demo" ctx={ctx} engine={engine} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
