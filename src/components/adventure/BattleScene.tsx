import { useEffect, useReducer, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { PixelArt, type PixelGrid, type PixelPalette } from '../PixelArt';
import {
  createBattle,
  advance,
  playerAction,
  setTactic,
  ULTIMATE_READY,
  TACTIC_LABELS,
  type PlayerConfig,
  type ShadowConfig,
  type BattleState,
  type BattleEvent,
  type PlayerAction,
  type Tactic,
} from '../../lib/battle/engine';
import { SHADOW_ROLE_LABEL } from '../../lib/shadows';
import type { EnemyDef } from '../../lib/enemies/types';
import { STATUS_DEFS, type StatusId } from '../../lib/battle/status';
import { ATB_TARGET } from '../../lib/battle/formulas';
import {
  ELEMENT_LABELS,
  ELEMENT_COLORS,
  weaknessOf,
} from '../../lib/battle/elements';

const TICK_MS = 50;

const STATUS_ICON: Record<StatusId, string> = {
  poison: '🟣', burn: '🔥', sleep: '💤', paralyze: '⚡', mark: '🎯', shield: '🛡️',
};

interface UsableItem {
  id: string;
  name: string;
  icon: string;
  count: number;
  effect: { type: 'heal'; percent: number } | { type: 'attack-boost'; multiplier: number };
}

interface Props {
  playerConfig: PlayerConfig;
  shadowConfigs: ShadowConfig[];
  enemy: EnemyDef;
  playerSprite: { grid: PixelGrid; palette: PixelPalette };
  enemySprite: { grid: PixelGrid; palette: PixelPalette };
  isLord: boolean;
  isMirror?: boolean; // ch9: enemy is a copy of the player
  items: UsableItem[];
  onUseConsumable: (id: string) => Promise<boolean>;
  onEnd: (won: boolean, turnsUsed: number) => void;
}

type Popup = { id: number; target: string; text: string; tone: 'dmg' | 'heal' | 'crit' | 'weak' | 'miss' };

export function BattleScene(props: Props) {
  const { playerConfig, shadowConfigs, enemy, playerSprite, enemySprite, isLord } = props;

  const stateRef = useRef<BattleState>(
    createBattle({ player: playerConfig, shadows: shadowConfigs, enemy })
  );
  const cfgRef = useRef(playerConfig);
  const endedRef = useRef(false);
  const popupSeq = useRef(0);
  const itemBusyRef = useRef(false);
  // ch3 fake notification tapped while it wasn't the player's turn — the
  // "wasted turn" lands on their NEXT input window instead of no-oping.
  const pendingWasteRef = useRef(false);
  const [, force] = useReducer((x) => x + 1, 0);
  const [log, setLog] = useState<string[]>(
    enemy.quotes?.open ? [enemy.quotes.open] : []
  );
  const [popups, setPopups] = useState<Popup[]>([]);
  const [menu, setMenu] = useState<'root' | 'skill' | 'item' | 'tactic' | 'flee'>('root');
  const reducedMotion = useReducedMotion();
  const [items, setItems] = useState<UsableItem[]>(props.items);
  const [shake, setShake] = useState(false);
  const [cutin, setCutin] = useState<string | null>(null);
  const [fakeNotif, setFakeNotif] = useState(false);
  const [uiAsleep, setUiAsleep] = useState(false);
  const [enemyFlash, setEnemyFlash] = useState(false);
  const [critFlash, setCritFlash] = useState(false);

  const ingest = (events: BattleEvent[]) => {
    const newLogs: string[] = [];
    const newPopups: Popup[] = [];
    for (const e of events) {
      switch (e.type) {
        case 'log':
          newLogs.push(e.text);
          break;
        case 'damage': {
          const tone: Popup['tone'] = e.crit ? 'crit' : e.weak ? 'weak' : 'dmg';
          newPopups.push({ id: popupSeq.current++, target: e.target, text: `${e.amount}${e.weak ? ' 弱点!' : ''}`, tone });
          if (e.target === 'player' && e.amount > 0) setShake(true);
          if (e.target === 'enemy' && e.amount > 0) setEnemyFlash(true);
          if (e.crit) setCritFlash(true);
          break;
        }
        case 'heal':
          newPopups.push({ id: popupSeq.current++, target: e.target, text: `+${e.amount}`, tone: 'heal' });
          break;
        case 'miss':
          newPopups.push({ id: popupSeq.current++, target: e.target, text: 'MISS', tone: 'miss' });
          break;
        case 'break':
          newLogs.push('やぶれかぶれ! ブレイク!');
          break;
        case 'ultimate':
          setCutin(cfgRef.current.ultimateName);
          break;
        case 'revive':
          // The feather is a held consumable — burn it now that it fired.
          props.onUseConsumable('phoenix-feather').catch((err) =>
            console.error('[battle] feather consume failed', err)
          );
          break;
        case 'fx':
          if (e.fx === 'fakeNotification') setFakeNotif(true);
          if (e.fx === 'uiSleep') setUiAsleep(true);
          break;
        default:
          break;
      }
    }
    if (newLogs.length) setLog((prev) => [...prev, ...newLogs].slice(-4));
    if (newPopups.length) {
      setPopups((prev) => [...prev, ...newPopups]);
      newPopups.forEach((p) =>
        setTimeout(() => setPopups((cur) => cur.filter((x) => x.id !== p.id)), 800)
      );
    }
  };

  // Main ATB loop.
  useEffect(() => {
    const timer = setInterval(() => {
      const s = stateRef.current;
      if (s.phase !== 'ticking') return;
      const r = advance(s, 1, cfgRef.current);
      stateRef.current = r.state;
      if (r.events.length) ingest(r.events);
      // A fake-notification tap outside the player's turn burns the next one.
      if (r.state.phase === 'awaiting-input' && pendingWasteRef.current) {
        pendingWasteRef.current = false;
        const w = playerAction(r.state, { kind: 'wait' }, cfgRef.current);
        stateRef.current = w.state;
        ingest(w.events);
      }
      if (r.state.phase === 'won' || r.state.phase === 'lost') {
        if (!endedRef.current) {
          endedRef.current = true;
          setTimeout(() => props.onEnd(r.state.phase === 'won', r.state.turnNumber), 1100);
        }
      }
      force();
    }, TICK_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!shake) return;
    const t = setTimeout(() => setShake(false), 260);
    return () => clearTimeout(t);
  }, [shake]);
  useEffect(() => { if (!enemyFlash) return; const t = setTimeout(() => setEnemyFlash(false), 140); return () => clearTimeout(t); }, [enemyFlash]);
  useEffect(() => { if (!critFlash) return; const t = setTimeout(() => setCritFlash(false), 170); return () => clearTimeout(t); }, [critFlash]);
  useEffect(() => { if (!cutin) return; const t = setTimeout(() => setCutin(null), 1000); return () => clearTimeout(t); }, [cutin]);
  useEffect(() => { if (!fakeNotif) return; const t = setTimeout(() => setFakeNotif(false), 2800); return () => clearTimeout(t); }, [fakeNotif]);
  useEffect(() => { if (!uiAsleep) return; const t = setTimeout(() => setUiAsleep(false), 2500); return () => clearTimeout(t); }, [uiAsleep]);

  const act = (action: PlayerAction) => {
    const s = stateRef.current;
    if (s.phase !== 'awaiting-input') return;
    const r = playerAction(s, action, cfgRef.current);
    stateRef.current = r.state;
    ingest(r.events);
    setMenu('root');
    if (r.state.phase === 'won' || r.state.phase === 'lost') {
      if (!endedRef.current) {
        endedRef.current = true;
        setTimeout(() => props.onEnd(r.state.phase === 'won', r.state.turnNumber), 1100);
      }
    }
    force();
  };

  const useItem = async (item: UsableItem) => {
    // In-flight guard: a double-tap while the consumable write is pending
    // would decrement inventory twice for one battle effect.
    if (item.count <= 0 || itemBusyRef.current) return;
    itemBusyRef.current = true;
    try {
      const ok = await props.onUseConsumable(item.id);
      if (!ok) return;
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, count: i.count - 1 } : i)));
      act({ kind: 'item', effect: item.effect });
    } finally {
      itemBusyRef.current = false;
    }
  };

  // Switch party tactic — costs no turn, so we stay on the player's input.
  const chooseTactic = (t: Tactic) => {
    stateRef.current = setTactic(stateRef.current, t);
    setMenu('root');
    force();
  };

  // Forfeit the battle (counts as a loss; spent Will is not returned). The
  // only sanctioned way out of a fight — without it a mistaken lord entry is
  // a hard dead-end.
  const flee = () => {
    if (endedRef.current) return;
    endedRef.current = true;
    props.onEnd(false, stateRef.current.turnNumber);
  };

  const s = stateRef.current;
  const enemyHpPct = Math.max(0, (s.enemy.hp / s.enemy.maxHp) * 100);
  const playerHpPct = Math.max(0, (s.player.hp / s.player.maxHp) * 100);
  // Read the LIVE actor element, not the static def: the mirror gimmick swaps
  // the enemy's element to the player's at battle setup, and the engine's
  // affinity/break math runs on the live value — the badge must match it.
  const liveElement = s.enemy.element;
  const weak = weaknessOf(liveElement);
  const awaiting = s.phase === 'awaiting-input';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${enemy.name} とのたたかい`}
      className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-gradient-to-b from-[#101a33] to-[#04070f]"
    >
      {/* crit screen flash — suppressed for prefers-reduced-motion
          (full-screen white flashes are a photosensitivity risk) */}
      <AnimatePresence>
        {critFlash && !reducedMotion && (
          <motion.div key="crit" initial={{ opacity: 0.5 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.17 }} className="pointer-events-none absolute inset-0 z-[70] bg-white" />
        )}
      </AnimatePresence>

      {/* ultimate cut-in */}
      <AnimatePresence>
        {cutin && (
          <motion.div key="cutin" initial={{ x: '-110%' }} animate={{ x: '0%' }} exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 22 }}
            className="pointer-events-none absolute inset-x-0 top-1/3 z-[71] flex items-center gap-2 border-y-2 border-sys-accent bg-[#0a0f1c]/90 px-4 py-3">
            <span className="text-2xl">✦</span>
            <span className="text-lg font-black text-sys-accent drop-shadow">{cutin}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* UI-sleep (ch12) drifting zzz */}
      {uiAsleep && (
        <div className="pointer-events-none absolute inset-0 z-[68] bg-[#04070f]/30">
          {['z', 'z', 'z'].map((z, i) => (
            <motion.span key={i} initial={{ opacity: 0, y: 0 }} animate={{ opacity: [0, 1, 0], y: -40 }}
              transition={{ duration: 2.2, delay: i * 0.3, repeat: Infinity }}
              className="absolute text-2xl font-black text-sky-200/70" style={{ left: `${30 + i * 12}%`, top: `${45 + i * 5}%` }}>
              {z.toUpperCase()}zz…
            </motion.span>
          ))}
        </div>
      )}

      {/* fake notification (ch3) — tap wastes a turn, ignore it to win */}
      <AnimatePresence>
        {fakeNotif && (
          <motion.button
            key="notif" type="button"
            initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }}
            onClick={() => {
              // Tapping the trap costs a turn: immediately if it's the
              // player's turn, otherwise their next one (pendingWasteRef).
              if (stateRef.current.phase === 'awaiting-input') act({ kind: 'wait' });
              else pendingWasteRef.current = true;
              setFakeNotif(false);
            }}
            className="absolute inset-x-3 top-3 z-[72] flex items-center gap-3 rounded-xl border border-white/20 bg-[#1c1c22]/95 p-3 text-left shadow-lg"
          >
            <span className="text-xl">🔔</span>
            <span className="min-w-0">
              <span className="block text-xs font-bold text-white">おしらせ</span>
              <span className="block truncate text-[11px] text-white/70">タップして つづきを みる →(ワナ!)</span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Enemy stage */}
      <motion.div
        className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-2 pt-6"
        animate={shake && !reducedMotion ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.26 }}
      >
        {s.enemy.charged && (
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 0.6 }}
            className="absolute top-3 text-2xl font-black text-rose-400"
          >
            ！ためている！
          </motion.div>
        )}
        <div className="relative">
          <motion.div
            animate={{ y: [0, -3, 0] }}
            transition={{ repeat: Infinity, duration: 1.6 }}
            style={{
              opacity: s.enemy.alive ? 1 : 0.25,
              filter: enemyFlash
                ? 'brightness(3) saturate(0)'
                : s.enemy.break.broken ? 'brightness(1.4) saturate(1.4)' : 'none',
            }}
          >
            <PixelArt
              layers={[enemySprite]}
              pixelSize={isLord ? 12 : 9}
              ariaLabel={enemy.name}
            />
          </motion.div>
          <PopupLayer popups={popups.filter((p) => p.target === 'enemy')} />
        </div>

        <div className="w-full max-w-sm px-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-sys-text">
              {enemy.name}{props.isMirror && <span className="ml-1 text-[10px] text-sys-muted">(あなたの コピー)</span>}
            </span>
            <span className="flex items-center gap-1">
              <ElementBadge element={liveElement} />
              <span className="text-[10px] text-sys-muted">
                弱点 <span style={{ color: ELEMENT_COLORS[weak] }}>{ELEMENT_LABELS[weak].kanji}</span>
              </span>
            </span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-sm border border-sys-border/60 bg-black/40">
            <motion.div
              className="h-full bg-gradient-to-r from-rose-500 to-red-400"
              animate={{ width: `${enemyHpPct}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          {s.enemy.break.max > 0 && (
            <div className="mt-1 flex items-center gap-1">
              <span className="text-[9px] uppercase tracking-wider text-sys-muted">BREAK</span>
              {Array.from({ length: s.enemy.break.max }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-3 rounded-sm ${
                    i < s.enemy.break.current ? 'bg-amber-400' : 'bg-sys-border/40'
                  }`}
                />
              ))}
              {s.enemy.break.broken && <span className="text-[9px] text-amber-300">くずれ中!</span>}
            </div>
          )}
          <StatusChips statuses={s.enemy.statuses.map((x) => x.id)} />
        </div>
      </motion.div>

      {/* Battle log */}
      <div className="mx-auto min-h-[3.2rem] w-full max-w-sm px-4">
        <div aria-live="polite" className="rounded-sm border border-sys-border/40 bg-black/40 px-3 py-1.5">
          {log.slice(-2).map((line, i) => (
            <p key={`${line}-${i}`} className="text-[11px] leading-snug text-sys-text">
              {line}
            </p>
          ))}
          {log.length === 0 && <p className="text-[11px] text-sys-muted">たたかい かいし!</p>}
        </div>
      </div>

      {/* Party strip */}
      <div className="mx-auto w-full max-w-sm px-4 py-2">
        <div className="relative flex items-center gap-2 rounded-sm border border-sys-border/50 bg-black/30 p-2">
          <div className="shrink-0">
            <PixelArt layers={[playerSprite]} pixelSize={4} ariaLabel={s.player.name} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex justify-between text-[11px]">
              <span className="truncate font-bold text-sys-text">{s.player.name}</span>
              <span className="text-sys-muted">{s.player.hp}/{s.player.maxHp}</span>
            </div>
            <Bar pct={playerHpPct} className="from-emerald-500 to-green-400" />
            <div className="mt-1 flex items-center gap-1">
              <span className="w-7 text-[10px] text-sys-muted">奥義</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-black/40">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-sky-300"
                  style={{ width: `${(s.ultimate / ULTIMATE_READY) * 100}%` }}
                />
              </div>
            </div>
            <div className="mt-0.5 flex items-center gap-1">
              <span className="w-7 text-[10px] text-sys-muted">行動</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-black/40">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-300"
                  style={{ width: `${Math.min(100, (s.player.atb / ATB_TARGET) * 100)}%` }}
                />
              </div>
            </div>
            <StatusChips statuses={s.player.statuses.map((x) => x.id)} />
          </div>
          <PopupLayer popups={popups.filter((p) => p.target === 'player')} />
        </div>
        {s.shadows.length > 0 && (
          <div className="mt-1 space-y-1">
            <div className="flex flex-wrap gap-1">
              {s.shadows.map((sh) => (
                <span key={sh.key} className="rounded-sm border border-sys-border/40 bg-black/20 px-1.5 py-0.5 text-[9px] text-sys-muted">
                  🩶 {sh.name} <span className="text-sys-accent/70">{SHADOW_ROLE_LABEL[sh.role]}</span>
                </span>
              ))}
            </div>
            <div className="text-[9px] text-sys-muted">作戦:<span className="text-sys-text/80">{TACTIC_LABELS[s.tactic]}</span></div>
          </div>
        )}
      </div>

      {/* Command deck */}
      <div className="mx-auto w-full max-w-sm px-4 pb-6" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}>
        {s.phase === 'won' && <EndBanner text="しょうり!" tone="win" />}
        {s.phase === 'lost' && <EndBanner text="ぜんめつ…" tone="lose" />}
        {awaiting && menu === 'root' && (
          <div className="grid grid-cols-3 gap-2">
            <Cmd label="たたかう" onClick={() => act({ kind: 'attack' })} />
            <Cmd label="スキル" onClick={() => setMenu('skill')} />
            <Cmd label="ぼうぎょ" onClick={() => act({ kind: 'guard' })} />
            <Cmd label="どうぐ" onClick={() => setMenu('item')} />
            <Cmd
              label="おくぎ"
              highlight={s.ultimate >= ULTIMATE_READY}
              disabled={s.ultimate < ULTIMATE_READY}
              onClick={() => act({ kind: 'ultimate' })}
            />
            {s.shadows.length > 0 && <Cmd label="さくせん" onClick={() => setMenu('tactic')} />}
            <Cmd label="にげる" onClick={() => setMenu('flee')} />
          </div>
        )}
        {awaiting && menu === 'flee' && (
          <div className="space-y-2">
            <p className="text-center text-[12px] text-sys-text">
              にげますか? つかった戦意は もどりません。
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Cmd label="にげる" onClick={flee} />
              <Cmd label="たたかいつづける" onClick={() => setMenu('root')} />
            </div>
          </div>
        )}
        {awaiting && menu === 'tactic' && (
          <div className="grid grid-cols-1 gap-2">
            {(Object.keys(TACTIC_LABELS) as Tactic[]).map((t) => (
              <Cmd key={t} label={`${s.tactic === t ? '▶ ' : ''}${TACTIC_LABELS[t]}`} highlight={s.tactic === t} onClick={() => chooseTactic(t)} />
            ))}
            <Cmd label="← もどる" onClick={() => setMenu('root')} />
          </div>
        )}
        {awaiting && menu === 'skill' && (
          <div className="grid grid-cols-2 gap-2">
            {cfgRef.current.skills.map((sk) => {
              const cd = s.player.cooldowns[sk.id] ?? 0;
              return (
                <Cmd
                  key={sk.id}
                  label={`${sk.name}${cd > 0 ? ` (${cd})` : ''}`}
                  disabled={cd > 0}
                  onClick={() => act({ kind: 'skill', skillId: sk.id })}
                />
              );
            })}
            <Cmd label="← もどる" onClick={() => setMenu('root')} />
          </div>
        )}
        {awaiting && menu === 'item' && (
          <div className="grid grid-cols-2 gap-2">
            {items.filter((i) => i.count > 0).map((it) => (
              <Cmd key={it.id} label={`${it.icon}${it.name}×${it.count}`} onClick={() => void useItem(it)} />
            ))}
            {items.filter((i) => i.count > 0).length === 0 && (
              <span className="col-span-2 text-center text-[11px] text-sys-muted">どうぐが ない</span>
            )}
            <Cmd label="← もどる" onClick={() => setMenu('root')} />
          </div>
        )}
        {!awaiting && s.phase === 'ticking' && (
          <p className="text-center text-[11px] text-sys-muted">じゅんびちゅう…</p>
        )}
      </div>
    </div>
  );
}

function Bar({ pct, className }: { pct: number; className: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-sm border border-sys-border/50 bg-black/40">
      <motion.div className={`h-full bg-gradient-to-r ${className}`} animate={{ width: `${pct}%` }} transition={{ duration: 0.3 }} />
    </div>
  );
}

function Cmd({ label, onClick, disabled, highlight }: { label: string; onClick: () => void; disabled?: boolean; highlight?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      // min-h-11 ≈ 44px: commands are tapped rapidly under time pressure.
      className={`sys-button min-h-11 py-2.5 text-xs ${highlight ? 'sys-button-gold' : ''} ${disabled ? 'opacity-40' : ''}`}
    >
      {label}
    </button>
  );
}

function ElementBadge({ element }: { element: keyof typeof ELEMENT_LABELS }) {
  return (
    <span
      className="rounded-sm px-1 text-[10px] font-bold text-black"
      style={{ backgroundColor: ELEMENT_COLORS[element] }}
    >
      {ELEMENT_LABELS[element].kanji}
    </span>
  );
}

function StatusChips({ statuses }: { statuses: StatusId[] }) {
  if (statuses.length === 0) return null;
  const seen = new Set<StatusId>();
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {statuses.filter((s) => (seen.has(s) ? false : (seen.add(s), true))).map((s) => (
        <span
          key={s}
          className="rounded-sm bg-black/30 px-1 text-[10px] text-sys-text"
          title={STATUS_DEFS[s].jp}
          aria-label={STATUS_DEFS[s].jp}
        >
          {STATUS_ICON[s]}
          <span className="ml-0.5">{STATUS_DEFS[s].jp}</span>
        </span>
      ))}
    </div>
  );
}

function PopupLayer({ popups }: { popups: Popup[] }) {
  const color: Record<Popup['tone'], string> = {
    dmg: 'text-white', crit: 'text-amber-300', weak: 'text-rose-300', heal: 'text-emerald-300', miss: 'text-sys-muted',
  };
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <AnimatePresence>
        {popups.map((p) => (
          <motion.span
            key={p.id}
            initial={{ opacity: 0, y: 0, scale: 0.8 }}
            animate={{ opacity: 1, y: -28, scale: p.tone === 'crit' ? 1.4 : 1.1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className={`absolute text-lg font-black drop-shadow ${color[p.tone]}`}
          >
            {p.text}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

function EndBanner({ text, tone }: { text: string; tone: 'win' | 'lose' }) {
  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`rounded-md border-2 py-3 text-center text-lg font-black ${
        tone === 'win' ? 'border-amber-400 text-amber-300' : 'border-rose-500 text-rose-300'
      }`}
    >
      {text}
    </motion.div>
  );
}
