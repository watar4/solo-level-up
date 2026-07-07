import type { PixelGrid, PixelPalette } from '../../components/PixelArt';
import { ELEMENT_COLORS, type Element } from '../battle/elements';
import type { EnemyShape } from './types';

// Procedural sprite kit — composes a shape template (token grid) with an
// element palette. Shapes are drawn with primitives so every grid is a
// guaranteed 16×16 rectangle (no hand-counting rows). Tokens:
//   P primary · S shadow/dark · M light/accent · E eye-white · d pupil

const SIZE = 16;
type M = string[][];

function blank(): M {
  return Array.from({ length: SIZE }, () => Array<string>(SIZE).fill('.'));
}
function set(m: M, x: number, y: number, c: string) {
  if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) m[Math.round(y)][Math.round(x)] = c;
}
function disc(m: M, cx: number, cy: number, r: number, c: string) {
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r * r) m[y][x] = c;
    }
}
function rect(m: M, x0: number, y0: number, x1: number, y1: number, c: string) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(m, x, y, c);
}
function eyes(m: M, y: number, c = 'E', pupil = 'd') {
  set(m, 5, y, c); set(m, 6, y, pupil);
  set(m, 9, y, pupil); set(m, 10, y, c);
}
function mouth(m: M, y: number, c = 'M') {
  set(m, 6, y, c); set(m, 7, y, c); set(m, 8, y, c); set(m, 9, y, c);
}
function toGrid(m: M): PixelGrid {
  return m.map((r) => r.join(''));
}

function buildBlob(): PixelGrid {
  const m = blank();
  disc(m, 7.5, 8, 6, 'P');
  eyes(m, 7); mouth(m, 10);
  return toGrid(m);
}
function buildSlime(): PixelGrid {
  const m = blank();
  disc(m, 7.5, 9, 6.5, 'P');
  rect(m, 1, 12, 14, 13, '.'); // flatten below
  rect(m, 1, 12, 14, 12, 'P');
  eyes(m, 8); mouth(m, 10);
  return toGrid(m);
}
function buildGhost(): PixelGrid {
  const m = blank();
  disc(m, 7.5, 7, 6, 'P');
  rect(m, 2, 7, 13, 12, 'P');
  // wavy hem
  for (let x = 2; x <= 13; x++) if (x % 3 === 0) set(m, x, 12, '.');
  set(m, 2, 13, 'S'); set(m, 5, 13, 'S'); set(m, 8, 13, 'S'); set(m, 11, 13, 'S');
  eyes(m, 6);
  return toGrid(m);
}
function buildBeast(): PixelGrid {
  const m = blank();
  disc(m, 7.5, 8, 5.5, 'P');
  // ears
  rect(m, 3, 2, 4, 4, 'P'); rect(m, 11, 2, 12, 4, 'P');
  // legs
  rect(m, 3, 12, 4, 14, 'S'); rect(m, 6, 12, 7, 14, 'S');
  rect(m, 8, 12, 9, 14, 'S'); rect(m, 11, 12, 12, 14, 'S');
  eyes(m, 7); mouth(m, 9);
  return toGrid(m);
}
function buildBird(): PixelGrid {
  const m = blank();
  disc(m, 7.5, 8, 5, 'P');
  // wings
  rect(m, 1, 7, 2, 10, 'M'); rect(m, 13, 7, 14, 10, 'M');
  // beak
  set(m, 7, 11, 'M'); set(m, 8, 11, 'M'); set(m, 7, 12, 'M');
  // feet
  set(m, 6, 13, 'S'); set(m, 9, 13, 'S');
  eyes(m, 7);
  return toGrid(m);
}
function buildBug(): PixelGrid {
  const m = blank();
  disc(m, 7.5, 9, 5, 'P');
  // antennae
  set(m, 5, 2, 'S'); set(m, 5, 3, 'S'); set(m, 6, 4, 'S');
  set(m, 10, 2, 'S'); set(m, 10, 3, 'S'); set(m, 9, 4, 'S');
  // legs
  set(m, 2, 9, 'S'); set(m, 13, 9, 'S'); set(m, 2, 11, 'S'); set(m, 13, 11, 'S');
  eyes(m, 8); mouth(m, 11);
  return toGrid(m);
}
function buildGolem(): PixelGrid {
  const m = blank();
  rect(m, 3, 3, 12, 12, 'P');
  rect(m, 1, 5, 2, 10, 'P'); rect(m, 13, 5, 14, 10, 'P'); // arms
  rect(m, 4, 13, 6, 15, 'S'); rect(m, 9, 13, 11, 15, 'S'); // legs
  eyes(m, 6); mouth(m, 9);
  return toGrid(m);
}
function buildSerpent(): PixelGrid {
  const m = blank();
  disc(m, 6, 4, 3, 'P');
  disc(m, 9, 7, 3, 'P');
  disc(m, 6, 10, 3, 'P');
  disc(m, 9, 13, 3, 'P');
  set(m, 4, 3, 'E'); set(m, 7, 3, 'E');
  return toGrid(m);
}
function buildCrystal(): PixelGrid {
  const m = blank();
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      if (Math.abs(x - 7.5) + Math.abs(y - 8) <= 6) m[y][x] = 'P';
      if (Math.abs(x - 7.5) + Math.abs(y - 8) <= 3) m[y][x] = 'M';
    }
  set(m, 6, 7, 'E'); set(m, 9, 7, 'E');
  return toGrid(m);
}
function buildCat(): PixelGrid {
  const m = blank();
  disc(m, 7.5, 8, 5.5, 'P');
  // pointy ears
  set(m, 3, 2, 'P'); set(m, 3, 3, 'P'); set(m, 4, 3, 'P');
  set(m, 12, 2, 'P'); set(m, 12, 3, 'P'); set(m, 11, 3, 'P');
  // tail
  rect(m, 13, 10, 14, 13, 'M');
  eyes(m, 7); mouth(m, 10);
  return toGrid(m);
}

const SHAPE_BUILDERS: Record<EnemyShape, () => PixelGrid> = {
  blob: buildBlob, slime: buildSlime, ghost: buildGhost, beast: buildBeast,
  bird: buildBird, bug: buildBug, golem: buildGolem, serpent: buildSerpent,
  crystal: buildCrystal, cat: buildCat,
};

// Precompute the token grids once.
export const SHAPE_GRIDS: Record<EnemyShape, PixelGrid> = Object.fromEntries(
  (Object.keys(SHAPE_BUILDERS) as EnemyShape[]).map((k) => [k, SHAPE_BUILDERS[k]()])
) as Record<EnemyShape, PixelGrid>;

// ── Colour ────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
function mix(hex: string, target: number, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (target - r) * amt, g + (target - g) * amt, b + (target - b) * amt);
}

export function paletteFor(element: Element): PixelPalette {
  const base = ELEMENT_COLORS[element];
  return {
    P: base,
    S: mix(base, 0, 0.5),   // darker
    M: mix(base, 255, 0.4), // lighter
    E: '#ffffff',
    d: '#201f36',
  };
}

export function buildKitSprite(shape: EnemyShape, element: Element): { grid: PixelGrid; palette: PixelPalette } {
  return { grid: SHAPE_GRIDS[shape], palette: paletteFor(element) };
}
