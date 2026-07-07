// Build the engine's PlayerConfig / ShadowConfig from persisted game data.
// Kept out of the components so the mapping is one obvious place.

import type { Character, Shadow, StatKey } from '../../types';
import { playerMaxHp } from '../boss';
import { effectiveEquippedSkills, getSkill, type BattleSkill } from '../battleSkills';
import { shadowCombatPower } from '../shadowGrowth';
import { consumableCount } from '../economy';
import { sumMedalPassive, type MedalId } from '../story/medals';
import { type PlayerConfig, type PlayerSkill, type ShadowConfig } from './engine';
import { STAT_TO_ELEMENT } from './elements';
import { CLASS_INFO, baseClass, jobCombatMods } from '../jobs';

function toPlayerSkill(s: BattleSkill): PlayerSkill {
  if (s.effect.kind === 'heal') {
    return {
      id: s.id, name: s.name, kind: 'heal', stat: 'VIT',
      damageMultiplier: 0, healPct: s.effect.healPct,
      guaranteedCrit: false, critBonusFlat: 0, cooldown: s.cooldown,
    };
  }
  return {
    id: s.id, name: s.name, kind: 'attack', stat: s.effect.stat,
    damageMultiplier: s.effect.damageMultiplier, healPct: 0,
    guaranteedCrit: !!s.effect.guaranteedCrit,
    critBonusFlat: s.effect.critBonusFlat ?? 0, cooldown: s.cooldown,
  };
}

export function buildPlayerConfig(
  character: Character,
  effectiveStats: Record<StatKey, number>,
  medals: MedalId[]
): PlayerConfig {
  const cls = baseClass(character);
  const mods = jobCombatMods(character);
  const baseHp = playerMaxHp(effectiveStats, character.level);
  const maxHp = Math.round(baseHp * (1 + sumMedalPassive(medals, 'maxHp')));
  const skills = effectiveEquippedSkills(character)
    .map((id) => getSkill(id))
    .filter((s): s is BattleSkill => !!s)
    .map(toPlayerSkill);

  return {
    name: character.name,
    level: character.level,
    stats: effectiveStats,
    maxHp,
    primaryElement: CLASS_INFO[cls].element,
    skills,
    hasRevive: consumableCount(character, 'phoenix-feather') > 0,
    critBonus: sumMedalPassive(medals, 'critChance'),
    burnResist: sumMedalPassive(medals, 'burnResist'),
    damageTakenMult: mods.damageTakenMult,
    atbBonus: mods.atbBonus,
    cooldownReduction: mods.cooldownReduction,
    firstStrikeBreak: mods.firstStrikeBreak,
    ultimatePower: mods.ultimatePower,
    ultimateName: mods.ultimateName,
  };
}

export function buildShadowConfigs(equipped: Shadow[]): ShadowConfig[] {
  return equipped.slice(0, 3).map((s) => {
    const power = shadowCombatPower(s);
    return {
      id: s.id,
      name: s.name,
      element: STAT_TO_ELEMENT[s.stat],
      attack: power.attack,
      speed: power.atbSpeed,
      role: 'attacker',
    };
  });
}
