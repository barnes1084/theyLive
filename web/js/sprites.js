// 8-bit pixel art. Sprites are drawn as text grids, one character per pixel,
// and colored by a palette, so one body template serves every character.
// Everything faces right; sprites are mirrored when facing left.

export const COLORS = {
  black: '#000000',
  white: '#fcfcfc',
  skin: '#fcb878',
  skin2: '#c87848',
  skin3: '#8c5030',
  green: '#00a844',
  darkGreen: '#005800',
  lime: '#58d854',
  yellow: '#f8d800',
  orange: '#f87800',
  red: '#d82800',
  darkRed: '#a80020',
  blue: '#0058f8',
  navy: '#0000a8',
  purple: '#6844fc',
  brown: '#7c3c00',
  tan: '#ac7c00',
  gray: '#7c7c7c',
  lightGray: '#bcbcbc',
  darkGray: '#3c3c3c',
  sky: '#3cbcfc',
};

const C = COLORS;

// ---------- Body parts (12 px wide) ----------

const HEAD_HUMAN = [
  '....hhhh....',
  '...hhhhhhh..',
  '..Hhhsssss..',
  '..Hhsssesss.',
  '..Hhssssss..',
  '..H.sssss...',
  '.....sss....',
];

const HEAD_CAP = [
  '...cccccc...',
  '..ccccccccc.',
  '...hsssss...',
  '...hssesss..',
  '...hsssss...',
  '....sssss...',
  '.....sss....',
];

const HEAD_LIZARD = [
  '...gggg.....',
  '..gggggg....',
  '.ggggggggg..',
  '.gggggyegg..',
  '.gggggggggg.',
  '.gggggmmmm..',
  '....ggg.....',
];

const HEAD_PLAYER = [
  '...yyyyy....',
  '..yyyyyyy...',
  '.yyyyyyyyyy.',
  '...hssssss..',
  '...hsssesss.',
  '...hssssss..',
  '....ssss....',
];

const HEAD_PLAYER_SHADES = [
  '...yyyyy....',
  '..yyyyyyy...',
  '.yyyyyyyyyy.',
  '...hssssss..',
  '...hssEEEEE.',
  '...hssssss..',
  '....ssss....',
];

const TORSO = [
  '...ttkttt...',
  '..tttktttt..',
  '..tttktttt..',
  '..tttktttt..',
  '..tttttttt..',
  '..sbbbbbbs..',
  '...pppppp...',
];

const TORSO_PLAYER = [
  '...vvvvvv...',
  '..vvvvvvvv..',
  '..rrrrrrrr..',
  '..vvvvvvvv..',
  '..vvvvvvvv..',
  '..gbbbbbbg..',
  '...pppppp...',
];

const LEGS = {
  stand: [
    '...pppppp...',
    '...pp..pp...',
    '...pp..pp...',
    '...pp..pp...',
    '...pp..pp...',
    '...pp..pp...',
    '...ff..fff..',
    '...fff.ffff.',
  ],
  walk1: [
    '...pppppp...',
    '..ppp..ppp..',
    '..pp....pp..',
    '.pp......pp.',
    '.pp......pp.',
    'pp........pp',
    'ff........ff',
    'fff......fff',
  ],
  walk2: [
    '...pppppp...',
    '....pppp....',
    '....pppp....',
    '....ppp.....',
    '....ppp.....',
    '....ppp.....',
    '....ffff....',
    '....fffff...',
  ],
  jump: [
    '...pppppp...',
    '..pppppppp..',
    '..pp...ppp..',
    '..pp....pp..',
    '..ff....ff..',
    '..fff...fff.',
    '............',
    '............',
  ],
  crouch: ['..pppppppp..', '.ppp....ppp.', '.fff....ffff'],
};

/** Full 12 x 22 body (or 12 x 16 crouching). */
function body(head, torso, legs) {
  if (legs === 'crouch') return [...head, ...torso.slice(0, 6), ...LEGS.crouch];
  return [...head, ...torso, ...LEGS[legs]];
}

// ---------- Palettes ----------

// Civilian looks. Disguised lizards borrow these too.
export const LOOKS = [
  { h: C.brown, s: C.skin, t: C.red, k: C.red, b: C.brown, p: C.blue, f: C.darkGray },
  { h: C.black, s: C.skin, t: C.white, k: C.darkRed, b: C.black, p: C.darkGray, f: C.black },
  { h: C.black, s: C.skin2, t: C.navy, k: C.yellow, b: C.black, p: C.navy, f: C.black, cap: true, c: C.navy },
  { h: C.yellow, H: C.yellow, s: C.skin, t: C.purple, k: C.purple, b: C.purple, p: C.black, f: C.red },
  { h: C.black, H: C.black, s: C.skin3, t: C.green, k: C.lime, b: C.brown, p: C.tan, f: C.brown },
  { h: C.lightGray, s: C.skin2, t: C.tan, k: C.brown, b: C.brown, p: C.gray, f: C.black },
];

const LIZARD_SKIN = { g: C.green, y: C.yellow, e: C.black, m: C.darkRed };

/** A lizard in its own skin, as seen in the tunnels. */
const LIZARD_BODY = { ...LIZARD_SKIN, s: C.green, t: C.green, k: C.lime, b: C.darkGreen, p: C.darkGreen, f: C.lime };

const PLAYER = { y: C.yellow, h: C.brown, s: C.skin, e: C.black, E: C.black, v: C.orange, r: C.white, g: C.tan, b: C.brown, p: C.blue, f: C.brown };

// ---------- Rendering and caching ----------

const cache = new Map();

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Rasterizes a text grid with a palette, optionally mirrored. */
export function rasterize(rows, palette, flip = false) {
  const w = rows[0].length;
  const h = rows.length;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const color = palette[rows[y][x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(flip ? w - 1 - x : x, y, 1, 1);
    }
  }
  return canvas;
}

function cached(key, build) {
  let s = cache.get(key);
  if (!s) {
    s = build();
    cache.set(key, s);
  }
  return s;
}

/**
 * A person sprite.
 *   kind: 'civilian' | 'disguised' (lizard head, civilian clothes) | 'lizard'
 *   pose: 'stand' | 'walk1' | 'walk2' | 'jump' | 'crouch'
 */
export function personSprite(kind, look, pose, flip) {
  return cached(`p:${kind}:${look}:${pose}:${flip}`, () => {
    if (kind === 'lizard') return rasterize(body(HEAD_LIZARD, TORSO, pose), LIZARD_BODY, flip);
    const l = LOOKS[look];
    if (kind === 'disguised') return rasterize(body(HEAD_LIZARD, TORSO, pose), { ...l, ...LIZARD_SKIN, s: C.green }, flip);
    return rasterize(body(l.cap ? HEAD_CAP : HEAD_HUMAN, TORSO, pose), { ...l, e: C.black }, flip);
  });
}

export function playerSprite(pose, shades, flip) {
  return cached(`pl:${pose}:${shades}:${flip}`, () =>
    rasterize(body(shades ? HEAD_PLAYER_SHADES : HEAD_PLAYER, TORSO_PLAYER, pose), PLAYER, flip),
  );
}

/** The boss: a big lizard in a suit. Drawn at 3x scale by the renderer. */
export function bossSprite(flash) {
  return cached(`boss:${flash}`, () => {
    const suit = { ...LIZARD_SKIN, s: C.green, t: C.black, k: C.red, b: C.black, p: C.black, f: C.darkGray };
    const pal = flash ? Object.fromEntries(Object.keys(suit).map((k) => [k, C.white])) : suit;
    return rasterize(body(HEAD_LIZARD, TORSO, 'stand'), pal, true);
  });
}

// ---------- Small icons ----------

const ICONS = {
  heart: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
  heartEmpty: ['.##.##.', '#..#..#', '#.....#', '.#...#.', '..#.#..', '...#...'],
  hat: ['..####..', '.######.', '.######.', '########'],
  shades: ['#########', '###.#.###', '.##...##.'],
};

export function icon(name, color) {
  return cached(`i:${name}:${color}`, () => rasterize(ICONS[name], { '#': color }));
}

// ---------- Tiles (16 x 16, drawn procedurally) ----------

function tileCanvas(draw) {
  const c = makeCanvas(16, 16);
  const ctx = c.getContext('2d');
  const px = (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  draw(px);
  return c;
}

/**
 * kind: area kind. tile: T.* code. top: whether the tile is the surface.
 * frame: animation frame for sludge.
 */
export function tileSprite(kind, tile, top, frame = 0) {
  return cached(`t:${kind}:${tile}:${top}:${frame}`, () =>
    tileCanvas((px) => {
      if (tile === 1) {
        if (kind === 'city') {
          px(0, 0, 16, 16, '#5c4020');
          for (let i = 0; i < 6; i++) px((i * 7 + 3) % 15, (i * 5 + 2) % 14 + 1, 2, 1, '#3c2810');
          if (top) {
            px(0, 0, 16, 5, C.lightGray);
            px(0, 0, 16, 1, C.white);
            px(0, 4, 16, 1, C.gray);
            px(7, 1, 1, 3, C.gray);
            px(15, 1, 1, 3, C.gray);
          }
        } else if (kind === 'tunnel') {
          px(0, 0, 16, 16, '#2c2c48');
          px(0, 7, 16, 1, '#1c1c30');
          px(0, 15, 16, 1, '#1c1c30');
          px(4, 0, 1, 7, '#1c1c30');
          px(12, 8, 1, 7, '#1c1c30');
          if (top) {
            px(0, 0, 16, 3, C.darkGreen);
            px(2, 3, 2, 1, C.darkGreen);
            px(9, 3, 3, 2, C.darkGreen);
            px(0, 0, 16, 1, C.green);
          }
        } else {
          px(0, 0, 16, 16, '#241848');
          px(0, 0, 16, 1, C.purple);
          px(0, 8, 16, 1, '#3c2878');
          px(7, 0, 2, 16, '#3c2878');
          if (top) px(0, 0, 16, 2, '#9878f8');
        }
      } else if (tile === 2) {
        const bar = kind === 'city' ? C.orange : C.gray;
        const dark = kind === 'city' ? C.red : C.darkGray;
        px(0, 0, 16, 2, bar);
        px(0, 5, 16, 1, dark);
        for (let x = 0; x < 16; x += 4) {
          px(x, 2, 1, 3, dark);
          px(x + 2, 2, 1, 3, bar);
        }
      } else if (tile === 3) {
        px(0, 0, 16, 16, C.tan);
        px(0, 0, 16, 1, C.yellow);
        px(0, 15, 16, 1, C.brown);
        px(0, 0, 1, 16, C.brown);
        px(15, 0, 1, 16, C.brown);
        px(1, 5, 14, 1, C.brown);
        px(1, 10, 14, 1, C.brown);
        for (let i = 1; i < 15; i++) px(i, i, 1, 1, C.brown);
      } else if (tile === 4) {
        px(0, 0, 16, 16, '#005800');
        for (let x = 0; x < 16; x++) {
          const y = Math.round(2 + Math.sin((x + frame * 2) * 0.8) * 1.5);
          px(x, y, 1, 2, C.lime);
        }
        px((frame * 5) % 16, 8, 2, 2, C.lime);
        px((frame * 3 + 9) % 16, 12, 1, 1, C.lime);
      }
    }),
  );
}

// ---------- 3 x 5 pixel font ----------

// Each glyph is five rows of three pixels.
const FONT = `
A .#. #.# ### #.# #.#
B ##. #.# ##. #.# ##.
C .## #.. #.. #.. .##
D ##. #.# #.# #.# ##.
E ### #.. ##. #.. ###
F ### #.. ##. #.. #..
G .## #.. #.# #.# .##
H #.# #.# ### #.# #.#
I ### .#. .#. .#. ###
J ..# ..# ..# #.# .#.
K #.# #.# ##. #.# #.#
L #.. #.. #.. #.. ###
M #.# ### ### #.# #.#
N ##. #.# #.# #.# #.#
O .#. #.# #.# #.# .#.
P ##. #.# ##. #.. #..
Q .#. #.# #.# ##. .##
R ##. #.# ##. #.# #.#
S .## #.. .#. ..# ##.
T ### .#. .#. .#. .#.
U #.# #.# #.# #.# ###
V #.# #.# #.# #.# .#.
W #.# #.# ### ### #.#
X #.# #.# .#. #.# #.#
Y #.# #.# .#. .#. .#.
Z ### ..# .#. #.. ###
0 ### #.# #.# #.# ###
1 .#. ##. .#. .#. ###
2 ##. ..# .#. #.. ###
3 ##. ..# .#. ..# ##.
4 #.# #.# ### ..# ..#
5 ### #.. ##. ..# ##.
6 .## #.. ### #.# ###
7 ### ..# .#. .#. .#.
8 ### #.# ### #.# ###
9 ### #.# ### ..# ##.
! .#. .#. .#. ... .#.
? ##. ..# .#. ... .#.
. ... ... ... ... .#.
, ... ... ... .#. #..
: ... .#. ... .#. ...
- ... ... ### ... ...
+ ... .#. ### .#. ...
/ ..# ..# .#. #.. #..
' .#. .#. ... ... ...
< ..# .#. #.. .#. ..#
> #.. .#. ..# .#. #..
% #.# ..# .#. #.. #.#
`;
const GLYPHS = { ' ': '...............' };
for (const line of FONT.trim().split('\n')) {
  const [ch, ...rows] = line.split(' ');
  GLYPHS[ch] = rows.join('');
}

/** Width in pixels of text drawn at scale 1. */
export function textWidth(str) {
  return str.length * 4 - 1;
}

export function drawText(ctx, str, x, y, color, scale = 1, align = 'left') {
  str = String(str).toUpperCase();
  const w = textWidth(str) * scale;
  if (align === 'center') x -= Math.floor(w / 2);
  else if (align === 'right') x -= w;
  x = Math.round(x);
  y = Math.round(y);
  ctx.fillStyle = color;
  for (let i = 0; i < str.length; i++) {
    const g = GLYPHS[str[i]] || GLYPHS['?'];
    for (let p = 0; p < 15; p++) {
      if (g[p] === '#') ctx.fillRect(x + (i * 4 + (p % 3)) * scale, y + Math.floor(p / 3) * scale, scale, scale);
    }
  }
}

/** Text with a 1 px dark outline so it reads over anything. */
export function drawTextOutlined(ctx, str, x, y, color, scale = 1, align = 'left', outline = C.black) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawText(ctx, str, x + dx, y + dy, outline, scale, align);
  drawText(ctx, str, x, y, color, scale, align);
}
