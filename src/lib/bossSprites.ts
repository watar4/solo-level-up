import type { PixelGrid, PixelPalette } from '../components/PixelArt';

export interface BossSprite {
  grid: PixelGrid;
  palette: PixelPalette;
}

// 16×16 grids. Each character maps to a palette entry; '.' is transparent.
// Intentionally simple silhouettes — readable at a glance, theme-coherent
// with the system-window aesthetic.

const SHADOW_WOLF: BossSprite = {
  grid: [
    '................',
    '..#...........#.',
    '.##..........##.',
    '.###........###.',
    '.####.####.####.',
    '.####.####.####.',
    '.####RRRRR####..',
    '.##############.',
    '..############..',
    '..#YY######YY#..',
    '..##########..',
    '..##.####.####.',
    '..#..####..####.',
    '...........#...',
    '................',
    '................',
  ],
  palette: {
    '#': '#1a1a2a',
    'R': '#ff2244',
    'Y': '#ffcc33',
  },
};

const LICH_KING: BossSprite = {
  grid: [
    '......PPPP......',
    '.....PPPPPP.....',
    '....PPCCCCPP....',
    '....PCCCCCCP....',
    '....PCYYYYCP....',
    '....PCYRYRYC....',
    '....PCCCCCCP....',
    '....PCCCCCCP....',
    '...PPCCCCCCPP...',
    '..PPPCCCCCCPPP..',
    '..PPCCCCCCCCPP..',
    '..PPCCC##CCCPP..',
    '...PCC####CCP...',
    '...PCCC##CCCP...',
    '....PPCCCCPP....',
    '.....PP##PP.....',
  ],
  palette: {
    'P': '#3a1a4a',
    'C': '#8e7ab8',
    'Y': '#fff3a8',
    'R': '#ff3355',
    '#': '#5a3a8a',
  },
};

const IRON_GOLEM: BossSprite = {
  grid: [
    '...GGGGGGGG.....',
    '..GGGGGGGGGG....',
    '..GBBBBBBBBG....',
    '..GBRRBBRRBG....',
    '..GBBBBBBBBG....',
    '..GBBBBBBBBG....',
    'GGGGGGGGGGGGGG..',
    'GBBBGGGGGGGGBG..',
    'GBBBGGGGGGGGBG..',
    'GBBBGGGGGGGGBG..',
    'GGGGGGGGGGGGGG..',
    '..GGGGGGGGGG....',
    '..GGGG..GGGG....',
    '..GGGG..GGGG....',
    '..GGGG..GGGG....',
    '..####..####....',
  ],
  palette: {
    'G': '#666771',
    'B': '#3a3b44',
    'R': '#ff8a3a',
    '#': '#222',
  },
};

const SHADOW_ASSASSIN: BossSprite = {
  grid: [
    '................',
    '....KKKKKK......',
    '...KKKKKKKK.....',
    '...KKRRRRKK.....',
    '...KKKKKKKK.....',
    '....KKKKKK......',
    '....KKKKKK......',
    '...KKKKKKKK.....',
    '..KKKKKKKKKK....',
    '..KKKKKKKKKK....',
    '..KKKKKKKKKK....',
    '...KK.KK.KK.....',
    '...KK.KK.KK.....',
    '...##........##.',
    '..##..........##',
    '.##............##',
  ],
  palette: {
    'K': '#101013',
    'R': '#ff2255',
    '#': '#777',
  },
};

const WRAITH_KNIGHT: BossSprite = {
  grid: [
    '......CCCC......',
    '.....CCCCCC.....',
    '.....CCCCCC.....',
    '....CCWCCWCC....',
    '....CCCCCCCC....',
    '....SCCCCCCS....',
    '....SSCCCCSS....',
    '...SSSSCCSSSS...',
    '...SSSSSSSSSS...',
    '...SSSSSSSSSS...',
    '....SSSCCSSS....',
    '....##C##C##....',
    '....##.##.##....',
    '....##.##.##....',
    '....##.##.##....',
    '................',
  ],
  palette: {
    'C': '#7da9c8',
    'W': '#bce6ff',
    'S': '#3a586f',
    '#': '#222',
  },
};

const DEMONLORD: BossSprite = {
  grid: [
    '..H..........H..',
    '.HH..........HH.',
    '.HHH........HHH.',
    '..RRRR....RRRR..',
    '..RRRRRRRRRRRR..',
    '..RRYYRRYYRR....',
    '..RRYYRRYYRR....',
    '..RRRRRRRRRR....',
    '..RR......RR....',
    '.RRRRRRRRRRRR...',
    'RRRRRRRRRRRRRR..',
    'RRR##RRRR##RRR..',
    '.RR####RR####RR.',
    '..RRRRRRRRRRRR..',
    '...##......##...',
    '...##......##...',
  ],
  palette: {
    'H': '#aa3322',
    'R': '#dd3344',
    'Y': '#fff3a8',
    '#': '#5a1a22',
  },
};

const PHANTOM_STALKER: BossSprite = {
  grid: [
    '................',
    '....DDDDDD......',
    '...DDDDDDDD.....',
    '..DDDD..DDDD....',
    '..DDD....DDD....',
    '.DDD......DDD...',
    '.DDDCCCCCCDDD...',
    'DDDCCCYYCCCDDD..',
    'DDDCYRCCRYCDDD..',
    'DDDCCCCCCCCDDD..',
    'DDDDCCCCCCDDDD..',
    'DDDDDDCCDDDDDD..',
    '.DDDDDDDDDDDD...',
    '..DDDDDDDDDD....',
    '...DDDDDDDD.....',
    '....DDDDDD......',
  ],
  palette: {
    'D': '#1a1a3a',
    'C': '#8a8aaa',
    'Y': '#ffe070',
    'R': '#ff2244',
  },
};

export const BOSS_SPRITES: Record<string, BossSprite> = {
  'shadow-wolf': SHADOW_WOLF,
  'lich-king': LICH_KING,
  'iron-golem': IRON_GOLEM,
  'shadow-assassin': SHADOW_ASSASSIN,
  'wraith-knight': WRAITH_KNIGHT,
  'demonlord': DEMONLORD,
  'phantom-stalker': PHANTOM_STALKER,
};

// Fallback when a boss id has no registered sprite (defensive).
export const FALLBACK_BOSS_SPRITE: BossSprite = {
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
  palette: { '?': '#444', 'R': '#f33' },
};
