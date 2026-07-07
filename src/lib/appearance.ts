import type { PixelGrid, PixelPalette } from '../components/PixelArt';
import type { HunterAppearance, HunterClass } from '../types';

// Parts-based avatar (キャラクリ v2) — a 24×24 sprite composed from skin / outfit
// / hair / eyes / accessory, each recolourable. Replaces the old 16×16
// class-only sprite. Drawn with primitives so the grid is always 24×24.

const SIZE = 24;
type Mat = string[][];

function blank(): Mat {
  return Array.from({ length: SIZE }, () => Array<string>(SIZE).fill('.'));
}
function px(m: Mat, x: number, y: number, c: string) {
  if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) m[y][x] = c;
}
function rect(m: Mat, x0: number, y0: number, x1: number, y1: number, c: string) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(m, x, y, c);
}
function disc(m: Mat, cx: number, cy: number, r: number, c: string) {
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r * r) m[y][x] = c;
    }
}

// ── Parts catalogs (ids + labels for the wizard) ──────────────────────────

export const SKINS: { id: string; hex: string }[] = [
  { id: 'fair', hex: '#f3c79b' },
  { id: 'light', hex: '#e8b389' },
  { id: 'tan', hex: '#cf9c70' },
  { id: 'brown', hex: '#a9744c' },
  { id: 'deep', hex: '#7d5236' },
  { id: 'pale', hex: '#f6d9c2' },
];

export const HAIR_STYLES: { id: string; label: string }[] = [
  { id: 'short', label: 'ショート' },
  { id: 'long', label: 'ロング' },
  { id: 'spiky', label: 'ツンツン' },
  { id: 'ponytail', label: 'ポニテ' },
  { id: 'bob', label: 'ボブ' },
  { id: 'mohawk', label: 'モヒカン' },
  { id: 'curly', label: 'くるくる' },
  { id: 'buzz', label: 'まるがり' },
];

export const HAIR_COLORS = [
  '#2a1e18', '#5a3a22', '#8a5a2a', '#c9a24b', '#d9d0c0', '#e8e2d0',
  '#2f5aa0', '#7a3ac3', '#2f8a5a', '#c0392b', '#e0559a', '#3a3a44',
];

export const EYE_STYLES: { id: string; label: string }[] = [
  { id: 'normal', label: 'ふつう' },
  { id: 'round', label: 'まるい' },
  { id: 'sharp', label: 'するどい' },
  { id: 'sleepy', label: 'ねむそう' },
];

export const EYE_COLORS = ['#3a2a1a', '#2f6ab0', '#2f8a5a', '#8a4ac3', '#c0392b', '#c9a24b', '#4a4a55', '#0f8a8a'];

// Outfit = a torso shape + default colours. Some are cosmetic unlocks.
export interface OutfitDef {
  id: string;
  label: string;
  shape: 'tunic' | 'robe' | 'armor' | 'cloak';
  primary: string;
  accent: string;
  unlock?: { kind: 'medal'; count: number } | { kind: 'chapter'; id: number } | { kind: 'achievements'; count: number };
}

export const OUTFITS: OutfitDef[] = [
  { id: 'tunic', label: '旅装', shape: 'tunic', primary: '#3a6abc', accent: '#c8d0d8' },
  { id: 'knight', label: '騎士鎧', shape: 'armor', primary: '#3a6abc', accent: '#c8d0d8' },
  { id: 'mage', label: '魔導ローブ', shape: 'robe', primary: '#7a3ac3', accent: '#dbb56a' },
  { id: 'hunter', label: '狩装束', shape: 'cloak', primary: '#2f8a3e', accent: '#8a5a2a' },
  { id: 'scout', label: '斥候装', shape: 'tunic', primary: '#222831', accent: '#a04b3e' },
  // cosmetic unlocks (earned via progress)
  { id: 'pajama', label: 'パジャマ', shape: 'robe', primary: '#7ec8e3', accent: '#ffffff', unlock: { kind: 'chapter', id: 1 } },
  { id: 'cook', label: 'コック服', shape: 'tunic', primary: '#f0f0f0', accent: '#c0392b', unlock: { kind: 'chapter', id: 4 } },
  { id: 'gold', label: '黄金装', shape: 'armor', primary: '#d9a441', accent: '#fff3a8', unlock: { kind: 'medal', count: 6 } },
  { id: 'royal', label: '王のねまき', shape: 'cloak', primary: '#3a2a6a', accent: '#ffd24a', unlock: { kind: 'medal', count: 11 } },
  { id: 'champion', label: '不屈の装', shape: 'armor', primary: '#101018', accent: '#00d4ff', unlock: { kind: 'achievements', count: 15 } },
];

export const OUTFIT_BY_ID: Record<string, OutfitDef> = Object.fromEntries(OUTFITS.map((o) => [o.id, o]));

export interface UnlockCtx {
  medals: number;
  cleared: number[];
  achievements: number;
}

export function isOutfitUnlocked(o: OutfitDef, ctx: UnlockCtx): boolean {
  if (!o.unlock) return true;
  if (o.unlock.kind === 'medal') return ctx.medals >= o.unlock.count;
  if (o.unlock.kind === 'chapter') return ctx.cleared.includes(o.unlock.id);
  if (o.unlock.kind === 'achievements') return ctx.achievements >= o.unlock.count;
  return false;
}

export function outfitUnlockLabel(o: OutfitDef): string {
  if (!o.unlock) return '';
  if (o.unlock.kind === 'medal') return `メダル${o.unlock.count}枚で解放`;
  if (o.unlock.kind === 'chapter') return `第${o.unlock.id}章クリアで解放`;
  return `実績${o.unlock.count}個で解放`;
}

export const ACCESSORIES: { id: string; label: string }[] = [
  { id: 'none', label: 'なし' },
  { id: 'glasses', label: 'メガネ' },
  { id: 'ribbon', label: 'リボン' },
  { id: 'scar', label: 'きずあと' },
  { id: 'earring', label: 'ピアス' },
  { id: 'mask', label: 'マスク' },
];

export const CLASS_DEFAULT_OUTFIT: Record<HunterClass, string> = {
  knight: 'knight', mage: 'mage', hunter: 'hunter', scout: 'scout',
};

// ── Colour helpers ─────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex(r: number, g: number, b: number) {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
function mix(hex: string, target: number, amt: number) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (target - r) * amt, g + (target - g) * amt, b + (target - b) * amt);
}

// ── Drawing ────────────────────────────────────────────────────────────────

function drawBody(m: Mat) {
  disc(m, 11.5, 8, 4.6, 'K');   // head
  px(m, 6, 8, 'K'); px(m, 17, 8, 'K'); // ears
  rect(m, 10, 12, 13, 13, 'K'); // neck
}

function drawOutfit(m: Mat, shape: OutfitDef['shape']) {
  // cape behind, drawn first
  if (shape === 'cloak') rect(m, 5, 12, 18, 21, 'A');
  // torso + arms
  if (shape === 'robe') {
    rect(m, 6, 13, 17, 22, 'P');
    rect(m, 6, 22, 17, 22, 'A');
    rect(m, 4, 13, 6, 20, 'P'); rect(m, 17, 13, 19, 20, 'P');
    px(m, 5, 20, 'K'); px(m, 18, 20, 'K'); // hands
  } else {
    rect(m, 7, 13, 16, 19, 'P');
    rect(m, 8, 13, 15, 13, 'A'); // collar
    rect(m, 5, 13, 6, 18, 'P'); rect(m, 17, 13, 18, 18, 'P'); // arms
    rect(m, 5, 18, 6, 19, 'K'); rect(m, 17, 18, 18, 19, 'K'); // hands
    rect(m, 8, 20, 10, 23, 'A'); rect(m, 13, 20, 15, 23, 'A'); // legs/pants
  }
  if (shape === 'armor') {
    rect(m, 4, 12, 6, 14, 'A'); rect(m, 17, 12, 19, 14, 'A'); // shoulder pads
    rect(m, 10, 14, 13, 17, 'A'); // chest plate
  }
}

function drawEyes(m: Mat, style: string) {
  const lx = 9, rx = 14, y = 8;
  if (style === 'sleepy') {
    px(m, lx, y, 'M'); px(m, lx + 1, y, 'M'); px(m, rx - 1, y, 'M'); px(m, rx, y, 'M');
  } else if (style === 'round') {
    px(m, lx, y, 'W'); px(m, lx, y, 'E'); px(m, lx - 1, y, 'W'); px(m, rx, y, 'E'); px(m, rx + 1, y, 'W');
    px(m, lx, y - 1, 'W'); px(m, rx, y - 1, 'W');
  } else if (style === 'sharp') {
    px(m, lx + 1, y, 'E'); px(m, rx - 1, y, 'E'); px(m, lx, y, 'M'); px(m, rx, y, 'M');
  } else {
    px(m, lx, y, 'E'); px(m, rx, y, 'E');
  }
  px(m, 11, 10, 'M'); px(m, 12, 10, 'M'); // mouth
}

function drawHair(m: Mat, style: string) {
  const crown = () => rect(m, 7, 4, 16, 6, 'H');
  switch (style) {
    case 'buzz':
      rect(m, 8, 4, 15, 5, 'H');
      break;
    case 'short':
      crown(); px(m, 7, 7, 'H'); px(m, 16, 7, 'H'); px(m, 8, 3, 'H'); px(m, 15, 3, 'H');
      break;
    case 'long':
      crown();
      rect(m, 6, 4, 7, 14, 'H'); rect(m, 16, 4, 17, 14, 'H');
      rect(m, 8, 3, 15, 3, 'H');
      break;
    case 'spiky':
      crown();
      px(m, 8, 2, 'H'); px(m, 10, 1, 'H'); px(m, 12, 1, 'H'); px(m, 14, 2, 'H');
      px(m, 9, 3, 'H'); px(m, 11, 2, 'H'); px(m, 13, 2, 'H');
      break;
    case 'ponytail':
      crown(); px(m, 7, 7, 'H');
      rect(m, 17, 5, 18, 12, 'H'); px(m, 18, 12, 'h');
      break;
    case 'bob':
      crown(); rect(m, 6, 4, 7, 11, 'H'); rect(m, 16, 4, 17, 11, 'H'); rect(m, 8, 3, 15, 3, 'H');
      break;
    case 'mohawk':
      rect(m, 11, 1, 12, 6, 'H'); px(m, 10, 2, 'H'); px(m, 13, 2, 'H');
      rect(m, 8, 5, 15, 6, 'h');
      break;
    case 'curly':
      crown(); px(m, 6, 4, 'H'); px(m, 7, 3, 'H'); px(m, 9, 3, 'H'); px(m, 11, 2, 'H');
      px(m, 13, 3, 'H'); px(m, 15, 3, 'H'); px(m, 17, 4, 'H'); px(m, 6, 6, 'H'); px(m, 17, 6, 'H');
      break;
    default:
      crown();
  }
}

function drawAccessory(m: Mat, id: string) {
  switch (id) {
    case 'glasses':
      rect(m, 8, 8, 10, 8, 'G'); rect(m, 13, 8, 15, 8, 'G'); px(m, 11, 8, 'G'); px(m, 12, 8, 'G');
      break;
    case 'ribbon':
      px(m, 9, 3, 'R'); px(m, 10, 3, 'R'); px(m, 13, 3, 'R'); px(m, 14, 3, 'R'); px(m, 11, 3, 'R'); px(m, 12, 3, 'R');
      px(m, 10, 2, 'R'); px(m, 13, 2, 'R');
      break;
    case 'scar':
      px(m, 14, 7, 'X'); px(m, 14, 8, 'X'); px(m, 15, 9, 'X');
      break;
    case 'earring':
      px(m, 6, 10, 'R'); px(m, 17, 10, 'R');
      break;
    case 'mask':
      rect(m, 8, 9, 15, 11, 'A');
      break;
    default:
      break;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export interface RenderedAvatar {
  grid: PixelGrid;
  palette: PixelPalette;
}

export function normalizeAppearance(a: HunterAppearance): Required<HunterAppearance> {
  const cls = a.hunterClass ?? 'knight';
  return {
    hunterClass: cls,
    primaryColor: a.primaryColor ?? '#3a6abc',
    accentColor: a.accentColor ?? '#c8d0d8',
    skin: a.skin ?? SKINS[0].hex,
    hair: a.hair ?? 'short',
    hairColor: a.hairColor ?? HAIR_COLORS[1],
    eyes: a.eyes ?? 'normal',
    eyeColor: a.eyeColor ?? EYE_COLORS[0],
    outfit: a.outfit ?? CLASS_DEFAULT_OUTFIT[cls],
    accessory: a.accessory ?? 'none',
  };
}

export function renderAvatar(appearance: HunterAppearance): RenderedAvatar {
  const a = normalizeAppearance(appearance);
  const outfit = OUTFIT_BY_ID[a.outfit] ?? OUTFIT_BY_ID.tunic;
  const m = blank();
  drawBody(m);
  drawOutfit(m, outfit.shape);
  drawHair(m, a.hair);
  drawEyes(m, a.eyes);
  drawAccessory(m, a.accessory);

  const palette: PixelPalette = {
    K: a.skin,
    k: mix(a.skin, 0, 0.2),
    H: a.hairColor,
    h: mix(a.hairColor, 0, 0.3),
    P: a.primaryColor,
    A: a.accentColor,
    W: '#ffffff',
    E: a.eyeColor,
    M: mix(a.skin, 0, 0.4),
    G: '#26262e',
    R: mix(a.accentColor, 255, 0.15),
    X: '#3a1520',
  };
  return { grid: m.map((r) => r.join('')), palette };
}

// ── Defaults / migration / randomization ─────────────────────────────────

export const DEFAULT_APPEARANCE_V2: HunterAppearance = {
  hunterClass: 'knight',
  primaryColor: '#3a6abc',
  accentColor: '#c8d0d8',
  skin: SKINS[0].hex,
  hair: 'short',
  hairColor: HAIR_COLORS[1],
  eyes: 'normal',
  eyeColor: EYE_COLORS[0],
  outfit: 'knight',
  accessory: 'none',
};

// Upgrade a legacy (class + 2 colors) appearance to the full v2 parts model.
export function migrateAppearance(old: HunterAppearance | undefined): HunterAppearance {
  if (!old) return { ...DEFAULT_APPEARANCE_V2 };
  if (old.hair) return old; // already v2
  return {
    ...DEFAULT_APPEARANCE_V2,
    hunterClass: old.hunterClass,
    primaryColor: old.primaryColor,
    accentColor: old.accentColor,
    outfit: CLASS_DEFAULT_OUTFIT[old.hunterClass] ?? 'tunic',
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function randomAppearance(hunterClass: HunterClass, rng: () => number = Math.random): HunterAppearance {
  const outfit = OUTFIT_BY_ID[CLASS_DEFAULT_OUTFIT[hunterClass]];
  return {
    hunterClass,
    primaryColor: outfit.primary,
    accentColor: outfit.accent,
    skin: pick(SKINS, rng).hex,
    hair: pick(HAIR_STYLES, rng).id,
    hairColor: pick(HAIR_COLORS, rng),
    eyes: pick(EYE_STYLES, rng).id,
    eyeColor: pick(EYE_COLORS, rng),
    outfit: CLASS_DEFAULT_OUTFIT[hunterClass],
    accessory: pick(ACCESSORIES, rng).id,
  };
}
