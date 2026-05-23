import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Swords, Heart, Zap, Sparkles } from 'lucide-react';
import { SystemWindow } from './SystemWindow';
import { PixelArt } from './PixelArt';
import {
  ATB_TARGET,
  EXTRACTION_ATTEMPTS_PER_WIN,
  bossAtbSpeed,
  computeBossAttack,
  computePlayerAttack,
  currentFloor,
  extractionChance,
  pickBossByFloor,
  playerAtbSpeed,
  playerMaxHp,
  rollExtraction,
  scaledBossAttack,
  scaledBossHp,
} from '../lib/boss';
import type { BossDef } from '../lib/boss';
import { BOSS_SPRITES, FALLBACK_BOSS_SPRITE } from '../lib/bossSprites';
import {
  effectiveEquippedSkills,
  getSkill,
} from '../lib/battleSkills';
import type { BattleSkill } from '../lib/battleSkills';
import {
  DEFAULT_APPEARANCE,
  renderClassSprite,
} from '../lib/playerSprites';
import { addBossAttempt } from '../lib/firestore';
import { RARITY_LABEL, SHADOW_TEMPLATES } from '../lib/shadows';
import type { Character, ShadowRarity, StatKey } from '../types';
import { STAT_LABELS } from '../types';
import { todayKey } from '../lib/leveling';

interface Props {
  open: boolean;
  uid: string;
  character: Character;
  shadowBonus: Record<StatKey, number>;
  onClose: () => void;
  onAwardShadow: (templateId: string) => Promise<{ id: string; name: string } | null>;
  onIncrementFloor: () => Promise<void>;
  onEnqueueBossEvent: (args: {
    bossName: string;
    won: boolean;
    floor: number;
    extractedCount?: number;
  }) => void;
}

interface BattleLog {
  id: string;
  text: string;
  tone?: 'weak' | 'resist' | 'crit' | 'dodge' | 'heal' | 'system' | 'boss';
}

type Phase =
  | 'ready'
  | 'fighting'
  | 'player-turn'
  | 'boss-acting'
  | 'won'
  | 'lost';

const TICK_MS = 50;

export function DailyBossPanel({
  open,
  uid,
  character,
  shadowBonus,
  onClose,
  onAwardShadow,
  onIncrementFloor,
  onEnqueueBossEvent,
}: Props) {
  const today = todayKey();
  const floor = currentFloor(character);
  const rawBoss = useMemo<BossDef>(() => pickBossByFloor(floor), [floor]);
  // Pre-scale the boss's attack value with the floor so the rest of the
  // combat code can ignore floor-specific logic.
  const boss = useMemo<BossDef>(
    () => ({ ...rawBoss, attack: scaledBossAttack(rawBoss, floor) }),
    [rawBoss, floor]
  );

  const effective = useMemo<Record<StatKey, number>>(() => {
    const out = { ...character.stats };
    (Object.keys(out) as StatKey[]).forEach((k) => {
      out[k] = (out[k] ?? 0) + (shadowBonus[k] ?? 0);
    });
    return out;
  }, [character.stats, shadowBonus]);

  const maxBossHp = useMemo(
    () => scaledBossHp(boss, character.level, floor),
    [boss, character.level, floor]
  );
  const maxPlayerHp = useMemo(
    () => playerMaxHp(effective, character.level),
    [effective, character.level]
  );

  const [phase, setPhase] = useState<Phase>('ready');
  const [bossHp, setBossHp] = useState(maxBossHp);
  const [playerHp, setPlayerHp] = useState(maxPlayerHp);
  const [playerAtb, setPlayerAtb] = useState(0);
  const [bossAtb, setBossAtb] = useState(0);
  const [turn, setTurn] = useState(0);
  const [log, setLog] = useState<BattleLog[]>([]);
  const [damageBurst, setDamageBurst] = useState<{
    key: number;
    value: number;
    target: 'boss' | 'player';
    tone: 'weak' | 'resist' | 'crit' | 'dodge' | 'heal' | 'normal';
  } | null>(null);

  // Per-skill cooldown counters. Decrement on each player action; the just-
  // used skill is set to its full cooldown the same turn.
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});

  // Post-victory shadow extraction state.
  interface ExtractionResultUI {
    id: number;
    success: boolean;
    rarity?: ShadowRarity;
    shadowName?: string;
  }
  const [extractionsLeft, setExtractionsLeft] = useState(EXTRACTION_ATTEMPTS_PER_WIN);
  const [extractionResults, setExtractionResults] = useState<ExtractionResultUI[]>([]);
  const [extractionBusy, setExtractionBusy] = useState(false);

  // Stop the ATB ticker when we're not actively in a fight.
  const intervalRef = useRef<number | null>(null);
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;

  const playerSprite = useMemo(() => {
    const a = character.appearance ?? DEFAULT_APPEARANCE;
    return renderClassSprite(a.hunterClass, a.primaryColor, a.accentColor);
  }, [character.appearance]);

  const bossSprite = BOSS_SPRITES[boss.id] ?? FALLBACK_BOSS_SPRITE;

  // Equipped skill objects in display order. Falls back to base 5 for
  // characters that haven't opened the loadout panel yet.
  const equippedSkills = useMemo<BattleSkill[]>(() => {
    return effectiveEquippedSkills(character)
      .map((id) => getSkill(id))
      .filter((s): s is BattleSkill => !!s);
  }, [character]);

  // Reset combat state whenever the panel opens or the floor changes
  // (after a win the floor counter advances, which retriggers this).
  useEffect(() => {
    if (!open) return;
    setPhase('ready');
    setBossHp(maxBossHp);
    setPlayerHp(maxPlayerHp);
    setPlayerAtb(0);
    setBossAtb(0);
    setTurn(0);
    setLog([]);
    setDamageBurst(null);
    setCooldowns({});
    setExtractionsLeft(EXTRACTION_ATTEMPTS_PER_WIN);
    setExtractionResults([]);
    setExtractionBusy(false);
  }, [open, floor, maxBossHp, maxPlayerHp]);

  // ATB ticker — runs continuously while in a battle phase. Stops as soon as
  // someone gets a turn so the UI can wait for input (or animate the boss).
  useEffect(() => {
    if (!open) return;
    if (phase !== 'fighting') return;
    const pSpeed = playerAtbSpeed(effective);
    const bSpeed = bossAtbSpeed(boss);
    intervalRef.current = window.setInterval(() => {
      setPlayerAtb((prev) => {
        const next = prev + pSpeed;
        if (next >= ATB_TARGET) {
          setPhase('player-turn');
          return ATB_TARGET;
        }
        return next;
      });
      setBossAtb((prev) => {
        const next = prev + bSpeed;
        if (next >= ATB_TARGET) {
          setPhase('boss-acting');
          return ATB_TARGET;
        }
        return next;
      });
    }, TICK_MS);
    return () => {
      if (intervalRef.current != null) window.clearInterval(intervalRef.current);
    };
  }, [open, phase, effective, boss]);

  // Boss attack auto-resolves when boss's ATB fills.
  useEffect(() => {
    if (phase !== 'boss-acting') return;
    const t = window.setTimeout(() => {
      const result = computeBossAttack({
        boss,
        playerLevel: character.level,
        effective,
      });
      if (result.dodged) {
        setLog((prev) => [
          ...prev,
          {
            id: `boss-miss-${Date.now()}`,
            text: `${boss.name} の攻撃を回避!`,
            tone: 'dodge',
          },
        ]);
        setDamageBurst({
          key: Date.now(),
          value: 0,
          target: 'player',
          tone: 'dodge',
        });
      } else {
        const nextHp = Math.max(0, playerHp - result.damage);
        setPlayerHp(nextHp);
        setLog((prev) => [
          ...prev,
          {
            id: `boss-${Date.now()}`,
            text: `${boss.name} の攻撃 → ${result.damage} ダメージ${
              result.crit ? ' [クリティカル!]' : ''
            }`,
            tone: result.crit ? 'crit' : 'boss',
          },
        ]);
        setDamageBurst({
          key: Date.now(),
          value: result.damage,
          target: 'player',
          tone: result.crit ? 'crit' : 'normal',
        });
        if (nextHp === 0) {
          void finalize(false, turn);
          return;
        }
      }
      setBossAtb(0);
      setPhase('fighting');
    }, 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const startBattle = () => {
    setPhase('fighting');
  };

  const performSkill = (skill: BattleSkill) => {
    if (phase !== 'player-turn') return;
    if ((cooldowns[skill.id] ?? 0) > 0) return; // belt-and-braces, button is disabled
    const nextTurn = turn + 1;
    setTurn(nextTurn);
    setPlayerAtb(0);

    // Tick cooldowns down by 1 for every skill, then set this one to its
    // full cooldown. Filter zeroes out so the map doesn't grow forever.
    setCooldowns((prev) => {
      const next: Record<string, number> = {};
      for (const id in prev) {
        const remaining = Math.max(0, (prev[id] ?? 0) - 1);
        if (remaining > 0) next[id] = remaining;
      }
      if (skill.cooldown > 0) next[skill.id] = skill.cooldown;
      return next;
    });

    if (skill.effect.kind === 'heal') {
      const healAmount = Math.round(maxPlayerHp * skill.effect.healPct);
      const nextHp = Math.min(maxPlayerHp, playerHp + healAmount);
      const restored = nextHp - playerHp;
      setPlayerHp(nextHp);
      setDamageBurst({
        key: Date.now(),
        value: restored,
        target: 'player',
        tone: 'heal',
      });
      setLog((prev) => [
        ...prev,
        {
          id: `p-${nextTurn}-${Date.now()}`,
          text: `${skill.name} → HP +${restored} 回復`,
          tone: 'heal',
        },
      ]);
      setPhase('fighting');
      return;
    }

    // Attack skill
    const result = computePlayerAttack({
      stat: skill.effect.stat,
      damageMultiplier: skill.effect.damageMultiplier,
      effective,
      boss,
      guaranteedCrit: skill.effect.guaranteedCrit,
      critBonusFlat: skill.effect.critBonusFlat,
    });
    const nextBossHp = Math.max(0, bossHp - result.damage);
    setBossHp(nextBossHp);
    setDamageBurst({
      key: Date.now(),
      value: result.damage,
      target: 'boss',
      tone: result.crit ? 'crit' : result.isWeak ? 'weak' : result.isResist ? 'resist' : 'normal',
    });
    setLog((prev) => [
      ...prev,
      {
        id: `p-${nextTurn}-${Date.now()}`,
        text: `${skill.name} (${skill.effect.kind === 'attack' ? skill.effect.stat : ''}) → ${result.damage} ダメージ${
          result.crit ? ' [クリティカル!]' : result.isWeak ? ' [弱点!]' : result.isResist ? ' [軽減]' : ''
        }`,
        tone: result.crit ? 'crit' : result.isWeak ? 'weak' : result.isResist ? 'resist' : undefined,
      },
    ]);
    if (nextBossHp === 0) {
      void finalize(true, nextTurn);
    } else {
      setPhase('fighting');
    }
  };

  const finalize = async (won: boolean, turnsUsed: number) => {
    setPhase(won ? 'won' : 'lost');
    setLog((prev) => [
      ...prev,
      {
        id: `final-${Date.now()}`,
        text: won
          ? `Floor ${floor} の ${boss.name} を撃破!`
          : `${boss.name} に敗北…`,
        tone: 'system',
      },
    ]);

    try {
      await addBossAttempt({
        uid,
        date: today,
        bossId: boss.id,
        won,
        turnsUsed,
        damageDealt: maxBossHp - bossHp,
        createdAt: Date.now(),
      });
    } catch (err) {
      console.error('[boss] log attempt failed', err);
    }

    if (won) {
      // No EXP/stat reward — daily quest progression is the only path for
      // character growth. Boss kills give shadow-extraction attempts only.
      onEnqueueBossEvent({
        bossName: boss.name,
        won: true,
        floor,
      });
      // Stay on the 'won' screen until the user uses up (or skips) the
      // extraction attempts and clicks 次の階層へ.
    } else {
      onEnqueueBossEvent({
        bossName: boss.name,
        won: false,
        floor,
      });
    }
  };

  // ── Extraction ──
  const extractInput = useMemo(
    () => ({
      playerLevel: character.level,
      perception: effective.PER ?? 0,
      intelligence: effective.INT ?? 0,
      floor,
      bossHpScaled: maxBossHp,
    }),
    [character.level, effective.PER, effective.INT, floor, maxBossHp]
  );
  const baseExtractionChance = useMemo(
    () => extractionChance(extractInput),
    [extractInput]
  );

  const handleExtract = async () => {
    if (extractionsLeft <= 0 || extractionBusy) return;
    setExtractionBusy(true);
    try {
      const roll = rollExtraction(extractInput);
      let shadowName: string | undefined;
      if (roll.success) {
        const template = SHADOW_TEMPLATES.find(
          (t) => t.stat === roll.stat && t.rarity === roll.rarity
        );
        if (template) {
          try {
            const created = await onAwardShadow(template.id);
            shadowName = created?.name ?? template.name;
          } catch (err) {
            console.error('[extract] award failed', err);
          }
        }
      }
      const id = Date.now();
      setExtractionResults((prev) => [
        ...prev,
        {
          id,
          success: roll.success,
          rarity: roll.success ? roll.rarity : undefined,
          shadowName,
        },
      ]);
      // Only one successful extraction allowed per boss kill — a success
      // burns the remaining attempts. Failures just decrement.
      setExtractionsLeft((n) => (roll.success ? 0 : n - 1));
    } finally {
      setExtractionBusy(false);
    }
  };

  // Manual retry after a loss — just resets combat state for the same floor.
  const retry = () => {
    setPhase('ready');
    setBossHp(maxBossHp);
    setPlayerHp(maxPlayerHp);
    setPlayerAtb(0);
    setBossAtb(0);
    setTurn(0);
    setLog([]);
    setDamageBurst(null);
  };

  if (!open) return null;

  const bossHpPct = (bossHp / maxBossHp) * 100;
  const playerHpPct = (playerHp / maxPlayerHp) * 100;
  const playerAtbPct = (playerAtb / ATB_TARGET) * 100;
  const bossAtbPct = (bossAtb / ATB_TARGET) * 100;

  const battleActive =
    phase === 'fighting' ||
    phase === 'player-turn' ||
    phase === 'boss-acting' ||
    phase === 'won' ||
    phase === 'lost';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div className="w-full max-w-2xl my-auto" onClick={(e) => e.stopPropagation()}>
        <SystemWindow title="Daily Boss" subtitle="gate">
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sys-muted hover:text-sys-text"
              aria-label="閉じる"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {(
            <div className="space-y-4">
              {/* Floor indicator */}
              <div className="flex items-center justify-between border border-sys-border/30 bg-black/30 px-3 py-2">
                <p className="text-[10px] uppercase tracking-widest text-sys-muted">
                  Tower Floor
                </p>
                <p className="font-mono text-xl text-sys-accent">
                  #{floor}
                </p>
              </div>

              {/* Boss banner */}
              <div className="relative border border-sys-border/40 bg-black/40 px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 border border-sys-border/40 bg-black/60 p-1">
                    <PixelArt
                      layers={[{ grid: bossSprite.grid, palette: bossSprite.palette }]}
                      pixelSize={5}
                      ariaLabel={`ボス ${boss.name}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-widest text-sys-muted">
                      本日のボス
                    </p>
                    <p className="mt-0.5 text-lg font-black tracking-wider text-sys-text">
                      {boss.name}
                    </p>
                    <p className="mt-1 text-xs text-sys-muted">{boss.flavor}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-widest font-mono">
                      <span className="text-sys-gold">弱点 {boss.weak}</span>
                      <span className="text-sys-muted"> / </span>
                      <span className="text-sys-danger">耐性 {boss.resist}</span>
                    </p>
                  </div>
                </div>

                {/* Boss HP + ATB */}
                <div className="mt-3 space-y-1.5">
                  <HpBar
                    label="HP"
                    icon="enemy"
                    value={bossHp}
                    max={maxBossHp}
                    pct={bossHpPct}
                    color="danger"
                  />
                  <AtbBar pct={bossAtbPct} side="boss" />
                </div>

                <AnimatePresence>
                  {damageBurst && damageBurst.target === 'boss' && (
                    <motion.div
                      key={damageBurst.key}
                      initial={{ opacity: 0, y: 0, scale: 0.7 }}
                      animate={{ opacity: 1, y: -20, scale: 1.2 }}
                      exit={{ opacity: 0, y: -40 }}
                      transition={{ duration: 0.6 }}
                      onAnimationComplete={() => setDamageBurst(null)}
                      className={`pointer-events-none absolute left-20 top-3 font-black ${
                        damageBurst.tone === 'crit'
                          ? 'text-amber-300 drop-shadow-[0_0_10px_rgba(255,215,0,0.8)] text-3xl'
                          : damageBurst.tone === 'weak'
                          ? 'text-sys-gold text-2xl'
                          : damageBurst.tone === 'resist'
                          ? 'text-sys-muted text-xl'
                          : 'text-sys-accent text-2xl'
                      }`}
                    >
                      -{damageBurst.value}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Player banner */}
              <div className="relative border border-sys-border/40 bg-black/40 px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 border border-sys-border/40 bg-black/60 p-1">
                    <PixelArt
                      layers={[
                        { grid: playerSprite.grid, palette: playerSprite.palette },
                      ]}
                      pixelSize={5}
                      ariaLabel={`プレイヤー ${character.name}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-widest text-sys-muted">
                      ハンター
                    </p>
                    <p className="mt-0.5 text-lg font-black tracking-wider text-sys-text">
                      {character.name}
                    </p>
                    <p className="mt-1 text-[10px] text-sys-muted">
                      Lv.{character.level} · 行動 {turn} 回
                    </p>
                    <div className="mt-2 grid grid-cols-5 gap-1 text-center">
                      {(Object.keys(effective) as StatKey[]).map((k) => (
                        <div key={k} className="border border-sys-border/30 px-1 py-0.5">
                          <div className="text-[8px] uppercase tracking-widest text-sys-muted">
                            {STAT_LABELS[k].en}
                          </div>
                          <div className="font-mono text-[10px] text-sys-text">
                            {effective[k]}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  <HpBar
                    label="HP"
                    icon="player"
                    value={playerHp}
                    max={maxPlayerHp}
                    pct={playerHpPct}
                    color="ok"
                  />
                  <AtbBar pct={playerAtbPct} side="player" />
                </div>

                <AnimatePresence>
                  {damageBurst && damageBurst.target === 'player' && (
                    <motion.div
                      key={damageBurst.key}
                      initial={{ opacity: 0, y: 0, scale: 0.7 }}
                      animate={{ opacity: 1, y: -20, scale: 1.2 }}
                      exit={{ opacity: 0, y: -40 }}
                      transition={{ duration: 0.6 }}
                      onAnimationComplete={() => setDamageBurst(null)}
                      className={`pointer-events-none absolute left-20 top-3 font-black ${
                        damageBurst.tone === 'dodge'
                          ? 'text-sys-accent text-xl'
                          : damageBurst.tone === 'heal'
                          ? 'text-sys-ok drop-shadow-[0_0_8px_rgba(34,197,94,0.7)] text-2xl'
                          : damageBurst.tone === 'crit'
                          ? 'text-rose-300 drop-shadow-[0_0_8px_rgba(244,114,182,0.8)] text-3xl'
                          : 'text-sys-danger text-2xl'
                      }`}
                    >
                      {damageBurst.tone === 'dodge'
                        ? 'MISS'
                        : damageBurst.tone === 'heal'
                        ? `+${damageBurst.value}`
                        : `-${damageBurst.value}`}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Phase controls */}
              {phase === 'ready' && (
                <button
                  type="button"
                  onClick={startBattle}
                  className="sys-button w-full justify-center"
                >
                  <Swords className="h-4 w-4" />
                  Floor {floor} に挑戦
                </button>
              )}

              {battleActive && (
                <>
                  <div className={`grid gap-2 ${equippedSkills.length >= 4 ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3'}`}>
                    {equippedSkills.map((skill) => {
                      const cd = cooldowns[skill.id] ?? 0;
                      const canAct = phase === 'player-turn' && cd === 0;
                      if (skill.effect.kind === 'heal') {
                        return (
                          <button
                            key={skill.id}
                            type="button"
                            onClick={() => performSkill(skill)}
                            disabled={!canAct}
                            className="relative flex flex-col items-stretch border px-2 py-2 text-left transition active:translate-y-px disabled:opacity-50 border-sys-ok/50 bg-sys-ok/5 hover:bg-sys-ok/15"
                          >
                            <span className="text-[10px] uppercase tracking-widest text-sys-muted">
                              {skill.label}
                            </span>
                            <span className="mt-0.5 text-sm font-bold text-sys-text">
                              {skill.name}
                            </span>
                            <span className="mt-1 font-mono text-[10px] text-sys-ok">
                              HEAL +{Math.round(skill.effect.healPct * 100)}%
                            </span>
                            {cd > 0 && <CooldownBadge cd={cd} />}
                          </button>
                        );
                      }
                      const stat = effective[skill.effect.stat] ?? 0;
                      const isWeak = boss.weak === skill.effect.stat;
                      const isResist = boss.resist === skill.effect.stat;
                      return (
                        <button
                          key={skill.id}
                          type="button"
                          onClick={() => performSkill(skill)}
                          disabled={!canAct}
                          className={`relative flex flex-col items-stretch border px-2 py-2 text-left transition active:translate-y-px disabled:opacity-50 ${
                            isWeak
                              ? 'border-sys-gold/60 bg-sys-gold/5 hover:bg-sys-gold/15'
                              : isResist
                              ? 'border-sys-danger/40 bg-sys-danger/5 hover:bg-sys-danger/10'
                              : 'border-sys-border/40 bg-black/30 hover:bg-sys-accent/10'
                          }`}
                        >
                          <span className="text-[10px] uppercase tracking-widest text-sys-muted">
                            {skill.label}
                          </span>
                          <span className="mt-0.5 text-sm font-bold text-sys-text">
                            {skill.name}
                          </span>
                          <span className="mt-1 font-mono text-[10px] text-sys-accent">
                            {skill.effect.stat} {stat} · ×{skill.effect.damageMultiplier.toFixed(1)}
                          </span>
                          {cd > 0 && <CooldownBadge cd={cd} />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="border border-sys-border/30 bg-black/30 p-3">
                    <p className="mb-2 text-[10px] uppercase tracking-widest text-sys-muted">
                      バトルログ
                    </p>
                    {log.length === 0 ? (
                      <p className="text-xs text-sys-muted">
                        ATBが満タンになるまで待て…
                      </p>
                    ) : (
                      <ul className="max-h-32 space-y-1 overflow-y-auto font-mono text-[11px]">
                        {log.map((l) => (
                          <li
                            key={l.id}
                            className={
                              l.tone === 'crit'
                                ? 'text-amber-300'
                                : l.tone === 'weak'
                                ? 'text-sys-gold'
                                : l.tone === 'resist'
                                ? 'text-sys-muted'
                                : l.tone === 'dodge'
                                ? 'text-sys-accent'
                                : l.tone === 'heal'
                                ? 'text-sys-ok'
                                : l.tone === 'boss'
                                ? 'text-sys-danger'
                                : l.tone === 'system'
                                ? 'text-sys-accent'
                                : 'text-sys-text/80'
                            }
                          >
                            {l.text}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {phase === 'won' && (
                    <>
                      <div className="border border-sys-ok/50 bg-sys-ok/5 px-4 py-3 text-sm text-sys-ok">
                        ✓ Floor {floor} 撃破 — 影を抽出できる
                      </div>

                      <div className="border border-sys-border/30 bg-black/30 px-4 py-3 space-y-3">
                        <div className="flex items-baseline justify-between">
                          <p className="text-[10px] uppercase tracking-widest text-sys-muted">
                            影抽出
                          </p>
                          <p className="font-mono text-xs text-sys-text">
                            残り {extractionsLeft} / {EXTRACTION_ATTEMPTS_PER_WIN} 回
                          </p>
                        </div>
                        <p className="text-[11px] text-sys-muted">
                          成功率 約 <span className="font-mono text-sys-accent">{Math.round(baseExtractionChance * 100)}%</span>
                          {' '}(Lv・PER・INT vs 階層 で変動)・
                          <span className="text-sys-gold">成功で終了</span>
                        </p>

                        {extractionResults.length > 0 && (
                          <ul className="space-y-1 font-mono text-[11px]">
                            {extractionResults.map((r, i) => (
                              <li key={r.id}>
                                <span className="text-sys-muted">#{i + 1}:</span>{' '}
                                {r.success && r.rarity ? (
                                  <span
                                    className={
                                      r.rarity === 'legendary'
                                        ? 'text-amber-300'
                                        : r.rarity === 'epic'
                                        ? 'text-purple-300'
                                        : r.rarity === 'rare'
                                        ? 'text-cyan-300'
                                        : 'text-sys-text'
                                    }
                                  >
                                    ✓ {RARITY_LABEL[r.rarity]}・{r.shadowName ?? '?'}
                                  </span>
                                ) : (
                                  <span className="text-sys-muted">✗ 失敗</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}

                        {extractionsLeft > 0 ? (
                          <button
                            type="button"
                            onClick={() => void handleExtract()}
                            disabled={extractionBusy}
                            className="sys-button w-full justify-center"
                          >
                            <Sparkles className="h-4 w-4" />
                            {extractionBusy ? '抽出中…' : '1回 抽出する'}
                          </button>
                        ) : (
                          <p className="text-[11px] text-sys-muted text-center">
                            {extractionResults.some((r) => r.success)
                              ? '抽出 成功 — 影を獲得'
                              : '抽出 失敗 — 3回とも空振り'}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => void onIncrementFloor()}
                        className="sys-button w-full justify-center"
                      >
                        <Swords className="h-4 w-4" />
                        {extractionsLeft > 0
                          ? `Floor ${floor + 1} へ進む (残り抽出を捨てる)`
                          : `Floor ${floor + 1} へ進む`}
                      </button>
                    </>
                  )}
                  {phase === 'lost' && (
                    <div className="border border-sys-danger/50 bg-sys-danger/5 px-4 py-3 text-sm text-sys-danger">
                      ✗ 敗北。同じ階層で再挑戦できる
                    </div>
                  )}
                  {phase === 'lost' && (
                    <button
                      type="button"
                      onClick={retry}
                      className="sys-button w-full justify-center"
                    >
                      <Swords className="h-4 w-4" />
                      Floor {floor} に再挑戦
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </SystemWindow>
      </div>
    </div>
  );
}

interface HpBarProps {
  label: string;
  icon: 'enemy' | 'player';
  value: number;
  max: number;
  pct: number;
  color: 'danger' | 'ok';
}

function HpBar({ icon, value, max, pct, color }: HpBarProps) {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-[10px] uppercase tracking-widest text-sys-muted">
        <span className="inline-flex items-center gap-1">
          <Heart className={`h-3 w-3 ${color === 'ok' ? 'text-sys-ok' : 'text-sys-danger'}`} />
          {icon === 'enemy' ? '敵HP' : '自HP'}
        </span>
        <span className="font-mono text-sys-text/80">
          {value} / {max}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden border border-sys-border/40 bg-black/60">
        <div
          className={`h-full transition-all duration-300 ${
            color === 'ok'
              ? 'bg-gradient-to-r from-sys-ok to-emerald-300'
              : 'bg-gradient-to-r from-sys-danger to-amber-400'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

interface AtbBarProps {
  pct: number;
  side: 'player' | 'boss';
}

function AtbBar({ pct, side }: AtbBarProps) {
  const full = pct >= 100;
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-[9px] uppercase tracking-widest text-sys-muted">
        <span className="inline-flex items-center gap-1">
          <Zap className="h-2.5 w-2.5" />
          ATB
        </span>
        <span className="font-mono">
          {Math.min(100, Math.round(pct))}%{full ? ' READY' : ''}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden border border-sys-border/30 bg-black/60">
        <div
          className={`h-full transition-[width] duration-75 ${
            side === 'player'
              ? 'bg-gradient-to-r from-sys-accent to-cyan-300'
              : 'bg-gradient-to-r from-rose-500 to-amber-400'
          }`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

// Compact "CD N" pip pinned to the action button when the skill is on
// cooldown. Visual signal supplements the disabled state so the user
// quickly sees which other skill rotated up next.
function CooldownBadge({ cd }: { cd: number }) {
  return (
    <span className="absolute top-1 right-1 inline-flex items-center justify-center min-w-[1.4rem] h-5 px-1 font-mono text-[10px] font-bold bg-sys-border/80 text-black border border-sys-border/60">
      CD {cd}
    </span>
  );
}
