import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { StatusPanel } from './StatusPanel';
import { QuestCard } from './QuestCard';
import { SortableQuestCard } from './SortableQuestCard';
import { SystemToast } from './SystemToast';
import { SystemWindow } from './SystemWindow';
// AddQuestModal / QuestActionSheet are gated behind explicit user actions
// (tapping the issue button or long-pressing a quest), so we can defer their
// chunks too. The first interaction has a tiny network round-trip but the
// quest list itself renders faster on cold load.
const AddQuestModal     = lazy(() => import('./AddQuestModal').then((m) => ({ default: m.AddQuestModal })));
const QuestActionSheet  = lazy(() => import('./QuestActionSheet').then((m) => ({ default: m.QuestActionSheet })));
// Heavy / secondary panels are code-split: each chunk only downloads the
// first time the user opens it. Combined with the conditional `{open && ...}`
// renders below this drops the initial JS chunk meaningfully (Meal/AI,
// charts, boss combat, shadow inventory, etc. are not on the critical path).
const HistoryPanel       = lazy(() => import('./HistoryPanel').then((m) => ({ default: m.HistoryPanel })));
const AchievementsPanel  = lazy(() => import('./AchievementsPanel').then((m) => ({ default: m.AchievementsPanel })));
const ResetAccountModal  = lazy(() => import('./ResetAccountModal').then((m) => ({ default: m.ResetAccountModal })));
const StatsDashboard     = lazy(() => import('./StatsDashboard').then((m) => ({ default: m.StatsDashboard })));
const ShadowArmyPanel    = lazy(() => import('./ShadowArmyPanel').then((m) => ({ default: m.ShadowArmyPanel })));
const DailyBossPanel     = lazy(() => import('./DailyBossPanel').then((m) => ({ default: m.DailyBossPanel })));
const BattleSkillsPanel  = lazy(() => import('./BattleSkillsPanel').then((m) => ({ default: m.BattleSkillsPanel })));
const AppearanceEditor   = lazy(() => import('./AppearanceEditor').then((m) => ({ default: m.AppearanceEditor })));
const InventoryPanel     = lazy(() => import('./InventoryPanel').then((m) => ({ default: m.InventoryPanel })));
const ApiKeysPanel       = lazy(() => import('./ApiKeysPanel').then((m) => ({ default: m.ApiKeysPanel })));
const MealPanel          = lazy(() => import('./MealPanel').then((m) => ({ default: m.MealPanel })));
import { TabBar, type DashboardTab } from './TabBar';
import type { LucideIcon } from 'lucide-react';
import { useShadows } from '../hooks/useShadows';
import { useItems } from '../hooks/useItems';
import { rollShadowDrop, RARITY_LABEL } from '../lib/shadows';
import { weaponStatBonus } from '../lib/items';
import type { StatKey } from '../types';
import { isQuestDoneToday, useGameData } from '../hooks/useGameData';
import { createQuest } from '../lib/firestore';
import type { Character, Quest } from '../types';
import {
  Award,
  BarChart3,
  Backpack,
  ChevronDown,
  ChevronUp,
  Crown,
  History,
  KeyRound,
  LogOut,
  Palette,
  Plus,
  RotateCcw,
  ScrollText,
  Sparkles,
  Zap,
} from 'lucide-react';

interface ActionSheetState {
  quest: Quest;
  fullIdx: number;
  isArchived: boolean;
}

interface Props {
  user: User;
  character: Character;
  game: ReturnType<typeof useGameData>;
  onSignOut: () => void;
}

// Paginate (button step-scroll) past this many active quests. Up to N fit
// naturally on screen; beyond that you advance the viewport one quest at a time.
const VIEWPORT_SIZE = 5;

// A large tile button used on the Combat / Records / Menu tab screens. The old
// header crammed ~11 of these into one cramped row; the bottom-tab layout gives
// each category its own screen so the tiles can breathe.
function NavTile({
  Icon,
  label,
  sublabel,
  onClick,
  accent = 'default',
}: {
  Icon: LucideIcon;
  label: string;
  sublabel?: string;
  onClick: () => void;
  accent?: 'default' | 'gold' | 'danger';
}) {
  const accentClass =
    accent === 'gold'
      ? 'hover:border-sys-gold hover:text-sys-gold'
      : accent === 'danger'
      ? 'hover:border-sys-danger hover:text-sys-danger'
      : 'hover:border-sys-accent hover:text-sys-accent';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-2 border border-sys-border/40 bg-black/30 px-4 py-6 text-center text-sys-text transition ${accentClass}`}
    >
      <Icon className="h-7 w-7" />
      <span className="text-sm font-bold tracking-wide">{label}</span>
      {sublabel && (
        <span className="max-w-full truncate text-[10px] uppercase tracking-widest text-sys-muted">
          {sublabel}
        </span>
      )}
    </button>
  );
}

export function Dashboard({ user, character, game, onSignOut }: Props) {
  const [questModal, setQuestModal] = useState<{ open: boolean; editing: Quest | null }>({
    open: false,
    editing: null,
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [achOpen, setAchOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [shadowOpen, setShadowOpen] = useState(false);
  const [bossOpen, setBossOpen] = useState(false);
  const [battleSkillsOpen, setBattleSkillsOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [apiKeysOpen, setApiKeysOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [actionSheet, setActionSheet] = useState<ActionSheetState | null>(null);
  // Active bottom-nav tab. Most feature panels stay as modals; the tab screens
  // just re-home their trigger buttons out of the old cramped header row.
  const [tab, setTab] = useState<DashboardTab>('quest');

  // Shadow army subscription. Shadows now fight independently as boss
  // companions instead of granting passive stat bonuses.
  const shadowData = useShadows(user.uid);
  // Inventory items (weapons). One equipped weapon contributes a stat
  // bonus to the player's effective stats in combat.
  const itemsData = useItems(user.uid);

  // Player effective stats = base + equipped weapon bonus.
  const effectiveStats = useMemo<Record<StatKey, number>>(() => {
    const out: Record<StatKey, number> = { ...character.stats };
    const bonus = weaponStatBonus(itemsData.items);
    for (const k of Object.keys(bonus) as StatKey[]) {
      out[k] = (out[k] ?? 0) + (bonus[k] ?? 0);
    }
    return out;
  }, [character.stats, itemsData.items]);
  // Explicit "what's being dragged" id, set the instant dnd-kit fires
  // onDragStart. Forwarded to each SortableQuestCard so the lift visual can
  // fire even if useSortable.isDragging propagates a tick late.
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const [active, archived] = useMemo(() => {
    const a = game.quests.filter((q) => !q.archived);
    const b = game.quests.filter((q) => q.archived);
    return [a, b];
  }, [game.quests]);

  // Wrap toggle to roll a shadow drop on each successful quest completion.
  // The roll happens in JS (no Firestore involved beyond awardShadow itself),
  // so it stays snappy and adds zero coupling to useGameData.
  const handleQuestToggle = async (q: Quest) => {
    const wasComplete = isQuestDoneToday(q);
    await game.toggleQuest(q);
    if (wasComplete) return; // toggle was an uncomplete — no drop
    const template = rollShadowDrop(q.difficulty, q.targetStat);
    if (!template) return;
    const shadow = await shadowData.awardShadow(template.id);
    if (!shadow) return;
    game.enqueueEvent({
      id: `shadow:${shadow.id}`,
      kind: 'shadow',
      title: '影を獲得',
      primary: shadow.name,
      secondary: `${shadow.stat} 系 / ${RARITY_LABEL[shadow.rarity]}`,
      icon: '🌑',
      accent:
        shadow.rarity === 'legendary'
          ? 'gold'
          : shadow.rarity === 'epic'
          ? 'purple'
          : 'cyan',
    });
  };

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

  // All active quests are always rendered inside a scrollable container so
  // a drag operation can reorder across the full list (dnd-kit's autoScroll
  // pans the container when the dragged item approaches the edge). The ▲/▼
  // buttons step the scroll one card at a time — same intent as the previous
  // pagination, just expressed as scrollBy.
  const showScrollControls = active.length > VIEWPORT_SIZE;
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ top: 0, max: 0 });

  const updateScrollState = () => {
    const el = listRef.current;
    if (!el) return;
    setScrollState({
      top: el.scrollTop,
      max: Math.max(0, el.scrollHeight - el.clientHeight),
    });
  };

  useEffect(() => {
    updateScrollState();
  }, [active.length]);

  const stepScroll = (dir: 'up' | 'down') => {
    const el = listRef.current;
    if (!el) return;
    const step = el.clientHeight / VIEWPORT_SIZE;
    el.scrollBy({ top: dir === 'up' ? -step : step, behavior: 'auto' });
    // scrollBy fires `scroll` event but allow a frame for it to settle
    requestAnimationFrame(updateScrollState);
  };

  // Cross-page moves via the ⋮ menu's up/down arrows; auto-scrolls the
  // container so the user keeps the moved quest in view.
  const handleMoveUp = (q: Quest) => {
    void game.moveQuest(q, 'up');
    requestAnimationFrame(() => {
      listRef.current?.scrollBy({ top: -(listRef.current.clientHeight / VIEWPORT_SIZE), behavior: 'auto' });
      updateScrollState();
    });
  };
  const handleMoveDown = (q: Quest) => {
    void game.moveQuest(q, 'down');
    requestAnimationFrame(() => {
      listRef.current?.scrollBy({ top: listRef.current.clientHeight / VIEWPORT_SIZE, behavior: 'auto' });
      updateScrollState();
    });
  };

  // Drag-to-reorder is initiated from the dedicated grip handle inside each
  // QuestCard, so we no longer need a long-press timer to disambiguate a
  // drag from a scroll attempt — distance-based activation is enough and
  // makes the drag start feel snappier.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 6 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingId(event.active.id as string);
    // Double-blip haptic pattern on devices that support it (mostly Android).
    // Two short pulses feel more like a deliberate "click" than a single
    // sub-perceptual buzz, and reinforce the visual lift at the activation
    // moment. iOS Safari does not implement navigator.vibrate.
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([18, 28, 18]);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingId(null);
    const { active: a, over } = event;
    if (!over || a.id === over.id) return;
    const from = active.findIndex((q) => q.id === a.id);
    const to = active.findIndex((q) => q.id === over.id);
    if (from < 0 || to < 0) return;
    void game.reorderActive(from, to);
  };

  const handleDragCancel = () => setDraggingId(null);

  return (
    <div className="min-h-screen px-4 py-6 pb-28 md:py-10 md:pb-28">
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
          <div className="text-right">
            <p className="font-mono text-xs text-sys-muted">
              Lv.<span className="text-sys-accent">{character.level}</span>
            </p>
            <p className="text-[10px] uppercase tracking-widest text-sys-muted">
              {character.name}
            </p>
          </div>
        </header>

        {tab === 'quest' && (
        <div className="mx-auto max-w-xl space-y-6">
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

            {active.length === 0 ? (
              <div className="border border-dashed border-sys-border/30 px-4 py-10 text-center text-sm text-sys-muted">
                まだクエストがありません。<br />
                「発行」から最初のミッションを登録しましょう。
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
                <SortableContext
                  items={active.map((q) => q.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div
                    ref={listRef}
                    onScroll={updateScrollState}
                    className="space-y-2 max-h-[28rem] overflow-y-auto pr-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-sys-border/40"
                  >
                    {active.map((q, fullIdx) => (
                      <SortableQuestCard
                        key={q.id}
                        quest={q}
                        doneToday={isQuestDoneToday(q)}
                        busy={game.busyQuestId === q.id}
                        forceLifted={draggingId === q.id}
                        onToggle={() => handleQuestToggle(q)}
                        onOpenMenu={() =>
                          setActionSheet({ quest: q, fullIdx, isArchived: false })
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {active.length > 0 && (
              <p className="mt-2 text-[10px] text-sys-muted/70 text-center">
                ≡ をドラッグして並び替え · タップで完了
              </p>
            )}

            {showScrollControls && (
              <div className="mt-3 flex items-center justify-center gap-3 border-t border-sys-border/20 pt-3">
                <button
                  type="button"
                  onClick={() => stepScroll('up')}
                  disabled={scrollState.top <= 0}
                  aria-label="1件上へスクロール"
                  title="1件上へ"
                  className="border border-sys-border/40 px-2 py-1 text-sys-text hover:border-sys-accent hover:text-sys-accent disabled:opacity-30 disabled:hover:border-sys-border/40 disabled:hover:text-sys-text transition"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <span className="font-mono text-[11px] text-sys-muted tabular-nums">
                  全 {active.length} 件
                </span>
                <button
                  type="button"
                  onClick={() => stepScroll('down')}
                  disabled={scrollState.top >= scrollState.max - 1}
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
                      onToggle={() => handleQuestToggle(q)}
                      onOpenMenu={() =>
                        setActionSheet({ quest: q, fullIdx: -1, isArchived: true })
                      }
                    />
                  ))}
                </div>
              </details>
            )}
          </SystemWindow>

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
        )}

        {tab === 'status' && (
        <div className="mx-auto max-w-xl space-y-6">
          <StatusPanel
            character={character}
            email={user.email}
            uid={user.uid}
            onRename={game.renameCharacter}
            onAllocateStat={game.allocateStatPoint}
            onSetWeightTarget={game.setWeightTarget}
            onEditAppearance={() => setAppearanceOpen(true)}
          />

          <SystemWindow title="Records" subtitle="stats & history">
            <div className="grid grid-cols-2 gap-3">
              <NavTile
                Icon={BarChart3}
                label="統計"
                sublabel="statistics"
                onClick={() => setStatsOpen(true)}
              />
              <NavTile
                Icon={History}
                label="履歴"
                sublabel="quest log"
                onClick={() => setHistoryOpen(true)}
              />
              <NavTile
                Icon={Award}
                label="実績"
                sublabel="achievements"
                onClick={() => setAchOpen(true)}
              />
            </div>
          </SystemWindow>
        </div>
        )}

        {tab === 'meal' && (
          <Suspense fallback={<div className="py-10 text-center text-sys-muted">読み込み中…</div>}>
            <MealPanel
              uid={user.uid}
              character={character}
              onSetWeightTarget={game.setWeightTarget}
              onSetNutritionConfig={game.setNutritionConfig}
              onSetNutritionTarget={game.setNutritionTarget}
              onAwardNutritionExp={game.awardNutritionExp}
            />
          </Suspense>
        )}

        {tab === 'combat' && (
          <div className="mx-auto max-w-xl">
            <SystemWindow title="Combat" subtitle="battle & army">
              <div className="grid grid-cols-2 gap-3">
                <NavTile
                  Icon={Crown}
                  label="デイリーボス"
                  sublabel="boss raid"
                  accent="gold"
                  onClick={() => setBossOpen(true)}
                />
                <NavTile
                  Icon={Zap}
                  label="戦技"
                  sublabel="battle skills"
                  onClick={() => setBattleSkillsOpen(true)}
                />
                <NavTile
                  Icon={Sparkles}
                  label="影軍団"
                  sublabel={`${shadowData.equippedCount}/${shadowData.shadows.length} 編成`}
                  onClick={() => setShadowOpen(true)}
                />
                <NavTile
                  Icon={Backpack}
                  label="装備"
                  sublabel={itemsData.equippedWeapon ? itemsData.equippedWeapon.name : '未装備'}
                  onClick={() => setInventoryOpen(true)}
                />
              </div>
            </SystemWindow>
          </div>
        )}

        {tab === 'menu' && (
          <div className="mx-auto max-w-xl">
            <SystemWindow title="Menu" subtitle="settings & account">
              <div className="grid grid-cols-2 gap-3">
                <NavTile
                  Icon={KeyRound}
                  label="連携 / API"
                  sublabel="integrations"
                  onClick={() => setApiKeysOpen(true)}
                />
                <NavTile
                  Icon={Palette}
                  label="外見編集"
                  sublabel="appearance"
                  onClick={() => setAppearanceOpen(true)}
                />
                {!game.isMaster && (
                  <NavTile
                    Icon={Crown}
                    label="MASTER化"
                    sublabel="unlock all"
                    accent="gold"
                    onClick={() => void game.initializeMaster()}
                  />
                )}
                <NavTile
                  Icon={LogOut}
                  label="ログアウト"
                  sublabel="sign out"
                  onClick={onSignOut}
                />
                <NavTile
                  Icon={RotateCcw}
                  label="リセット"
                  sublabel="reset account"
                  accent="danger"
                  onClick={() => setResetOpen(true)}
                />
              </div>
            </SystemWindow>
          </div>
        )}

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

      <Suspense fallback={null}>
        {questModal.open && (
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
        )}
      </Suspense>

      <Suspense fallback={null}>
        {actionSheet && (
          <QuestActionSheet
            quest={actionSheet.quest}
            canMoveUp={!actionSheet.isArchived && actionSheet.fullIdx > 0}
            canMoveDown={
              !actionSheet.isArchived &&
              actionSheet.fullIdx < active.length - 1
            }
            onClose={() => setActionSheet(null)}
            onEdit={() => {
              setQuestModal({ open: true, editing: actionSheet.quest });
            }}
            onMoveUp={() => {
              if (!actionSheet.isArchived) {
                handleMoveUp(actionSheet.quest);
              }
            }}
            onMoveDown={() => {
              if (!actionSheet.isArchived) {
                handleMoveDown(actionSheet.quest);
              }
            }}
            onDelete={() => {
              handleDelete(actionSheet.quest);
            }}
          />
        )}
      </Suspense>

      <SystemToast event={game.pendingEvents[0] ?? null} onDismiss={game.popEvent} />
      {/* Every modal below is rendered conditionally (`{open && ...}`) AND is
          a React.lazy component, so its chunk only loads on first open. The
          single shared Suspense fallback is `null` because modals are
          ephemeral — a flicker is preferable to a layout-shifting spinner. */}
      <Suspense fallback={null}>
        {historyOpen && (
          <HistoryPanel open={historyOpen} uid={user.uid} quests={game.quests} onClose={() => setHistoryOpen(false)} />
        )}
        {statsOpen && (
          <StatsDashboard
            open={statsOpen}
            uid={user.uid}
            character={character}
            quests={game.quests}
            onClose={() => setStatsOpen(false)}
          />
        )}
        {shadowOpen && (
          <ShadowArmyPanel
            open={shadowOpen}
            shadows={shadowData.shadows}
            onClose={() => setShadowOpen(false)}
            onEquip={shadowData.equipShadow}
            onUnequip={shadowData.unequipShadow}
            onDiscard={shadowData.discardShadow}
          />
        )}
        {battleSkillsOpen && (
          <BattleSkillsPanel
            open={battleSkillsOpen}
            character={character}
            onClose={() => setBattleSkillsOpen(false)}
            onSave={game.setEquippedSkills}
          />
        )}
        {appearanceOpen && (
          <AppearanceEditor
            open={appearanceOpen}
            current={character.appearance}
            onClose={() => setAppearanceOpen(false)}
            onSave={game.updateAppearance}
          />
        )}
        {bossOpen && (
          <DailyBossPanel
            open={bossOpen}
            uid={user.uid}
            character={character}
            effectiveStats={effectiveStats}
            equippedShadows={shadowData.equippedShadows}
            onClose={() => setBossOpen(false)}
            onAwardShadow={async (templateId) => {
              const shadow = await shadowData.awardShadow(templateId);
              if (!shadow) return null;
              return { id: shadow.id, name: shadow.name };
            }}
            onAwardWeapon={async (templateId) => {
              const w = await itemsData.awardWeapon(templateId);
              if (!w) return null;
              return { id: w.id, name: w.name };
            }}
            onIncrementFloor={game.incrementBossesDefeated}
            // Boss results are already displayed inside the boss panel itself
            // (victory + extraction UI, defeat + retry button). Suppress the
            // center-screen SystemToast so it doesn't cover the panel.
            onEnqueueBossEvent={() => undefined}
          />
        )}
        {inventoryOpen && (
          <InventoryPanel
            open={inventoryOpen}
            items={itemsData.items}
            onClose={() => setInventoryOpen(false)}
            onEquip={itemsData.equipWeapon}
            onUnequip={itemsData.unequipWeapon}
            onDiscard={itemsData.discardItem}
          />
        )}
        {achOpen && (
          <AchievementsPanel open={achOpen} character={character} onClose={() => setAchOpen(false)} />
        )}
        {apiKeysOpen && (
          <ApiKeysPanel
            open={apiKeysOpen}
            uid={user.uid}
            onClose={() => setApiKeysOpen(false)}
          />
        )}
        {resetOpen && (
          <ResetAccountModal
            open={resetOpen}
            character={character}
            quests={game.quests}
            onClose={() => setResetOpen(false)}
            onConfirm={() => game.resetAccount()}
          />
        )}
      </Suspense>

      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
