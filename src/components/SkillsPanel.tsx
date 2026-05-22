import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { SystemWindow } from './SystemWindow';
import type { Character } from '../types';
import { SKILLS, type SkillDef } from '../lib/skills';

interface Props {
  open: boolean;
  character: Character;
  onClose: () => void;
}

const CATEGORY_LABEL: Record<SkillDef['category'], string> = {
  attack: '攻撃',
  defense: '防御',
  support: '支援',
  mind: '精神',
  special: '特殊',
};

const CATEGORIES: SkillDef['category'][] = ['attack', 'defense', 'support', 'mind', 'special'];

function formatDate(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

export function SkillsPanel({ open, character, onClose }: Props) {
  const [filter, setFilter] = useState<'all' | SkillDef['category']>('all');
  const unlocked = useMemo(() => new Set(character.unlocked?.skills ?? []), [character]);
  const dates = character.unlocked?.skillDates ?? {};

  const filtered = useMemo(() => {
    return filter === 'all' ? SKILLS : SKILLS.filter((s) => s.category === filter);
  }, [filter]);

  const unlockedCount = unlocked.size;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div className="w-full max-w-3xl my-auto" onClick={(e) => e.stopPropagation()}>
        <SystemWindow title="Skills" subtitle="abilities awakened">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-widest text-sys-muted">
              解放済み <span className="font-mono text-purple-300">{unlockedCount}</span>{' '}
              <span className="text-sys-muted">/ {SKILLS.length}</span>
            </p>
            <button type="button" onClick={onClose} className="text-sys-muted hover:text-sys-text" aria-label="閉じる">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-4 flex flex-wrap gap-1.5 text-[10px] uppercase tracking-widest">
            <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterChip>
            {CATEGORIES.map((c) => (
              <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)}>
                {CATEGORY_LABEL[c]}
              </FilterChip>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 max-h-[60vh] overflow-y-auto pr-1">
            {filtered.map((s) => {
              const isUnlocked = unlocked.has(s.id);
              const at = dates[s.id];
              return (
                <div
                  key={s.id}
                  className={`relative border px-3 py-2.5 ${
                    isUnlocked
                      ? 'border-purple-300/50 bg-purple-400/5'
                      : 'border-sys-border/20 bg-black/30 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`text-2xl ${isUnlocked ? '' : 'grayscale opacity-50'}`}>
                      {s.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3
                          className={`font-bold leading-tight ${
                            isUnlocked ? 'text-sys-text' : 'text-sys-muted'
                          }`}
                        >
                          {s.name}
                        </h3>
                        <span className="text-[10px] uppercase tracking-widest text-sys-muted">
                          {CATEGORY_LABEL[s.category]}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-sys-text/70">{s.description}</p>
                      {isUnlocked ? (
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-purple-300">
                          <span>✓ 習得</span>
                          {at && <span className="text-sys-muted">{formatDate(at)}</span>}
                        </div>
                      ) : (
                        <div className="mt-1 text-[10px] text-sys-muted">
                          解放条件: {s.unlockText}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-[10px] text-sys-muted">
            ※ サンプルのスキルセットです。スキルリスト確定後に差し替えます。
          </p>
        </SystemWindow>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-2 py-1 transition ${
        active
          ? 'border-purple-300 text-purple-300 bg-purple-300/10'
          : 'border-sys-border/30 text-sys-muted hover:text-sys-text hover:border-sys-border'
      }`}
    >
      {children}
    </button>
  );
}
