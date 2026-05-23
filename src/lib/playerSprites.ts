import type { PixelGrid, PixelPalette } from '../components/PixelArt';
import type { HunterClass } from '../types';

// Player sprites are built from a base body silhouette per class, plus a
// recolour layer driven by the user-chosen primary/accent colors. The 'P'
// pixels become the primary color, 'A' the accent. Other palette entries are
// fixed (skin, eyes, weapon metal).

export interface ClassSpriteTemplate {
  grid: PixelGrid;
  basePalette: PixelPalette;
  preview: { primary: string; accent: string };
  label: string;
  jp: string;
  blurb: string;
}

const SKIN = '#f3c79b';
const SKIN_DARK = '#cf9c70';
const HAIR = '#3a2820';
const STEEL = '#c8d0d8';
const EYE = '#1a1a1a';

const KNIGHT_GRID: PixelGrid = [
  '................',
  '......AAAA......',
  '.....AAAAAA.....',
  '.....HHHHHH.....',
  '....HSSSSSSH....',
  '....HSEESEH.....',
  '.....HSSSSH.....',
  '....AAAAAAAA....',
  '....APPPPPPA....',
  'SSSAAPPPPPPAASS.',
  'SSAAAPPSSPPAAASS',
  '..AAAPPSSPPAAA..',
  '...APPPPPPPPA...',
  '....PPPP.PPPP...',
  '....PPPP.PPPP...',
  '....HHHH.HHHH...',
];
const KNIGHT_PALETTE: PixelPalette = {
  S: SKIN,
  E: EYE,
  H: HAIR,
  P: '#3a6abc', // primary placeholder, overwritten per-render
  A: STEEL,
  '#': '#222',
};

const MAGE_GRID: PixelGrid = [
  '........SS......',
  '.......SSSS.....',
  '......SSSSSS....',
  '......SHHHS.....',
  '.....AHEEEHA....',
  '....AAAHSHAAA...',
  '....AAAAAAAA....',
  '...APPPPPPPPA...',
  '...PPPPPPPPPP...',
  '..PPP##PP##PPP..',
  '..PPPPPPPPPPPP..',
  '..APPPPPPPPPPA..',
  '...AAAAAAAAAA...',
  '....AAA..AAA....',
  '....HHH..HHH....',
  '................',
];
const MAGE_PALETTE: PixelPalette = {
  S: SKIN,
  E: EYE,
  H: HAIR,
  P: '#7a3ac3',
  A: '#dbb56a', // accent (sash/staff trim)
  '#': '#ffdf66',
};

const HUNTER_GRID: PixelGrid = [
  '................',
  '......AAAA......',
  '.....AHHHHA.....',
  '....AHHHHHHA....',
  '....HSSSSSSH....',
  '....HSEESEH.....',
  '.....SSSSS......',
  '....AAAAAAAA....',
  '...APPPPPPPPA...',
  '...PPPPPPPPPP...',
  '..APPSSPPSSPPA..',
  '..APPSSPPSSPPA..',
  '...PPPPPPPPP....',
  '...PPP....PPP...',
  '...PPP....PPP...',
  '...##.....##....',
];
const HUNTER_PALETTE: PixelPalette = {
  S: SKIN_DARK,
  E: EYE,
  H: HAIR,
  P: '#2f8a3e',
  A: '#8a5a2a',
  '#': '#222',
};

const SCOUT_GRID: PixelGrid = [
  '................',
  '......AAAA......',
  '.....AAAAAA.....',
  '....AAAAAAAA....',
  '....ASSSSSSSA...',
  '....ASEE.SEA....',
  '....AASSSSAA....',
  '...AAPPPPPPAA...',
  '...APPPPPPPPA...',
  '..AAPPPPPPPPAA..',
  '..AAPPAAAAPPAA..',
  '...APP.AA.PPA...',
  '...PPP.AA.PPP...',
  '...PP..AA..PP...',
  '...PP......PP...',
  '...##......##...',
];
const SCOUT_PALETTE: PixelPalette = {
  S: SKIN,
  E: EYE,
  P: '#222831',
  A: '#a04b3e',
  '#': '#333',
};

export const CLASS_TEMPLATES: Record<HunterClass, ClassSpriteTemplate> = {
  knight: {
    grid: KNIGHT_GRID,
    basePalette: KNIGHT_PALETTE,
    preview: { primary: '#3a6abc', accent: '#c8d0d8' },
    label: 'KNIGHT',
    jp: '剣士',
    blurb: '正面突破型。STR/VITに馴染む',
  },
  mage: {
    grid: MAGE_GRID,
    basePalette: MAGE_PALETTE,
    preview: { primary: '#7a3ac3', accent: '#dbb56a' },
    label: 'MAGE',
    jp: '魔導師',
    blurb: 'クリ特化。INT/PERで魔力を引き出す',
  },
  hunter: {
    grid: HUNTER_GRID,
    basePalette: HUNTER_PALETTE,
    preview: { primary: '#2f8a3e', accent: '#8a5a2a' },
    label: 'HUNTER',
    jp: '狩人',
    blurb: '見切り型。AGI/PERで先手必勝',
  },
  scout: {
    grid: SCOUT_GRID,
    basePalette: SCOUT_PALETTE,
    preview: { primary: '#222831', accent: '#a04b3e' },
    label: 'SCOUT',
    jp: '斥候',
    blurb: '速攻型。AGIで連撃を叩き込む',
  },
};

export interface RenderedSprite {
  grid: PixelGrid;
  palette: PixelPalette;
}

// Bind a class template to specific primary/accent colors. Use this when
// rendering a saved Character (or live preview) inside PixelArt.
export function renderClassSprite(
  hunterClass: HunterClass,
  primaryColor: string,
  accentColor: string
): RenderedSprite {
  const tpl = CLASS_TEMPLATES[hunterClass];
  return {
    grid: tpl.grid,
    palette: { ...tpl.basePalette, P: primaryColor, A: accentColor },
  };
}

// Curated color presets so the picker has nice options out of the box.
export const PRIMARY_COLORS = [
  '#3a6abc', // blue
  '#7a3ac3', // purple
  '#2f8a3e', // green
  '#a04b3e', // rust
  '#c08a2a', // gold
  '#cd2e4c', // crimson
  '#222831', // black
  '#5fc9ff', // cyan
];
export const ACCENT_COLORS = [
  '#c8d0d8', // silver
  '#dbb56a', // gold trim
  '#8a5a2a', // bronze
  '#a04b3e', // rust
  '#3a6abc', // blue
  '#5fc9ff', // cyan
  '#fff3a8', // ivory
  '#7a3ac3', // purple
];

// Sensible default for legacy users who never picked an appearance.
export const DEFAULT_APPEARANCE: {
  hunterClass: HunterClass;
  primaryColor: string;
  accentColor: string;
} = {
  hunterClass: 'knight',
  primaryColor: '#3a6abc',
  accentColor: '#c8d0d8',
};
