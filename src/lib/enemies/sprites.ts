import type { PixelGrid, PixelPalette } from '../../components/PixelArt';

// Enemy sprites (Daramon) — docs/redesign/06-boss-design.md §2. Cute, harmless
// silhouettes; main colour follows the enemy's element so affinity reads at a
// glance. Grids are 16×16; lords are simply rendered at a larger pixel size in
// the battle scene for presence.

export interface EnemySprite {
  grid: PixelGrid;
  palette: PixelPalette;
}

const NEMUKEDAMA: EnemySprite = {
  grid: [
    '................',
    '......PPPP......',
    '....PPPPPPPP....',
    '...PPPPPPPPPP...',
    '..PPPPPPPPPPPP..',
    '..PPPPPPPPPPPP..',
    '..PPddPPPPddPP..',
    '..PPPPPPPPPPPP..',
    '..PPPPPPPPPPPP..',
    '...PPPmmmmPPP...',
    '..PPPPPPPPPPPP..',
    '...PPPPPPPPPP...',
    '....PPPPPPPP....',
    '......PPPP......',
    '..............z.',
    '.............z..',
  ],
  palette: { P: '#9b6be0', d: '#33235a', m: '#c9a7f2', z: '#ffffff' },
};

const YUMEUSAGI: EnemySprite = {
  grid: [
    '................',
    '...P........P...',
    '...P........P...',
    '...PP......PP...',
    '...PPP....PPP...',
    '....PPPPPPPP....',
    '...PPPPPPPPPP...',
    '..PPPPPPPPPPPP..',
    '..PPeePPPPeePP..',
    '..PPPPPnnPPPPP..',
    '..PPPPPPPPPPPP..',
    '..PPPPPPPPPPPP..',
    '...PPPPPPPPPP...',
    '....PPP..PPP....',
    '...PP......PP...',
    '................',
  ],
  palette: { P: '#4bbf6b', e: '#ffffff', n: '#ffb0c0' },
};

const MAKURAGANI: EnemySprite = {
  grid: [
    '................',
    '.P.P......P.P...',
    '.PPPP....PPPP...',
    '..PPPP..PPPP....',
    '...wwwwwwwww....',
    '..wwwwwwwwwww...',
    '..PPPPPPPPPPP...',
    '..PPddPPPPddP...',
    '..PPPPPPPPPPP...',
    '..PPPPPPPPPPP...',
    '..PPPPPPPPPPP...',
    '...PPPPPPPPP....',
    '..P..P..P..P....',
    '.P...P..P...P...',
    '................',
    '................',
  ],
  palette: { P: '#d9a441', d: '#8a5a10', w: '#f4ead2' },
};

const FUTON_GOLEM: EnemySprite = {
  grid: [
    '................',
    '..ffffffffffff..',
    '.ffffffffffffff.',
    '.fPPPPPPPPPPPPf.',
    '.fPddPPPPPPddPf.',
    '.fPPPPPPPPPPPPf.',
    '.fPPPPmmmmPPPPf.',
    '.fPPPPPPPPPPPPf.',
    '.fPPPPPPPPPPPPf.',
    '.ffffffffffffff.',
    '.fPPPPPPPPPPPPf.',
    '.fPPPPPPPPPPPPf.',
    '.ffffffffffffff.',
    '..PP........PP..',
    '..PP........PP..',
    '................',
  ],
  palette: { P: '#c9922f', d: '#5a3a0a', m: '#7a5410', f: '#e8c37a' },
};

const SUYARIN: EnemySprite = {
  grid: [
    '................',
    '.......ttt......',
    '......ccccc.....',
    '.....ccccccc....',
    '....PPPPPPPPP...',
    '...PPPPPPPPPPP..',
    '..PPPPfffffPPP..',
    '..PPPfddfddfP...',
    '..PPPfffffffP...',
    '..PPPPfmmmfPP...',
    '...PPPPPPPPPP...',
    '..PPPPPPPPPPPP..',
    '..PPPPPPPPPPPP..',
    '...PP.PP.PP.P...',
    '...P...P..P.P...',
    '................',
  ],
  palette: {
    P: '#b98fe6', d: '#33235a', c: '#5a3aa0', t: '#ffd24a',
    f: '#f0d5b0', m: '#a05a8a',
  },
};

export const ENEMY_SPRITES: Record<string, EnemySprite> = {
  nemukedama: NEMUKEDAMA,
  yumeusagi: YUMEUSAGI,
  makuragani: MAKURAGANI,
  'futon-golem': FUTON_GOLEM,
  suyarin: SUYARIN,
};

export const FALLBACK_ENEMY_SPRITE: EnemySprite = {
  grid: [
    '................',
    '....????????....',
    '...??????????...',
    '...??......??...',
    '...??.RR.RR.??..',
    '...??.RR.RR.??..',
    '...??......??...',
    '...??...??..??..',
    '...??..??...??..',
    '...??...??..??..',
    '...??......??...',
    '...???????????..',
    '....????????....',
    '................',
    '................',
    '................',
  ],
  palette: { '?': '#555', R: '#f33' },
};

export function enemySprite(id: string): EnemySprite {
  return ENEMY_SPRITES[id] ?? FALLBACK_ENEMY_SPRITE;
}
