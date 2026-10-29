// 16-bit pixel art. Sprites are designed as small text grids, one character
// per pixel, colored by a palette, so one body template serves every
// character. At load they are enlarged with Scale2x (which rounds off
// diagonals the way pixel artists do by hand) and shaded automatically:
// highlights where light hits from above, shadows underneath, and a dark
// tinted outline. The game runs at twice its world resolution, so these
// detailed sprites are drawn at half size: same hitboxes, twice the pixels.
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

// The hero: hard hat, square jaw and a blond mullet down the back of his neck.
const HEAD_PLAYER = [
  '...yyyyy....',
  '..yyyyyyy...',
  '.yyyyyyyyyy.',
  '..hhssssss..',
  '..hhsssesss.',
  '.hhhssssss..',
  '.hh.ssssss..',
];

const HEAD_PLAYER_SHADES = [
  '...yyyyy....',
  '..yyyyyyy...',
  '.yyyyyyyyyy.',
  '..hhssssss..',
  '..hhssEEEEE.',
  '.hhhssssss..',
  '.hh.ssssss..',
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

// A construction worker with a wrestler's build: broad bare shoulders, big arms
// and a white tank top.
const TORSO_PLAYER = [
  '.sssswwssss.',
  'sssswwwwssss',
  'sssswwwwwsss',
  'ss.wwwwwww.s',
  'ss.wwwwwww.s',
  '.s.bbbkbbb.s',
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

// Children: smaller, 12 x 15.
const HEAD_CHILD = [
  '....hhhh....',
  '...hhhhhh...',
  '...hsssss...',
  '...hssesss..',
  '....sssss...',
  '.....ss.....',
];

const TORSO_CHILD = ['....tttt....', '...stttts...', '....tttt....', '....pppp....'];

const LEGS_CHILD = {
  stand: ['....p..p....', '....p..p....', '....f..f....', '...ff..ff...', '............'],
  walk1: ['...p....p...', '..p......p..', '..f......f..', '.ff......ff.', '............'],
  walk2: ['.....pp.....', '.....pp.....', '.....ff.....', '.....fff....', '............'],
  jump: ['...pp..pp...', '...f....f...', '..ff....ff..', '............', '............'],
};

export const CHILD_LOOKS = [
  { h: C.brown, s: C.skin, t: C.yellow, p: C.blue, f: C.red },
  { h: C.black, s: C.skin3, t: C.red, p: C.navy, f: C.white },
  { h: C.yellow, s: C.skin, t: C.lime, p: C.purple, f: C.darkGray },
  { h: C.brown, s: C.skin2, t: '#f878b8', p: C.white, f: C.purple },
];

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

const PLAYER = { y: C.yellow, h: '#e8c058', s: '#f0a868', e: C.black, E: C.black, w: '#f4f4ee', k: C.yellow, b: C.brown, p: C.blue, f: C.brown };

// ---------- Color helpers ----------

/** Sprite and tile pixels per world pixel. */
export const DETAIL = 2;

const LIGHT = [255, 248, 232]; // warm highlights
const SHADOW = [28, 16, 48]; // cool, purple-ish shadows

export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(a, b, t) {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
}

export function css(c, alpha = 1) {
  return alpha === 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

/** Lighter (t > 0) or darker (t < 0) version of a hex color, as CSS. */
export function shade(hex, t) {
  return css(t >= 0 ? mix(rgb(hex), LIGHT, t) : mix(rgb(hex), SHADOW, -t));
}

/** Same as shade, but as a hex color. */
export function shadeHex(hex, t) {
  const c = t >= 0 ? mix(rgb(hex), LIGHT, t) : mix(rgb(hex), SHADOW, -t);
  return '#' + c.map((n) => n.toString(16).padStart(2, '0')).join('');
}

// ---------- Pixel-art scalers ----------

/** Scale2x (EPX): doubles a grid, rounding off diagonal steps. */
export function scale2x(grid) {
  const h = grid.length;
  const w = grid[0].length;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? '.' : grid[y][x]);
  const out = [];
  for (let y = 0; y < h; y++) {
    let top = '';
    let bottom = '';
    for (let x = 0; x < w; x++) {
      const p = at(x, y);
      const a = at(x, y - 1);
      const b = at(x + 1, y);
      const c = at(x - 1, y);
      const d = at(x, y + 1);
      top += (c === a && c !== d && a !== b ? a : p) + (a === b && a !== c && b !== d ? b : p);
      bottom += (d === c && d !== b && c !== a ? c : p) + (b === d && b !== a && d !== c ? d : p);
    }
    out.push(top, bottom);
  }
  return out;
}

/** Scale3x (AdvMAME3x): triples a grid the same way. */
export function scale3x(grid) {
  const h = grid.length;
  const w = grid[0].length;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? '.' : grid[y][x]);
  const out = [];
  for (let y = 0; y < h; y++) {
    const rows = ['', '', ''];
    for (let x = 0; x < w; x++) {
      const A = at(x - 1, y - 1), B = at(x, y - 1), Cc = at(x + 1, y - 1);
      const D = at(x - 1, y), E = at(x, y), F = at(x + 1, y);
      const G = at(x - 1, y + 1), Hh = at(x, y + 1), I = at(x + 1, y + 1);
      if (B !== Hh && D !== F) {
        rows[0] += (D === B ? D : E) + ((D === B && E !== Cc) || (B === F && E !== A) ? B : E) + (B === F ? F : E);
        rows[1] += ((D === B && E !== G) || (D === Hh && E !== A) ? D : E) + E + ((B === F && E !== I) || (Hh === F && E !== Cc) ? F : E);
        rows[2] += (D === Hh ? D : E) + ((D === Hh && E !== I) || (Hh === F && E !== G) ? Hh : E) + (Hh === F ? F : E);
      } else {
        rows[0] += E + E + E;
        rows[1] += E + E + E;
        rows[2] += E + E + E;
      }
    }
    out.push(...rows);
  }
  return out;
}

// ---------- Automatic 16-bit shading ----------

/**
 * Shades a grid: each material gets a highlight along its top and left
 * edges, a shadow along its bottom and right edges, and the silhouette gets
 * a 1 px outline in a dark version of its neighbor's color. Eyes ('e') get
 * a glint. Returns { w, h, px } with px a flat array of [r, g, b] or null,
 * one pixel bigger than the grid on every side.
 */
export function shadeGrid(grid, palette, flip = false) {
  if (flip) grid = grid.map((row) => [...row].reverse().join(''));
  const gh = grid.length;
  const gw = grid[0].length;
  const at = (x, y) => (x < 0 || y < 0 || x >= gw || y >= gh || !palette[grid[y][x]] ? '.' : grid[y][x]);
  const w = gw + 2;
  const h = gh + 2;
  const px = new Array(w * h).fill(null);
  for (let y = -1; y <= gh; y++) {
    for (let x = -1; x <= gw; x++) {
      const ch = at(x, y);
      const o = (y + 1) * w + (x + 1);
      if (ch === '.') {
        // Outline: take the darkest-looking opaque neighbor.
        const n = [at(x, y - 1), at(x - 1, y), at(x + 1, y), at(x, y + 1)].find((c) => c !== '.');
        if (n) px[o] = mix(rgb(palette[n]), [16, 8, 24], 0.78);
        continue;
      }
      const base = rgb(palette[ch]);
      if (ch === 'e') {
        px[o] = at(x, y - 1) !== 'e' && at(x - 1, y) !== 'e' ? [240, 240, 255] : base;
        continue;
      }
      let k = 0;
      if (at(x, y - 1) !== ch) k += 0.34;
      else if (at(x, y - 2) !== ch) k += 0.12;
      if (at(x - 1, y) !== ch) k += 0.1;
      if (at(x, y + 1) !== ch) k -= 0.3;
      else if (at(x, y + 2) !== ch) k -= 0.1;
      if (at(x + 1, y) !== ch) k -= 0.14;
      px[o] = k >= 0 ? mix(base, LIGHT, k) : mix(base, SHADOW, -k);
    }
  }
  return { w, h, px };
}

// ---------- Canvases and caching ----------

const cache = new Map();

export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function cached(key, build) {
  let s = cache.get(key);
  if (!s) {
    s = build();
    cache.set(key, s);
  }
  return s;
}

/** A canvas drawn once and kept, sized in canvas pixels. */
export function cachedCanvas(key, w, h, draw) {
  return cached(`c:${key}`, () => {
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    draw(ctx, (x, y, pw, ph, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, pw, ph);
    });
    return c;
  });
}

/** Forgets cached canvases whose key starts with prefix (for large, temporary art). */
export function dropCached(prefix, keep = 48) {
  const keys = [...cache.keys()].filter((k) => typeof k === 'string' && k.startsWith(`c:${prefix}`));
  for (const k of keys.slice(0, Math.max(0, keys.length - keep))) cache.delete(k);
}

function pixelsToCanvas({ w, h, px }) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  px.forEach((p, i) => {
    if (!p) return;
    img.data.set([p[0], p[1], p[2], 255], i * 4);
  });
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * A finished sprite: `img` at full detail, plus its size in world pixels.
 * The outline sits half a world pixel outside the design grid.
 */
function makeSprite(grid, palette, flip, scale = 2) {
  let g = grid;
  if (scale === 2) g = scale2x(g);
  else if (scale === 6) g = scale2x(scale3x(g));
  const img = pixelsToCanvas(shadeGrid(g, palette, flip));
  return { img, w: img.width / DETAIL, h: img.height / DETAIL, pad: 1 / DETAIL };
}

/** Draws a sprite with its design grid's top-left corner at world (x, y). */
export function drawSprite(ctx, spr, x, y) {
  ctx.drawImage(spr.img, x - spr.pad, y - spr.pad, spr.w, spr.h);
}

/** A white silhouette of a sprite, for hit flashes. */
export function flashSprite(spr) {
  return cached(spr, () => {
    const c = makeCanvas(spr.img.width, spr.img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(spr.img, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    return { ...spr, img: c };
  });
}

/**
 * A person sprite.
 *   kind: 'civilian' | 'disguised' (lizard head, civilian clothes) | 'lizard'
 *   pose: 'stand' | 'walk1' | 'walk2' | 'jump' | 'crouch'
 */
export function personSprite(kind, look, pose, flip) {
  return cached(`p:${kind}:${look}:${pose}:${flip}`, () => {
    if (kind === 'lizard') return makeSprite(body(HEAD_LIZARD, TORSO, pose), LIZARD_BODY, flip);
    const l = LOOKS[look];
    if (kind === 'disguised') return makeSprite(body(HEAD_LIZARD, TORSO, pose), { ...l, ...LIZARD_SKIN, s: C.green }, flip);
    return makeSprite(body(l.cap ? HEAD_CAP : HEAD_HUMAN, TORSO, pose), { ...l, e: C.black }, flip);
  });
}

export function childSprite(look, pose, flip) {
  return cached(`ch:${look}:${pose}:${flip}`, () => {
    const legs = LEGS_CHILD[pose] || LEGS_CHILD.stand;
    return makeSprite([...HEAD_CHILD, ...TORSO_CHILD, ...legs], { ...CHILD_LOOKS[look % CHILD_LOOKS.length], e: C.black }, flip);
  });
}

export function playerSprite(pose, shades, flip) {
  return cached(`pl:${pose}:${shades}:${flip}`, () =>
    makeSprite(body(shades ? HEAD_PLAYER_SHADES : HEAD_PLAYER, TORSO_PLAYER, pose), PLAYER, flip),
  );
}

/** The boss: a big lizard in a suit, at three times a person's size. */
export function bossSprite() {
  return cached('boss', () => {
    const suit = { ...LIZARD_SKIN, s: C.green, t: '#18182c', k: C.red, b: '#18182c', p: '#18182c', f: C.darkGray };
    return makeSprite(body(HEAD_LIZARD, TORSO, 'stand'), suit, true, 6);
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
  return cached(`i:${name}:${color}`, () => makeSprite(ICONS[name], { '#': color }, false));
}

// ---------- Tiles (16 world px, drawn at 32 px) ----------

const TS = 16 * DETAIL;

/** Small deterministic noise for textures. */
function noise(...v) {
  let h = 2166136261;
  for (const n of v) h = Math.imul(h ^ n, 16777619);
  h ^= h >>> 13;
  return ((Math.imul(h, 0x5bd1e995) >>> 0) % 1000) / 1000;
}

/** A beveled block: light top-left edges, dark bottom-right edges. */
function bevel(px, x, y, w, h, color, depth = 2) {
  px(x, y, w, h, shade(color, 0));
  px(x, y, w, depth, shade(color, 0.3));
  px(x, y, depth / 2, h, shade(color, 0.15));
  px(x, y + h - depth, w, depth, shade(color, -0.35));
  px(x + w - depth / 2, y, depth / 2, h, shade(color, -0.2));
}

function drawCityGround(px, top, v) {
  px(0, 0, TS, TS, '#6b4a2e');
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(noise(v, i, 1) * TS);
    const y = Math.floor(noise(v, i, 2) * TS);
    px(x, y, 2, 1, noise(v, i, 3) < 0.5 ? '#54381f' : '#80603c');
  }
  for (let i = 0; i < 3; i++) {
    const x = Math.floor(noise(v, i, 4) * (TS - 4));
    const y = 12 + Math.floor(noise(v, i, 5) * (TS - 16));
    px(x, y, 4, 3, '#8c8070');
    px(x, y, 3, 1, '#b8ac98');
    px(x + 1, y + 2, 3, 1, '#5c5044');
  }
  if (!top) return;
  // Sidewalk slab with a curb.
  px(0, 0, TS, 11, '#b4b4bc');
  px(0, 0, TS, 2, '#ececf4');
  px(0, 2, TS, 1, '#d0d0d8');
  px(0, 8, TS, 1, '#8c8c98');
  px(0, 9, TS, 2, '#6c6c78');
  px(0, 11, TS, 2, '#3e2a1a');
  for (let i = 0; i < 10; i++) px(Math.floor(noise(v, i, 6) * TS), 3 + Math.floor(noise(v, i, 7) * 5), 1, 1, '#9c9ca8');
  px(TS - 2, 2, 1, 6, '#84848e');
  px(TS - 1, 2, 1, 6, '#dcdce4');
  if (v % 3 === 0) {
    // A crack in the slab.
    px(10, 3, 2, 1, '#84848e');
    px(12, 4, 2, 1, '#84848e');
    px(14, 5, 1, 2, '#84848e');
  }
}

function drawSewerStone(px, top, v) {
  px(0, 0, TS, TS, '#16162a');
  const tones = ['#3a3a5c', '#34344e', '#40405e', '#363654'];
  const blocks = [
    [0, 0, 16, 16], [16, 0, 16, 16],
    [-8, 16, 16, 16], [8, 16, 16, 16], [24, 16, 16, 16],
  ];
  blocks.forEach(([x, y, w, h], i) => {
    const color = tones[Math.floor(noise(v, i, 9) * tones.length)];
    bevel(px, x + 1, y + 1, w - 1, h - 1, color);
    if (noise(v, i, 10) < 0.25) {
      // A crack.
      const cx = x + 4 + Math.floor(noise(v, i, 11) * 8);
      px(cx, y + 4, 1, 3, '#1c1c30');
      px(cx + 1, y + 7, 1, 3, '#1c1c30');
    }
  });
  if (!top) return;
  // Moss and slime dripping over the edge.
  px(0, 0, TS, 4, '#2c6c2c');
  px(0, 0, TS, 1, '#6cbc4c');
  px(0, 1, TS, 1, '#4c9c3c');
  for (let x = 0; x < TS; x += 2) {
    const len = Math.floor(noise(v, x, 12) * 6);
    if (len > 1) px(x, 4, 2, len, '#2c6c2c');
    if (len > 3) px(x, 4 + len, 1, 1, '#4c9c3c');
  }
}

function drawLairPanel(px, top, v) {
  bevel(px, 0, 0, TS, TS, '#2a1c50');
  px(4, 4, TS - 8, TS - 8, '#221640');
  px(4, 4, TS - 8, 1, '#120a28');
  px(5, TS - 6, TS - 10, 1, '#3c2c70');
  for (const [x, y] of [[2, 2], [TS - 4, 2], [2, TS - 4], [TS - 4, TS - 4]]) {
    px(x, y, 2, 2, '#6c5ca0');
    px(x, y, 1, 1, '#a898d8');
  }
  if (top) {
    px(0, 0, TS, 3, '#9878f8');
    px(0, 0, TS, 1, '#d8c8ff');
    px(0, 3, TS, 1, '#4c3890');
  }
}

function drawGirder(px) {
  px(0, 0, TS, 5, '#e8701c');
  px(0, 0, TS, 1, '#ffb060');
  px(0, 1, TS, 1, '#ff9030');
  px(0, 4, TS, 1, '#a04010');
  for (let x = 3; x < TS; x += 8) {
    px(x, 2, 2, 2, '#ffd0a0');
    px(x + 1, 3, 1, 1, '#a04010');
  }
  // Truss under the plank.
  for (let i = 0; i < 8; i++) {
    px(i, 5 + i, 2, 1, '#b85818');
    px(TS - 2 - i, 5 + i, 2, 1, '#b85818');
    px(16 + i, 5 + i, 1, 1, '#b85818');
    px(15 - i, 5 + i, 1, 1, '#b85818');
  }
  px(0, 12, TS, 2, '#c86020');
  px(0, 13, TS, 1, '#803008');
}

function drawGrate(px) {
  px(0, 0, TS, 6, '#6c6c7c');
  px(0, 0, TS, 1, '#b0b0c0');
  px(0, 5, TS, 1, '#34343e');
  for (let x = 2; x < TS; x += 4) px(x, 2, 2, 2, '#1c1c24');
  for (const x of [4, TS - 6]) {
    px(x, 6, 2, 8, '#4c4c58');
    px(x, 6, 1, 8, '#7c7c8c');
  }
  px(Math.floor(TS * 0.6), 1, 3, 1, '#8c5c3c'); // rust
}

function drawCrate(px, v) {
  px(0, 0, TS, TS, '#5c3810');
  for (let i = 0; i < 3; i++) {
    const y = 1 + i * 10;
    px(1, y, TS - 2, 9, '#b07c3c');
    px(1, y, TS - 2, 1, '#e0aa68');
    px(1, y + 8, TS - 2, 1, '#7c5020');
    for (let k = 0; k < 4; k++) {
      const gx = 3 + Math.floor(noise(v, i, k) * (TS - 10));
      px(gx, y + 3 + (k % 3), 5, 1, '#94642c');
    }
  }
  for (let i = 0; i < TS - 4; i++) px(2 + i, 2 + Math.floor(i * 0.9), 2, 2, '#8c5c28');
  for (const [x, y] of [[3, 3], [TS - 5, 3], [3, TS - 5], [TS - 5, TS - 5]]) {
    px(x, y, 2, 2, '#d8d8e0');
    px(x + 1, y + 1, 1, 1, '#6c6c78');
  }
}

function drawSludge(px, frame) {
  for (let y = 0; y < TS; y++) px(0, y, TS, 1, css(mix([0, 120, 30], [0, 50, 20], y / TS)));
  for (let x = 0; x < TS; x++) {
    const y = Math.round(3 + Math.sin((x + frame * 4) * 0.4) * 2);
    px(x, y, 1, 2, '#9cfc6c');
    px(x, y + 2, 1, 2, '#3cbc3c');
  }
  for (let i = 0; i < 3; i++) {
    const bx = Math.floor(noise(i, 13) * (TS - 4));
    const by = 10 + ((frame * 3 + i * 7) % 18);
    px(bx, TS - by, 3, 3, '#5cdc4c');
    px(bx, TS - by, 1, 1, '#d0ffb0');
  }
}

function drawCement(px, frame) {
  for (let y = 0; y < TS; y++) px(0, y, TS, 1, css(mix([150, 150, 156], [96, 96, 104], y / TS)));
  for (let x = 0; x < TS; x++) {
    const y = Math.round(4 + Math.sin((x + frame * 2) * 0.3) * 1.5);
    px(x, y, 1, 1, '#e0e0e8');
    px(x, y + 1, 1, 1, '#b8b8c0');
  }
  px((frame * 9 + 5) % (TS - 3), 14, 3, 1, '#7c7c84');
  px((frame * 5 + 18) % (TS - 2), 22, 2, 1, '#7c7c84');
}

/**
 * kind: 'city' | 'tunnel' | 'boss'. tile: T.* code. top: whether the tile is
 * the surface. frame: animation frame. v: variant, for texture variety.
 */
export function tileSprite(kind, tile, top, frame = 0, v = 0) {
  const animated = tile === 4;
  const key = `t:${kind}:${tile}:${top}:${animated ? frame : 0}:${tile === 1 || tile === 3 ? v : 0}`;
  return cached(key, () => {
    const c = makeCanvas(TS, TS);
    const ctx = c.getContext('2d');
    const px = (x, y, w, h, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    };
    if (tile === 1) {
      if (kind === 'city') drawCityGround(px, top, v);
      else if (kind === 'tunnel') drawSewerStone(px, top, v);
      else drawLairPanel(px, top, v);
    } else if (tile === 2) {
      if (kind === 'city') drawGirder(px);
      else drawGrate(px);
    } else if (tile === 3) drawCrate(px, v);
    else if (tile === 4) {
      if (kind === 'city') drawCement(px, frame);
      else drawSludge(px, frame);
    }
    return c;
  });
}

// ---------- Font ----------

// Each glyph is five rows of three pixels; they're smoothed with Scale2x
// (twice for big text) and drawn with a gradient and an optional outline.
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
const GLYPHS = { ' ': ['...', '...', '...', '...', '...'] };
for (const line of FONT.trim().split('\n')) {
  const [ch, ...rows] = line.split(' ');
  GLYPHS[ch] = rows;
}

const BIG_GLYPHS = {
  W: ['#....#', '#....#', '#....#', '#....#', '#.##.#', '#.##.#', '#.##.#', '######', '.#..#.', '.#..#.'],
};

/** Width in world pixels of text drawn at scale 1. */
export function textWidth(str) {
  return str.length * 4 - 1;
}

/**
 * One glyph image. `level` is how many times it was smoothed (1 or 2),
 * `outline` adds a dark border `level` pixels thick.
 */
function glyph(ch, color, level, outline) {
  return cached(`g:${ch}:${color}:${level}:${outline}`, () => {
    let grid = GLYPHS[ch] || GLYPHS['?'];
    let i = 0;
    if (BIG_GLYPHS[ch]) {
      // Hand-drawn at 6 x 10 because the 3 x 5 version smooths into an H.
      grid = BIG_GLYPHS[ch];
      i = 1;
    }
    for (; i < level; i++) grid = scale2x(grid);
    const gw = grid[0].length;
    const gh = grid.length;
    const pad = outline ? level : 0;
    const c = makeCanvas(gw + pad * 2, gh + pad * 2);
    const ctx = c.getContext('2d');
    const on = (x, y) => x >= 0 && y >= 0 && x < gw && y < gh && grid[y][x] === '#';
    if (outline) {
      ctx.fillStyle = css(mix(rgb(outline), [0, 0, 0], 0.2));
      for (let y = -pad; y < gh + pad; y++) {
        for (let x = -pad; x < gw + pad; x++) {
          let near = false;
          for (let dy = -pad; dy <= pad && !near; dy++) for (let dx = -pad; dx <= pad && !near; dx++) near = on(x + dx, y + dy);
          if (near && !on(x, y)) ctx.fillRect(x + pad, y + pad, 1, 1);
        }
      }
    }
    // Light at the top, darker at the bottom.
    const base = rgb(color);
    for (let y = 0; y < gh; y++) {
      const t = y / (gh - 1);
      ctx.fillStyle = css(t < 0.4 ? mix(base, LIGHT, 0.45 * (1 - t / 0.4)) : mix(base, SHADOW, 0.35 * ((t - 0.4) / 0.6)));
      for (let x = 0; x < gw; x++) if (grid[y][x] === '#') ctx.fillRect(x + pad, y + pad, 1, 1);
    }
    return { img: c };
  });
}

function textImpl(ctx, str, x, y, color, scale, align, outline) {
  str = String(str).toUpperCase();
  const w = textWidth(str) * scale;
  if (align === 'center') x -= w / 2;
  else if (align === 'right') x -= w;
  x = Math.round(x * DETAIL) / DETAIL;
  y = Math.round(y * DETAIL) / DETAIL;
  const level = scale >= 3 ? 2 : 1;
  const unit = scale / 2 ** level; // world px per glyph-image pixel
  for (let i = 0; i < str.length; i++) {
    if (str[i] === ' ') continue;
    const gl = glyph(str[i], color, level, outline);
    const pad = outline ? level * unit : 0;
    ctx.drawImage(gl.img, x + i * 4 * scale - pad, y - pad, gl.img.width * unit, gl.img.height * unit);
  }
}

export function drawText(ctx, str, x, y, color, scale = 1, align = 'left') {
  textImpl(ctx, str, x, y, color, scale, align, null);
}

/** Text with a dark outline so it reads over anything. */
export function drawTextOutlined(ctx, str, x, y, color, scale = 1, align = 'left', outline = '#000000') {
  textImpl(ctx, str, x, y, color, scale, align, outline);
}
