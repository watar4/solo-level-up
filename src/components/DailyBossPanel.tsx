import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Swords, Heart, Zap, Sparkles, FlaskConical, DoorOpen, Coins } from 'lucide-react';
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
  isMiniBossFloor,
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
import {
  RARITY_COLOR,
  RARITY_LABEL,
  SHADOW_TEMPLATES,
} from '../lib/shadows';
import {
  shadowCombatPower,
  shadowLevel,
  stageDisplayName,
} from '../lib/shadowGrowth';
import type { ShadowGrowth } from '../hooks/useShadows';
import {
  rollChestWeapon,
  treasureChestChance,
  weaponBonusFor,
} from '../lib/items';
import {
  CONSUMABLES,
  bossGoldReward,
  getConsumable,
  type ConsumableTemplate,
} from '../lib/economy';
import type { Character, Shadow, ShadowRarity, StatKey } from '../types';
import { STAT_LABELS } from '../types';
import { todayKey } from '../lib/leveling';

interface Props {
  open: boolean;
  uid: string;
  character: Character;
  // Player's effective stats including any equipped weapon bonus. Shadows
  // no longer contribute to this — they fight separately.
  effectiveStats: Record<StatKey, number>;
  equippedShadows: Shadow[];
  onClose: () => void;
  onAwardShadow: (templateId: string) => Promise<{ id: string; name: string } | null>;
  onAwardWeapon: (templateId: string) => Promise<{ id: string; name: string } | null>;
  onIncrementFloor: () => Promise<void>;
  onEnqueueBossEvent: (args: {
    bossName: string;
    won: boolean;
    floor: number;
    extractedCount?: number;
    gold?: number;
  }) => void;
  // Boss purse — credits the gold wallet on victory.
  onAwardGold: (amount: number) => Promise<void>;
  // Consume one unit of a consumable (persists). False when none held.
  onUseConsumable: (consumableId: string) => Promise<boolean>;
  // Grant boss-victory EXP to equipped shadows; returns per-shadow growth.
  onShadowGrowth: (floor: number) => Promise<ShadowGrowth[]>;
}

interface BattleLog {
  id: string;
  text: string;
  tone?: 'weak' | 'resist' | 'crit' | 'dodge' | 'heal' | 'system' | 'boss' | 'companion';
}

type Phase =
  | 'roadmap'
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
  effectiveStats,
  equippedShadows,
  onClose,
  onAwardShadow,
  onAwardWeapon,
  onIncrementFloor,
  onEnqueueBossEvent,
  onAwardGold,
  onUseConsumable,
  onShadowGrowth,
}: Props) {
  const today = todayKey();
  // Furthest unexplored floor — anything ≤ this is selectable in the
  // roadmap (cleared floors are revisitable, the next one is the new
  // frontier). bossesDefeated + 1 is also the value to advance to on a
  // first-clear win.
  const nextFloor = currentFloor(character);

  // The floor the user is *currently* fighting / about to fight. Defaults
  // to the frontier when the panel first opens, but the roadmap can
  // re-target it backward to revisit a cleared floor.
  const [selectedFloor, setSelectedFloor] = useState(nextFloor);
  // Whenever the character's progress advances (e.g. just defeated the
  // frontier), bump the selected floor along — keeps the panel synced when
  // it's already mounted.
  useEffect(() => {
    setSelectedFloor((prev) => Math.max(prev, nextFloor));
  }, [nextFloor]);

  const floor = selectedFloor;
  const rawBoss = useMemo<BossDef>(() => pickBossByFloor(floor), [floor]);
  // Pre-scale the boss's attack value with the floor so the rest of the
  // combat code can ignore floor-specific logic.
  const boss = useMemo<BossDef>(
    () => ({ ...rawBoss, attack: scaledBossAttack(rawBoss, floor) }),
    [rawBoss, floor]
  );

  const effective = effectiveStats;
  const companionCount = equippedShadows.length;

  const maxBossHp = useMemo(
    () => scaledBossHp(boss, character.level, floor, companionCount),
    [boss, character.level, floor, companionCount]
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

  // Independent ATB gauges per companion shadow. Each fills based on the
  // shadow's rarity-driven speed and discharges as an auto-attack on the
  // boss when it tops out.
  const [shadowAtbs, setShadowAtbs] = useState<Record<string, number>>({});

  // Treasure chest after victory (rolled once when finalize is called).
  const [treasureRolled, setTreasureRolled] = useState(false);
  const [treasureItem, setTreasureItem] = useState<{
    templateId: string;
    name: string;
    rarity: ShadowRarity;
    stat: StatKey;
    bonus: number;
  } | null>(null);
  const [treasureOpened, setTreasureOpened] = useState(false);
  const [treasureBusy, setTreasureBusy] = useState(false);

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

  // ── Battle inventory (どうぐ) ──
  // Local per-battle stock snapshot. Decremented instantly on use for a
  // responsive UI; onUseConsumable persists the real count in the background.
  const [itemStocks, setItemStocks] = useState<Record<string, number>>({});
  // 力の結晶: multiplies the NEXT attack once, then clears.
  const [attackBoost, setAttackBoost] = useState<number | null>(null);
  // Victory purse + per-shadow growth, shown on the won screen.
  const [goldEarned, setGoldEarned] = useState(0);
  const [growthResults, setGrowthResults] = useState<ShadowGrowth[]>([]);

  // Stop the ATB ticker when we're not actively in a fight.
  const intervalRef = useRef<number | null>(null);
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;

  // Keep the DQ message window pinned to the latest line.
  const logBoxRef = useRef<HTMLUListElement | null>(null);
  useEffect(() => {
    logBoxRef.current?.scrollTo({ top: logBoxRef.current.scrollHeight });
  }, [log]);

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

  // When the panel itself opens, start at the roadmap so the user picks a
  // floor (frontier or revisit). When the *floor* changes (because the
  // user picked one, or because the frontier advanced after a win),
  // reset combat for that floor but don't yank them back to the roadmap.
  useEffect(() => {
    if (!open) return;
    setPhase('roadmap');
    setSelectedFloor(nextFloor);
  }, [open, nextFloor]);

  // Combat + reward reset. Intentionally NOT depending on equippedShadows
  // — that array reference changes whenever a new shadow is rolled (e.g.
  // a successful extraction adds an unequipped shadow doc), and we don't
  // want that to wipe the just-shown extraction / treasure UI.
  useEffect(() => {
    if (!open) return;
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
    setTreasureRolled(false);
    setTreasureItem(null);
    setTreasureOpened(false);
    setTreasureBusy(false);
    setItemStocks({ ...(character.consumables ?? {}) });
    setAttackBoost(null);
    setGoldEarned(0);
    setGrowthResults([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, floor, maxBossHp, maxPlayerHp]);

  // Re-seed shadow ATB gauges whenever the equipped set actually changes
  // (cardinality / id list). Keyed on the joined-id string so a reference
  // change without content change doesn't trigger a reset.
  const equippedKey = equippedShadows.map((s) => s.id).join(',');
  useEffect(() => {
    if (!open) return;
    const blank: Record<string, number> = {};
    for (const s of equippedShadows) blank[s.id] = 0;
    setShadowAtbs(blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, floor, equippedKey]);

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
      // Advance each companion shadow's ATB. When one tops out we fire its
      // attack inline (deals damage to the boss, resets that shadow's ATB
      // back to 0). The phase machine is not touched — shadow attacks run
      // independently of the player/boss turn loop.
      setShadowAtbs((prev) => {
        let changed = false;
        const next: Record<string, number> = { ...prev };
        for (const s of equippedShadows) {
          const power = shadowCombatPower(s);
          const v = (prev[s.id] ?? 0) + power.atbSpeed;
          if (v >= ATB_TARGET) {
            // Fire — damage roll with a small variance band.
            const variance = 0.85 + Math.random() * 0.3;
            const dmg = Math.max(1, Math.round(power.attack * variance));
            // Apply via setBossHp callback to keep state consistent.
            setBossHp((hpPrev) => {
              const after = Math.max(0, hpPrev - dmg);
              return after;
            });
            setLog((logPrev) => [
              ...logPrev,
              {
                id: `shadow-${s.id}-${Date.now()}-${Math.random()}`,
                text: `${stageDisplayName(s.name, shadowLevel(s))}の ついげき! ${dmg} のダメージ!`,
                tone: 'companion',
              },
            ]);
            next[s.id] = 0;
            changed = true;
          } else {
            next[s.id] = v;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, TICK_MS);
    return () => {
      if (intervalRef.current != null) window.clearInterval(intervalRef.current);
    };
  }, [open, phase, effective, boss, equippedShadows]);

  // Watch for shadow-driven KO — bossHp can hit 0 from a companion blow
  // while the player is mid-turn. Finalise the fight in that case.
  useEffect(() => {
    if (phase !== 'fighting' && phase !== 'player-turn') return;
    if (bossHp === 0) {
      void finalize(true, turn);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bossHp]);

  // Auto-skip: if the player gauge fills but every equipped skill is on
  // cooldown, the user would be soft-locked with no usable button. Treat
  // that as a "wait" action — tick cooldowns down by 1, reset player ATB,
  // hand control back to the ticker. Without this the high-CD loadouts
  // (e.g. 3× CD 3+ skills) could deadlock at turn 4.
  useEffect(() => {
    if (phase !== 'player-turn') return;
    if (equippedSkills.length === 0) return;
    const allLocked = equippedSkills.every(
      (s) => (cooldowns[s.id] ?? 0) > 0
    );
    if (!allLocked) return;
    setCooldowns((prev) => {
      const next: Record<string, number> = {};
      for (const id in prev) {
        const remaining = Math.max(0, (prev[id] ?? 0) - 1);
        if (remaining > 0) next[id] = remaining;
      }
      return next;
    });
    setPlayerAtb(0);
    setPhase('fighting');
    setLog((prev) => [
      ...prev,
      {
        id: `wait-${Date.now()}`,
        text: '構え直し… (全スキルCD中、1ターン待機)',
        tone: 'system',
      },
    ]);
  }, [phase, cooldowns, equippedSkills]);

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
            text: `${boss.name}の こうげき! しかし ${character.name}は ひらりと かわした!`,
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
            text: `${boss.name}の こうげき! ${character.name}に ${result.damage} のダメージ!${
              result.crit ? ' [痛恨の一撃!]' : ''
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
          // 不死鳥の羽根: passive auto-revive, once per stock. Consumes the
          // real inventory in the background; battle continues at 50% HP.
          if ((itemStocks['phoenix-feather'] ?? 0) > 0) {
            const reviveHp = Math.max(1, Math.round(maxPlayerHp * 0.5));
            setItemStocks((prev) => ({
              ...prev,
              'phoenix-feather': (prev['phoenix-feather'] ?? 1) - 1,
            }));
            void onUseConsumable('phoenix-feather');
            setPlayerHp(reviveHp);
            setLog((prev) => [
              ...prev,
              {
                id: `revive-${Date.now()}`,
                text: `不死鳥の羽根が まばゆく かがやいた! ${character.name}は よみがえった!`,
                tone: 'heal',
              },
            ]);
            setDamageBurst({
              key: Date.now() + 1,
              value: reviveHp,
              target: 'player',
              tone: 'heal',
            });
          } else {
            void finalize(false, turn);
            return;
          }
        }
      }
      setBossAtb(0);
      setPhase('fighting');
    }, 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const startBattle = () => {
    setLog([
      {
        id: `encounter-${Date.now()}`,
        text: `${boss.name}が あらわれた!`,
        tone: 'system',
      },
    ]);
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
          text: `${character.name}は ${skill.name}を となえた! HPが ${restored} かいふくした!`,
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
    // 力の結晶: one-shot multiplier armed by the item, consumed here.
    const boosted = attackBoost
      ? Math.round(result.damage * attackBoost)
      : result.damage;
    if (attackBoost) setAttackBoost(null);
    const nextBossHp = Math.max(0, bossHp - boosted);
    setBossHp(nextBossHp);
    setDamageBurst({
      key: Date.now(),
      value: boosted,
      target: 'boss',
      tone: result.crit ? 'crit' : result.isWeak ? 'weak' : result.isResist ? 'resist' : 'normal',
    });
    setLog((prev) => [
      ...prev,
      {
        id: `p-${nextTurn}-${Date.now()}`,
        text: `${character.name}の ${skill.name}! ${boss.name}に ${boosted} のダメージ!${
          result.crit ? ' [会心の一撃!]' : result.isWeak ? ' [弱点を突いた!]' : result.isResist ? ' [効きが悪い…]' : ''
        }${attackBoost ? ' [結晶の力!]' : ''}`,
        tone: result.crit ? 'crit' : result.isWeak ? 'weak' : result.isResist ? 'resist' : undefined,
      },
    ]);
    if (nextBossHp === 0) {
      void finalize(true, nextTurn);
    } else {
      setPhase('fighting');
    }
  };

  // ── どうぐ (battle items) ──
  // Using an item consumes the turn, DQ-style: cooldowns tick, ATB resets.
  const handleUseItem = (template: ConsumableTemplate) => {
    if (phase !== 'player-turn') return;
    if ((itemStocks[template.id] ?? 0) <= 0) return;
    if (template.effect.type === 'revive') return; // passive, not clickable
    if (template.effect.type === 'attack-boost' && attackBoost) return; // already armed

    setItemStocks((prev) => ({
      ...prev,
      [template.id]: (prev[template.id] ?? 1) - 1,
    }));
    void onUseConsumable(template.id);

    const nextTurn = turn + 1;
    setTurn(nextTurn);
    setPlayerAtb(0);
    setCooldowns((prev) => {
      const next: Record<string, number> = {};
      for (const id in prev) {
        const remaining = Math.max(0, (prev[id] ?? 0) - 1);
        if (remaining > 0) next[id] = remaining;
      }
      return next;
    });

    if (template.effect.type === 'heal') {
      const healAmount = Math.round(maxPlayerHp * template.effect.percent);
      const nextHp = Math.min(maxPlayerHp, playerHp + healAmount);
      const restored = nextHp - playerHp;
      setPlayerHp(nextHp);
      setDamageBurst({ key: Date.now(), value: restored, target: 'player', tone: 'heal' });
      setLog((prev) => [
        ...prev,
        {
          id: `item-${nextTurn}-${Date.now()}`,
          text: `${character.name}は ${template.name}を つかった! HPが ${restored} かいふくした!`,
          tone: 'heal',
        },
      ]);
    } else if (template.effect.type === 'attack-boost') {
      const mult = template.effect.multiplier;
      setAttackBoost(mult);
      setLog((prev) => [
        ...prev,
        {
          id: `item-${nextTurn}-${Date.now()}`,
          text: `${character.name}は ${template.name}を くだいた! つぎの攻撃の威力が ${mult}倍に!`,
          tone: 'system',
        },
      ]);
    }
    setPhase('fighting');
  };

  // ── にげる ──
  // AGI-driven escape roll. Success returns to the roadmap with no attempt
  // logged; failure wastes the turn (classic まわりこまれた).
  const handleFlee = () => {
    if (phase !== 'player-turn') return;
    const agiDelta = (effective.AGI ?? 0) - boss.agility;
    const chance = Math.max(0.3, Math.min(0.9, 0.5 + agiDelta * 0.02));
    if (Math.random() < chance) {
      setLog((prev) => [
        ...prev,
        { id: `flee-${Date.now()}`, text: `${character.name}は にげだした!`, tone: 'system' },
      ]);
      setPhase('roadmap');
    } else {
      setTurn((t) => t + 1);
      setPlayerAtb(0);
      setLog((prev) => [
        ...prev,
        {
          id: `flee-${Date.now()}`,
          text: `${character.name}は にげだした! しかし まわりこまれてしまった!`,
          tone: 'boss',
        },
      ]);
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
          ? `${boss.name}を たおした!`
          : `${character.name}は ちからつきた…`,
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
      // No player EXP — daily quest progression is the only path for
      // character growth. Boss kills pay a gold purse, feed the equipped
      // shadows' growth, and grant extraction attempts + a chest chance.
      const purse = bossGoldReward(floor);
      setGoldEarned(purse);
      setLog((prev) => [
        ...prev,
        {
          id: `gold-${Date.now()}`,
          text: `${purse} ゴールドを てにいれた!`,
          tone: 'system',
        },
      ]);
      onAwardGold(purse).catch((err) => console.error('[boss] gold award failed', err));

      // Equipped shadows level up from the win (Pokémon-style party EXP).
      onShadowGrowth(floor)
        .then((growths) => {
          setGrowthResults(growths);
          const lines = growths
            .filter((g) => g.levelsGained > 0)
            .map((g) => ({
              id: `growth-${g.shadow.id}-${Date.now()}`,
              text: g.evolved && g.newStageName
                ? `なんと! ${g.shadow.name}は ${g.newStageName}に しんかした!`
                : `${g.shadow.name}は レベル ${shadowLevel(g.shadow)} に あがった!`,
              tone: 'companion' as const,
            }));
          if (lines.length) setLog((prev) => [...prev, ...lines]);
        })
        .catch((err) => console.error('[boss] shadow growth failed', err));

      onEnqueueBossEvent({
        bossName: boss.name,
        won: true,
        floor,
        gold: purse,
      });

      // Roll the treasure chest once per win. The actual weapon roll
      // happens when the user clicks 開ける so they get an opening beat.
      const chance = treasureChestChance(floor);
      const dropped = Math.random() < chance;
      setTreasureRolled(true);
      if (dropped) {
        const template = rollChestWeapon({
          playerLevel: character.level,
          floor,
        });
        setTreasureItem({
          templateId: template.id,
          name: template.name,
          rarity: template.rarity,
          stat: template.stat,
          bonus: weaponBonusFor(template.rarity),
        });
      } else {
        setTreasureItem(null);
      }
      setTreasureOpened(false);
    } else {
      onEnqueueBossEvent({
        bossName: boss.name,
        won: false,
        floor,
      });
    }
  };

  const handleOpenChest = async () => {
    if (!treasureItem || treasureOpened || treasureBusy) return;
    setTreasureBusy(true);
    try {
      await onAwardWeapon(treasureItem.templateId);
      setTreasureOpened(true);
    } catch (err) {
      console.error('[chest] award weapon failed', err);
    } finally {
      setTreasureBusy(false);
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

          {phase === 'roadmap' ? (
            <FloorRoadmap
              nextFloor={nextFloor}
              onSelect={(f) => {
                setSelectedFloor(f);
                setPhase('ready');
              }}
            />
          ) : (
            <div className="space-y-4">
              {/* Floor indicator */}
              <div className="flex items-center justify-between border border-sys-border/30 bg-black/30 px-3 py-2">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] uppercase tracking-widest text-sys-muted">
                    Tower Floor
                  </p>
                  {isMiniBossFloor(floor) && (
                    <span className="inline-flex items-center gap-1 border border-sys-gold/60 bg-sys-gold/10 px-1.5 text-[9px] font-bold tracking-widest text-sys-gold">
                      ★ MINI BOSS
                    </span>
                  )}
                  {selectedFloor < nextFloor && (
                    <span className="text-[9px] text-sys-muted">(再挑戦)</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPhase('roadmap')}
                    title="ロードマップへ戻る"
                    className="text-[10px] uppercase tracking-widest text-sys-muted hover:text-sys-accent transition"
                  >
                    ← ロードマップ
                  </button>
                  <p className="font-mono text-xl text-sys-accent">#{floor}</p>
                </div>
              </div>

              {/* Battle arena — the boss holds center stage */}
              <div className="battle-arena px-4 pt-3 pb-9">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[9px] uppercase tracking-widest text-sys-muted">
                      Floor {floor} Boss
                    </p>
                    <p className="truncate text-base font-black tracking-wider text-sys-text">
                      {boss.name}
                    </p>
                    <p className="mt-0.5 font-mono text-[9px] uppercase tracking-widest">
                      <span className="text-sys-gold">弱点 {boss.weak}</span>
                      <span className="text-sys-muted"> / </span>
                      <span className="text-sys-danger">耐性 {boss.resist}</span>
                    </p>
                  </div>
                  <div className="w-36 shrink-0 space-y-1 sm:w-44">
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
                </div>

                {/* Sprite: idle breathing + hit shake (replayed via key). */}
                <div className="mt-1 flex justify-center">
                  <motion.div
                    key={`boss-shake-${damageBurst?.target === 'boss' ? damageBurst.key : 'idle'}`}
                    animate={
                      damageBurst?.target === 'boss'
                        ? { x: [0, -9, 9, -5, 5, -2, 0] }
                        : { x: 0 }
                    }
                    transition={{ duration: 0.4 }}
                  >
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <PixelArt
                        layers={[{ grid: bossSprite.grid, palette: bossSprite.palette }]}
                        pixelSize={7}
                        ariaLabel={`ボス ${boss.name}`}
                      />
                    </motion.div>
                  </motion.div>
                </div>

                {phase === 'ready' && (
                  <p className="mt-2 text-center text-xs text-sys-muted">{boss.flavor}</p>
                )}

                {/* Damage numbers float up from the sprite */}
                <AnimatePresence>
                  {damageBurst && damageBurst.target === 'boss' && (
                    <motion.div
                      key={damageBurst.key}
                      initial={{ opacity: 0, y: 0, scale: 0.6 }}
                      animate={{ opacity: 1, y: -34, scale: 1.25 }}
                      exit={{ opacity: 0, y: -55 }}
                      transition={{ duration: 0.6 }}
                      onAnimationComplete={() => setDamageBurst(null)}
                      className={`pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 font-display font-black ${
                        damageBurst.tone === 'crit'
                          ? 'text-amber-300 drop-shadow-[0_0_12px_rgba(255,215,0,0.9)] text-4xl'
                          : damageBurst.tone === 'weak'
                          ? 'text-sys-gold text-3xl'
                          : damageBurst.tone === 'resist'
                          ? 'text-sys-muted text-xl'
                          : 'text-sys-accent text-3xl'
                      }`}
                    >
                      -{damageBurst.value}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Victory / defeat stamp over the arena */}
                <AnimatePresence>
                  {phase === 'won' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 2.2 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    >
                      <p className="gold-text -rotate-6 font-display text-5xl font-black tracking-widest drop-shadow-[0_0_24px_rgba(255,200,0,0.5)]">
                        VICTORY
                      </p>
                    </motion.div>
                  )}
                  {phase === 'lost' && (
                    <motion.div
                      initial={{ opacity: 0, y: -30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                      className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40"
                    >
                      <p className="font-display text-4xl font-black tracking-widest text-sys-danger drop-shadow-[0_0_18px_rgba(255,71,87,0.6)]">
                        DEFEAT
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Player HUD strip — compact, thumb-zone friendly */}
              <motion.div
                key={`player-shake-${
                  damageBurst?.target === 'player' &&
                  damageBurst.tone !== 'heal' &&
                  damageBurst.tone !== 'dodge'
                    ? damageBurst.key
                    : 'idle'
                }`}
                animate={
                  damageBurst?.target === 'player' &&
                  damageBurst.tone !== 'heal' &&
                  damageBurst.tone !== 'dodge'
                    ? { x: [0, -7, 7, -4, 4, 0] }
                    : { x: 0 }
                }
                transition={{ duration: 0.35 }}
                className="relative border border-sys-border/40 bg-black/40 px-3 py-2"
              >
                <div className="flex items-center gap-2.5">
                  <div className="shrink-0 border border-sys-border/40 bg-black/60 p-0.5">
                    <PixelArt
                      layers={[
                        { grid: playerSprite.grid, palette: playerSprite.palette },
                      ]}
                      pixelSize={3}
                      ariaLabel={`プレイヤー ${character.name}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-xs font-black tracking-wider text-sys-text">
                        {character.name}
                      </p>
                      <span className="shrink-0 font-mono text-[9px] text-sys-muted">
                        Lv.{character.level} · 行動 {turn} 回
                      </span>
                    </div>
                    <div className="mt-1 space-y-1">
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
                  </div>
                </div>

                {/* Effective stats — pre-battle briefing only, saves height in combat */}
                {phase === 'ready' && (
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
                )}

                <AnimatePresence>
                  {damageBurst && damageBurst.target === 'player' && (
                    <motion.div
                      key={damageBurst.key}
                      initial={{ opacity: 0, y: 0, scale: 0.7 }}
                      animate={{ opacity: 1, y: -20, scale: 1.15 }}
                      exit={{ opacity: 0, y: -38 }}
                      transition={{ duration: 0.6 }}
                      onAnimationComplete={() => setDamageBurst(null)}
                      className={`pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 font-display font-black ${
                        damageBurst.tone === 'dodge'
                          ? 'text-sys-accent text-lg'
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
              </motion.div>

              {/* Companion shadows row */}
              {equippedShadows.length > 0 && (
                <div className="border border-purple-400/30 bg-black/30 px-3 py-2 space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-sys-muted">
                    影軍団 (自動戦闘 · {equippedShadows.length} 体)
                  </p>
                  <div className={`grid gap-2 ${equippedShadows.length === 1 ? 'grid-cols-1' : equippedShadows.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                    {equippedShadows.map((s) => {
                      const combat = shadowCombatPower(s);
                      const level = shadowLevel(s);
                      const atb = shadowAtbs[s.id] ?? 0;
                      const pct = Math.min(100, (atb / ATB_TARGET) * 100);
                      return (
                        <div
                          key={s.id}
                          className={`border px-2 py-1.5 ${RARITY_COLOR[s.rarity]} bg-black/40`}
                        >
                          <div className="flex items-baseline justify-between gap-1">
                            <p className="truncate text-[11px] font-bold text-sys-text">
                              {stageDisplayName(s.name, level)}
                            </p>
                            <span className="text-[9px] font-mono text-sys-muted shrink-0">
                              Lv{level} · ATK {combat.attack}
                            </span>
                          </div>
                          <div className="mt-1 h-1 w-full overflow-hidden border border-sys-border/30 bg-black/60">
                            <div
                              className="h-full transition-[width] duration-75 bg-gradient-to-r from-purple-400 to-pink-400"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
                            className="relative flex flex-col items-stretch border px-2 py-2.5 text-left transition active:translate-y-px active:scale-[0.97] disabled:opacity-50 border-sys-ok/50 bg-sys-ok/5 hover:bg-sys-ok/15"
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
                          className={`relative flex flex-col items-stretch border px-2 py-2.5 text-left transition active:translate-y-px active:scale-[0.97] disabled:opacity-50 ${
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

                  {/* どうぐ + にげる command row (player-turn only) */}
                  {(phase === 'fighting' || phase === 'player-turn' || phase === 'boss-acting') && (
                    <div className="flex flex-wrap items-stretch gap-2">
                      {CONSUMABLES.filter((c) => c.effect.type !== 'revive').map((c) => {
                        const held = itemStocks[c.id] ?? 0;
                        const armed = c.effect.type === 'attack-boost' && attackBoost !== null;
                        const canUse = phase === 'player-turn' && held > 0 && !armed;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleUseItem(c)}
                            disabled={!canUse}
                            title={c.description}
                            className="relative flex items-center gap-1.5 border border-sys-gold/40 bg-sys-gold/5 px-2.5 py-1.5 text-[11px] font-bold text-sys-text transition hover:bg-sys-gold/15 active:translate-y-px disabled:opacity-40"
                          >
                            <span>{c.icon}</span>
                            <span>{c.name}</span>
                            <span className="font-mono text-[10px] text-sys-muted">×{held}</span>
                            {armed && (
                              <span className="font-mono text-[9px] text-sys-gold">装填中</span>
                            )}
                          </button>
                        );
                      })}
                      {(itemStocks['phoenix-feather'] ?? 0) > 0 && (
                        <span
                          title={getConsumable('phoenix-feather')?.description}
                          className="flex items-center gap-1.5 border border-sys-arise/40 bg-sys-arise/5 px-2.5 py-1.5 text-[11px] text-sys-muted"
                        >
                          🪶 不死鳥の羽根
                          <span className="font-mono text-[10px]">×{itemStocks['phoenix-feather']}</span>
                          <span className="text-[9px]">(自動発動)</span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={handleFlee}
                        disabled={phase !== 'player-turn'}
                        className="ml-auto flex items-center gap-1.5 border border-sys-border/40 bg-black/30 px-2.5 py-1.5 text-[11px] font-bold text-sys-muted transition hover:text-sys-text hover:bg-sys-danger/10 active:translate-y-px disabled:opacity-40"
                      >
                        <DoorOpen className="h-3.5 w-3.5" />
                        にげる
                      </button>
                    </div>
                  )}

                  <div className="dq-window p-3">
                    <p className="mb-2 text-[10px] uppercase tracking-widest text-sys-muted">
                      <FlaskConical className="mr-1 inline h-3 w-3 align-[-2px]" />
                      メッセージ
                    </p>
                    {log.length === 0 ? (
                      <p className="text-xs text-sys-muted">
                        ATBが満タンになるまで待て…
                      </p>
                    ) : (
                      <ul ref={logBoxRef} className="max-h-32 space-y-1 overflow-y-auto font-mono text-[11px]">
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
                                : l.tone === 'companion'
                                ? 'text-purple-300'
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
                      <div className="border border-sys-ok/50 bg-sys-ok/5 px-4 py-3">
                        <p className="text-sm text-sys-ok">
                          ✓ Floor {floor} 撃破 — 影を抽出できる
                        </p>
                        {goldEarned > 0 && (
                          <p className="mt-1 flex items-center gap-1.5 text-sm">
                            <Coins className="h-4 w-4 text-sys-gold" />
                            <span className="gold-text text-base">+{goldEarned} G</span>
                            <span className="text-[10px] text-sys-muted">討伐報酬</span>
                          </p>
                        )}
                      </div>

                      {/* Shadow party growth (Pokémon-style EXP share) */}
                      {growthResults.length > 0 && (
                        <div className="border border-sys-arise/40 bg-sys-arise/5 px-4 py-3 space-y-1.5">
                          <p className="text-[10px] uppercase tracking-widest text-sys-arise">
                            影軍団の成長
                          </p>
                          <ul className="space-y-1 font-mono text-[11px]">
                            {growthResults.map((g) => {
                              const lv = shadowLevel(g.shadow);
                              return (
                                <li key={g.shadow.id} className="flex items-baseline gap-2">
                                  <span className={`truncate ${g.evolved ? 'rarity-legendary' : 'text-sys-text'}`}>
                                    {g.evolved && g.newStageName
                                      ? `⚡ ${g.newStageName} に進化!`
                                      : stageDisplayName(g.shadow.name, lv)}
                                  </span>
                                  <span className="shrink-0 text-sys-muted">
                                    Lv{lv}
                                    {g.levelsGained > 0 && (
                                      <span className="text-sys-ok"> (+{g.levelsGained})</span>
                                    )}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

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

                      {/* Treasure chest — only renders when a chest dropped */}
                      {treasureRolled && treasureItem && (
                        <div className="border border-sys-gold/50 bg-sys-gold/5 px-4 py-3 space-y-2">
                          <div className="flex items-baseline justify-between">
                            <p className="text-[10px] uppercase tracking-widest text-sys-gold">
                              宝箱出現
                            </p>
                            <p className="text-[10px] text-sys-muted">
                              ドロップ率 {Math.round(treasureChestChance(floor) * 100)}%
                            </p>
                          </div>
                          {!treasureOpened ? (
                            <button
                              type="button"
                              onClick={() => void handleOpenChest()}
                              disabled={treasureBusy}
                              className="sys-button w-full justify-center"
                            >
                              {treasureBusy ? '開けている…' : '🗝 宝箱を開ける'}
                            </button>
                          ) : (
                            <p className="font-mono text-sm">
                              <span
                                className={`inline-block border px-1.5 mr-1 text-[10px] font-bold tracking-widest ${RARITY_COLOR[treasureItem.rarity]}`}
                              >
                                {RARITY_LABEL[treasureItem.rarity]}
                              </span>
                              <span className="text-sys-text">{treasureItem.name}</span>
                              <span className="ml-2 text-sys-accent">
                                {treasureItem.stat} +{treasureItem.bonus}
                              </span>
                              <span className="ml-2 text-[10px] text-sys-muted">
                                インベントリへ
                              </span>
                            </p>
                          )}
                        </div>
                      )}
                      {treasureRolled && !treasureItem && (
                        <div className="border border-sys-border/20 bg-black/20 px-4 py-2 text-[11px] text-sys-muted text-center">
                          宝箱は出現しなかった (Floor {floor} の確率 {Math.round(treasureChestChance(floor) * 100)}%)
                        </div>
                      )}

                      {selectedFloor === nextFloor ? (
                        // First-clear of the frontier — advance bossesDefeated
                        // counter and proceed to the next floor.
                        <button
                          type="button"
                          onClick={async () => {
                            await onIncrementFloor();
                            // After the counter advances, hop back to the
                            // roadmap so the user sees their progress.
                            setPhase('roadmap');
                          }}
                          className="sys-button w-full justify-center"
                        >
                          <Swords className="h-4 w-4" />
                          {extractionsLeft > 0
                            ? `Floor ${floor + 1} へ進む (残り抽出を捨てる)`
                            : `Floor ${floor + 1} へ進む`}
                        </button>
                      ) : (
                        // Revisit win — no counter change. Just return to
                        // the roadmap.
                        <button
                          type="button"
                          onClick={() => setPhase('roadmap')}
                          className="sys-button w-full justify-center"
                        >
                          ロードマップへ戻る
                        </button>
                      )}
                    </>
                  )}
                  {phase === 'lost' && (
                    <div className="border border-sys-danger/50 bg-sys-danger/5 px-4 py-3 text-sm text-sys-danger">
                      ✗ 敗北。同じ階層で再挑戦できる
                    </div>
                  )}
                  {phase === 'lost' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPhase('roadmap')}
                        className="sys-button flex-1 justify-center"
                      >
                        ← ロードマップ
                      </button>
                      <button
                        type="button"
                        onClick={retry}
                        className="sys-button flex-1 justify-center"
                      >
                        <Swords className="h-4 w-4" />
                        Floor {floor} 再挑戦
                      </button>
                    </div>
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

interface FloorRoadmapProps {
  nextFloor: number; // first unexplored floor (= bossesDefeated + 1)
  onSelect: (floor: number) => void;
}

// Grid roadmap of every floor up to (and including) the next unexplored
// one. Cleared floors are revisitable; future floors are locked and
// rendered greyed-out so the user can see where the tower's heading.
function FloorRoadmap({ nextFloor, onSelect }: FloorRoadmapProps) {
  // Show at least 25 floors and always at least 5 floors past the frontier,
  // so a brand-new player still sees a long-ish tower.
  const visibleMax = Math.max(25, nextFloor + 5);
  const floors = Array.from({ length: visibleMax }, (_, i) => i + 1);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-sys-muted">
            Tower Roadmap
          </p>
          <p className="mt-0.5 text-xs text-sys-text/80">
            到達 Floor {nextFloor === 1 ? '— (未踏破)' : `${nextFloor - 1}`} · 次の挑戦 Floor {nextFloor}
          </p>
        </div>
        <div className="text-right text-[10px] text-sys-muted space-y-0.5">
          <p><span className="text-sys-ok">✓</span> 撃破済 (再挑戦可)</p>
          <p><span className="text-sys-accent">▶</span> 未踏破</p>
          <p><span className="text-sys-gold">★</span> ミニボス</p>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1.5 max-h-80 overflow-y-auto pr-1.5">
        {floors.map((f) => {
          const cleared = f < nextFloor;
          const current = f === nextFloor;
          const locked = f > nextFloor;
          const mini = f % 5 === 0;
          const enabled = !locked;
          return (
            <button
              key={f}
              type="button"
              disabled={!enabled}
              onClick={() => enabled && onSelect(f)}
              title={
                locked
                  ? '未踏破 — 前のフロアを撃破して解放'
                  : current
                  ? `Floor ${f} に挑戦`
                  : `Floor ${f} に再挑戦`
              }
              className={`relative flex flex-col items-center justify-center border px-2 py-2 transition ${
                current
                  ? 'border-sys-accent bg-sys-accent/10 hover:bg-sys-accent/20'
                  : cleared
                  ? 'border-sys-ok/40 bg-sys-ok/5 hover:bg-sys-ok/15'
                  : 'border-sys-border/20 bg-black/30 opacity-40 cursor-not-allowed'
              }`}
            >
              <span className="font-mono text-sm font-bold text-sys-text">
                {f}
              </span>
              <span className="mt-0.5 text-[9px] uppercase tracking-widest">
                {current ? (
                  <span className="text-sys-accent">▶ 次</span>
                ) : cleared ? (
                  <span className="text-sys-ok">✓</span>
                ) : (
                  <span className="text-sys-muted">🔒</span>
                )}
              </span>
              {mini && (
                <span className="absolute top-1 right-1 text-[10px] text-sys-gold">
                  ★
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
