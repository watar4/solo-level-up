import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { StatusPanel } from './StatusPanel';
import { QuestCard } from './QuestCard';
import { AddQuestModal } from './AddQuestModal';
import { SystemToast } from './SystemToast';
import { HistoryPanel } from './HistoryPanel';
import { AchievementsPanel } from './AchievementsPanel';
import { SkillsPanel } from './SkillsPanel';
import { ResetAccountModal } from './ResetAccountModal';
import { SystemWindow } from './SystemWindow';
import { isQuestDoneToday, useGameData } from '../hooks/useGameData';
import { createQuest } from '../lib/firestore';
import type { Character, Quest } from '../types';
import {
  Award,
  ChevronDown,
  ChevronUp,
  History,
  LogOut,
  Plus,
  RotateCcw,
  ScrollText,
  Sparkles,
} from 'lucide-react';

interface Props {
  user: User;
  character: Character;
  game: ReturnType<typeof useGameData>;
  onSignOut: () => void;
}

// Paginate (button step-scroll) past this many active quests. Up to N fit
// naturally on screen; beyond that you advance the viewport one quest at a time.
const VIEWPORT_SIZE = 5;

export function Dashboard({ user, character, game, onSignOut }: Props) {
  const [questModal, setQuestModal] = useState<{ open: boolean; editing: Quest | null }>({
    open: false,
    editing: null,
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [achOpen, setAchOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const [active, archived] = useMemo(() => {
    const a = game.quests.filter((q) => !q.archived);
    const b = game.quests.filter((q) => q.archived);
    return [a, b];
  }, [game.quests]);

  const handleDelete = (q: Parameters<typeof game.removeQuestWithRefund>[0]) => {
    const count = q.completedDates.length;
    const msg =
      count > 0
        ? `「${q.title}」を削除しますか?\n\nこのクエストで獲得した EXP とステータス (達成 ${count} 回分) も取り消されます。`
        : `「${q.title}」を削除しますか?`;
    if (window.confirm(msg)) {
      void game.removeQuestWithRefund(q);
    }
  };

  const todayDoneCount = useMemo(
    () => active.filter((q) => isQuestDoneToday(q)).length,
    [active]
  );

  const paginate = active.length > VIEWPORT_SIZE;
  const maxStart = Math.max(0, active.length - VIEWPORT_SIZE);
  const [viewStart, setViewStart] = useState(0);
  // Clamp when the list shrinks (e.g. deletion) so we never sit past the end.
  useEffect(() => {
    if (viewStart > maxStart) setViewStart(maxStart);
  }, [maxStart, viewStart]);

  const visibleStart = paginate ? viewStart : 0;
  const visibleEnd = paginate ? viewStart + VIEWPORT_SIZE : active.length;
  const visible = paginate ? active.slice(visibleStart, visibleEnd) : active;

  const scrollUp = () => setViewStart((s) => Math.max(0, s - 1));
  const scrollDown = () => setViewStart((s) => Math.min(maxStart, s + 1));

  // When the user moves a quest off the visible window via the in-card arrows,
  // follow it so they don't lose track of what they just moved.
  const handleMoveUp = (q: Quest, fullIdx: number) => {
    if (paginate && fullIdx === viewStart && viewStart > 0) {
      setViewStart(viewStart - 1);
    }
    void game.moveQuest(q, 'up');
  };
  const handleMoveDown = (q: Quest, fullIdx: number) => {
    if (paginate && fullIdx === visibleEnd - 1 && viewStart < maxStart) {
      setViewStart(viewStart + 1);
    }
    void game.moveQuest(q, 'down');
  };

  return (
    <div className="min-h-screen px-4 py-6 md:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="sys-title">Daily System</p>
            <h1 className="text-2xl font-black tracking-wider">
              <span className="text-sys-accent drop-shadow-[0_0_6px_rgba(0,212,255,0.6)]">
                SOLO
              </span>{' '}
              LEVEL UP
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="sys-button" onClick={() => setHistoryOpen(true)}>
              <History className="h-4 w-4" />
              履歴
            </button>
            <button type="button" className="sys-button" onClick={() => setAchOpen(true)}>
              <Award className="h-4 w-4" />
              実績
              <span className="ml-1 text-[10px] font-mono text-sys-gold">
                {(character.unlocked?.achievements ?? []).length}
              </span>
            </button>
            <button type="button" className="sys-button" onClick={() => setSkillsOpen(true)}>
              <Sparkles className="h-4 w-4" />
              スキル
              <span className="ml-1 text-[10px] font-mono text-purple-300">
                {(character.unlocked?.skills ?? []).length}
              </span>
            </button>
            <button type="button" className="sys-button sys-button-danger" onClick={() => setResetOpen(true)}>
              <RotateCcw className="h-4 w-4" />
              リセット
            </button>
            <button type="button" className="sys-button" onClick={onSignOut}>
              <LogOut className="h-4 w-4" />
              ログアウト
            </button>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <SystemWindow title="Quest Log" subtitle="daily missions">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-sys-muted flex items-center gap-1.5">
                <ScrollText className="h-3.5 w-3.5" />
                {active.length} 件のクエスト
              </p>
              <button
                type="button"
                className="sys-button"
                onClick={() => setQuestModal({ open: true, editing: null })}
              >
                <Plus className="h-4 w-4" />
                発行
              </button>
            </div>

            <div className="space-y-2">
              {active.length === 0 ? (
                <div className="border border-dashed border-sys-border/30 px-4 py-10 text-center text-sm text-sys-muted">
                  まだクエストがありません。<br />
                  「発行」から最初のミッションを登録しましょう。
                </div>
              ) : (
                visible.map((q, viewIdx) => {
                  const fullIdx = visibleStart + viewIdx;
                  return (
                    <QuestCard
                      key={q.id}
                      quest={q}
                      doneToday={isQuestDoneToday(q)}
                      busy={game.busyQuestId === q.id}
                      onToggle={() => game.toggleQuest(q)}
                      onDelete={() => handleDelete(q)}
                      onEdit={() => setQuestModal({ open: true, editing: q })}
                      onMoveUp={() => handleMoveUp(q, fullIdx)}
                      onMoveDown={() => handleMoveDown(q, fullIdx)}
                      canMoveUp={fullIdx > 0}
                      canMoveDown={fullIdx < active.length - 1}
                    />
                  );
                })
              )}
            </div>

            {paginate && (
              <div className="mt-3 flex items-center justify-center gap-3 border-t border-sys-border/20 pt-3">
                <button
                  type="button"
                  onClick={scrollUp}
                  disabled={viewStart === 0}
                  aria-label="1件上へスクロール"
                  title="1件上へ"
                  className="border border-sys-border/40 px-2 py-1 text-sys-text hover:border-sys-accent hover:text-sys-accent disabled:opacity-30 disabled:hover:border-sys-border/40 disabled:hover:text-sys-text transition"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <span className="font-mono text-[11px] text-sys-muted tabular-nums">
                  {visibleStart + 1}–{Math.min(active.length, visibleEnd)} / {active.length}
                </span>
                <button
                  type="button"
                  onClick={scrollDown}
                  disabled={viewStart >= maxStart}
                  aria-label="1件下へスクロール"
                  title="1件下へ"
                  className="border border-sys-border/40 px-2 py-1 text-sys-text hover:border-sys-accent hover:text-sys-accent disabled:opacity-30 disabled:hover:border-sys-border/40 disabled:hover:text-sys-text transition"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            )}

            {archived.length > 0 && (
              <details className="mt-5 border-t border-sys-border/20 pt-3">
                <summary className="cursor-pointer text-xs uppercase tracking-widest text-sys-muted hover:text-sys-text">
                  完了済み / アーカイブ ({archived.length})
                </summary>
                <div className="mt-3 space-y-2 opacity-70">
                  {archived.map((q) => (
                    <QuestCard
                      key={q.id}
                      quest={q}
                      doneToday={true}
                      busy={game.busyQuestId === q.id}
                      onToggle={() => game.toggleQuest(q)}
                      onDelete={() => handleDelete(q)}
                    />
                  ))}
                </div>
              </details>
            )}
          </SystemWindow>

          <div className="space-y-6">
            <StatusPanel character={character} email={user.email} />

            <SystemWindow title="Today" subtitle="progress">
              <div className="space-y-2">
                <p className="text-sm text-sys-text/80">
                  本日のクエスト達成:{' '}
                  <span className="font-mono text-lg text-sys-accent">
                    {todayDoneCount}
                  </span>{' '}
                  <span className="text-sys-muted">/ {active.length}</span>
                </p>
                <div className="h-2 w-full overflow-hidden border border-sys-border/30 bg-black/40">
                  <div
                    className="h-full bg-gradient-to-r from-sys-ok to-sys-accent transition-all duration-500"
                    style={{
                      width:
                        active.length > 0
                          ? `${(todayDoneCount / active.length) * 100}%`
                          : '0%',
                    }}
                  />
                </div>
              </div>
            </SystemWindow>
          </div>
        </div>

        <footer className="mt-10 text-center text-[11px] text-sys-muted">
          Solo Level Up · made with Vite + Firebase ·{' '}
          <a
            href="https://github.com/watar4/solo-level-up"
            className="underline hover:text-sys-accent"
            target="_blank"
            rel="noreferrer"
          >
            source
          </a>
        </footer>
      </div>

      <AddQuestModal
        open={questModal.open}
        initial={questModal.editing}
        onClose={() => setQuestModal({ open: false, editing: null })}
        onSubmit={async (input) => {
          if (questModal.editing) {
            await game.editQuest(questModal.editing, input);
          } else {
            await createQuest({
              uid: user.uid,
              title: input.title,
              description: input.description,
              type: input.type,
              targetStat: input.targetStat,
              difficulty: input.difficulty,
              completedDates: [],
              streak: 0,
              createdAt: Date.now(),
              archived: false,
            });
          }
        }}
      />

      <SystemToast event={game.pendingEvents[0] ?? null} onDismiss={game.popEvent} />
      <HistoryPanel open={historyOpen} uid={user.uid} quests={game.quests} onClose={() => setHistoryOpen(false)} />
      <AchievementsPanel open={achOpen} character={character} onClose={() => setAchOpen(false)} />
      <SkillsPanel open={skillsOpen} character={character} onClose={() => setSkillsOpen(false)} />
      <ResetAccountModal
        open={resetOpen}
        character={character}
        quests={game.quests}
        onClose={() => setResetOpen(false)}
        onConfirm={() => game.resetAccount()}
      />
    </div>
  );
}
