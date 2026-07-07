import { describe, it, expect } from 'vitest';
import type { Character, StatKey } from '../../../types';
import { CHAPTERS } from '../chapters';
import { REGIONS, regionFor } from '../regions';
import { getDialogue } from '../dialogue';
import { ALL_ENEMIES, getEnemy } from '../../enemies/registry';
import { spriteFor } from '../../enemies/sprites';
import { SHAPE_GRIDS } from '../../enemies/spriteKit';
import { ELEMENTS } from '../../battle/elements';
import { buildPlayerConfig } from '../../battle/loadout';
import { createBattle, advance, playerAction, type BattleState } from '../../battle/engine';

describe('campaign content integrity (chapters 1-12)', () => {
  it('every chapter has a region', () => {
    for (const ch of CHAPTERS) expect(regionFor(ch.id), `region ${ch.id}`).toBeDefined();
  });

  it('every region node references real enemies / existing dialogue', () => {
    for (const region of Object.values(REGIONS)) {
      for (const node of region.nodes) {
        if (node.kind === 'event') {
          expect(getDialogue(node.dialogueId).length, `dialogue ${node.dialogueId}`).toBeGreaterThan(0);
        } else {
          expect(getEnemy(node.enemyId), `enemy ${node.enemyId}`).toBeDefined();
        }
      }
    }
  });

  it('each chapter lord id matches a lord enemy and the region lord node', () => {
    for (const ch of CHAPTERS) {
      const lord = getEnemy(ch.lordId);
      expect(lord, `lord ${ch.lordId}`).toBeDefined();
      expect(['lord', 'king']).toContain(lord!.tier);
      expect(lord!.chapter).toBe(ch.id);
      const region = regionFor(ch.id)!;
      const lordNode = region.nodes.find((n) => n.kind === 'lord');
      expect(lordNode && 'enemyId' in lordNode && lordNode.enemyId).toBe(ch.lordId);
    }
  });

  it('each chapter has a lord-clear dialogue', () => {
    for (const ch of CHAPTERS) {
      expect(getDialogue(`ch${ch.id}-lord-clear`).length, `ch${ch.id}-lord-clear`).toBeGreaterThan(0);
    }
  });

  it('every enemy is well-formed and has a resolvable, rectangular sprite', () => {
    expect(ALL_ENEMIES.length).toBeGreaterThanOrEqual(55);
    const ids = new Set<string>();
    for (const e of ALL_ENEMIES) {
      expect(ids.has(e.id), `duplicate id ${e.id}`).toBe(false);
      ids.add(e.id);
      expect(ELEMENTS).toContain(e.element);
      expect(e.moves.length, `${e.id} moves`).toBeGreaterThan(0);
      const sprite = spriteFor(e);
      const w = sprite.grid[0].length;
      expect(sprite.grid.length).toBeGreaterThan(0);
      for (const row of sprite.grid) expect(row.length, `${e.id} sprite row width`).toBe(w);
    }
  });

  it('no non-lord enemy carries a phase2-conditioned move (it would never fire)', () => {
    // Only lords get phases:2 from the factory; a phase2 condition on a mob or
    // elite is dead content (this caught ch12's ネボスケリオン).
    for (const e of ALL_ENEMIES) {
      if (e.tier === 'lord' || e.tier === 'king') continue;
      const dead = e.moves.filter((m) => m.condition === 'phase2');
      expect(dead, `${e.id} has phase2-gated moves but ${e.tier}s never reach phase 2`).toHaveLength(0);
    }
  });

  it('all kit shape grids are 16×16', () => {
    for (const [name, grid] of Object.entries(SHAPE_GRIDS)) {
      expect(grid.length, `${name} height`).toBe(16);
      for (const row of grid) expect(row.length, `${name} width`).toBe(16);
    }
  });

  it('a maxed hunter can defeat every chapter lord (no gimmick crashes / hard walls)', () => {
    const stats: Record<StatKey, number> = { STR: 99, AGI: 60, INT: 60, VIT: 99, PER: 80 };
    const character: Character = {
      uid: 't', name: '英雄', level: 60, exp: 0, totalExp: 0, stats,
      statPoints: 0, createdAt: 0, lastSeenAt: 0,
      appearance: { hunterClass: 'knight', primaryColor: '#fff', accentColor: '#000' },
    };
    const cfg = buildPlayerConfig(character, stats, []);

    for (const ch of CHAPTERS) {
      const lord = getEnemy(ch.lordId)!;
      let s: BattleState = createBattle({ player: cfg, shadows: [], enemy: lord });
      for (let i = 0; i < 8000 && s.phase !== 'won' && s.phase !== 'lost'; i++) {
        if (s.phase === 'ticking') s = advance(s, 5, cfg).state;
        else if (s.phase === 'awaiting-input') {
          const per = cfg.skills.find((sk) => sk.kind === 'attack' && sk.stat === 'PER');
          const cd = per ? s.player.cooldowns[per.id] ?? 0 : 1;
          s = per && cd === 0
            ? playerAction(s, { kind: 'skill', skillId: per.id }, cfg).state
            : playerAction(s, { kind: 'attack' }, cfg).state;
        }
      }
      expect(s.phase, `lord ${ch.lordId} (ch${ch.id})`).toBe('won');
    }
  });
});
