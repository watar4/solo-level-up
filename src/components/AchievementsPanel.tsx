import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { SystemWindow } from './SystemWindow';
import type { Character } from '../types';
import { ACHIEVEMENTS, type AchievementDef } from '../lib/achievements';

interface Props {
  open: boolean;
  character: Character;
  onClose: () => void;
}

const CATEGORY_LABEL: Record<AchievementDef['category'], string> = {
  streak: '連続',
  level: 'ランク',
  quest: 'クエスト',
  stat: 'ステータス',
  special: '特殊',
};

const CATEGORIES: AchievementDef['category'][] = ['streak', 'level', 'quest', 'stat', 'special'];

function formatDate(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

export function AchievementsPanel({ open, character, onClose }: Props) {
  const [filter, setFilter] = useState<'all' | AchievementDef['category']>('all');
  const unlocked = useMemo(() => new Set(character.unlocked?.achievements ?? []), [character]);
  const dates = character.unlocked?.achievementDates ?? {};

  const filtered = useMemo(() => {
    return filter === 'all' ? ACHIEVEMENTS : ACHIEVEMENTS.filter((a) => a.category === filter);
  }, [filter]);

  const unlockedCount = unlocked.size;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div className="w-full max-w-3xl my-auto" onClick={(e) => e.stopPropagation()}>
        <SystemWindow title="Achievements" subtitle="record of deeds">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-widest text-sys-muted">
              解放済み <span className="font-mono text-sys-gold">{unlockedCount}</span>{' '}
              <span className="text-sys-muted">/ {ACHIEVEMENTS.length}</span>
            </p>
            <button type="button" onClick={onClose} className="text-sys-muted hover:text-sys-text" aria-label="閉じる">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-4 flex flex-wrap gap-1.5 text-[10px] uppercase tracking-widest">
            <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
              All
            </FilterChip>
            {CATEGORIES.map((c) => (
              <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)}>
                {CATEGORY_LABEL[c]}
              </FilterChip>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 max-h-[60vh] overflow-y-auto pr-1">
            {filtered.map((a) => {
              const isUnlocked = unlocked.has(a.id);
              const at = dates[a.id];
              return (
                <div
                  key={a.id}
                  className={`relative border px-3 py-2.5 ${
                    isUnlocked
                      ? 'border-sys-gold/50 bg-sys-gold/5'
                      : 'border-sys-border/20 bg-black/30 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`text-2xl ${isUnlocked ? '' : 'grayscale opacity-50'}`}>
                      {a.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className={`font-bold leading-tight ${isUnlocked ? 'text-sys-text' : 'text-sys-muted'}`}>
                          {a.name}
                        </h3>
                        <span className="text-[10px] uppercase tracking-widest text-sys-muted">
                          {CATEGORY_LABEL[a.category]}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-sys-text/70">{a.description}</p>
                      {isUnlocked ? (
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-sys-gold">
                          <span>✓ 獲得</span>
                          {at && <span className="text-sys-muted">{formatDate(at)}</span>}
                          {a.reward?.title && (
                            <span className="border border-sys-gold/40 px-1.5 py-0.5 text-sys-gold">
                              称号: {a.reward.title}
                            </span>
                          )}
                        </div>
                      ) : (
                        a.reward?.statPoints && (
                          <div className="mt-1 text-[10px] text-sys-muted">
                            報酬: +{a.reward.statPoints} pt
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
          ? 'border-sys-accent text-sys-accent bg-sys-accent/10'
          : 'border-sys-border/30 text-sys-muted hover:text-sys-text hover:border-sys-border'
      }`}
    >
      {children}
    </button>
  );
}
