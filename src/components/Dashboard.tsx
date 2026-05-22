import { useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { StatusPanel } from './StatusPanel';
import { QuestCard } from './QuestCard';
import { AddQuestModal } from './AddQuestModal';
import { LevelUpToast } from './LevelUpToast';
import { SystemWindow } from './SystemWindow';
import { isQuestDoneToday, useGameData } from '../hooks/useGameData';
import { createQuest } from '../lib/firestore';
import type { Character } from '../types';
import { LogOut, Plus, ScrollText } from 'lucide-react';

interface Props {
  user: User;
  character: Character;
  game: ReturnType<typeof useGameData>;
  onSignOut: () => void;
}

export function Dashboard({ user, character, game, onSignOut }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

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
          <button
            type="button"
            className="sys-button sys-button-danger"
            onClick={onSignOut}
          >
            <LogOut className="h-4 w-4" />
            ログアウト
          </button>
        </header>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
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

          <SystemWindow title="Quest Log" subtitle="daily missions">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-sys-muted flex items-center gap-1.5">
                <ScrollText className="h-3.5 w-3.5" />
                {active.length} 件のクエスト
              </p>
              <button
                type="button"
                className="sys-button"
                onClick={() => setModalOpen(true)}
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
                active.map((q) => (
                  <QuestCard
                    key={q.id}
                    quest={q}
                    doneToday={isQuestDoneToday(q)}
                    busy={game.busyQuestId === q.id}
                    onToggle={() => game.toggleQuest(q)}
                    onDelete={() => handleDelete(q)}
                  />
                ))
              )}
            </div>

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
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={async (input) => {
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
        }}
      />

      <LevelUpToast event={game.lastLevelUp} onDismiss={game.clearLevelUp} />
    </div>
  );
}
