// Endless stage generator. A stage is three areas played in order:
//   city   - the street level, where lizards walk around disguised as people
//   tunnel - the sewers below, where they run around in their true form
//   boss   - a locked arena at the end of the tunnels
// Everything comes from (stage number, run seed), so the same pair always
// gives the same stage. The tests check every stage can be finished.

import { makeRng, hash } from './rng.js';

export const TILE = 16;
export const ROWS = 11;

// Player physics live here so the generator and the tests agree with the
// game about how far the player can jump.
export const GRAVITY = 900;
export const JUMP_V = 320;
export const RUN_SPEED = 90;

export const T = { AIR: 0, SOLID: 1, ONEWAY: 2, CRATE: 3, SLUDGE: 4 };

export const WEAPONS = ['N', 'T', 'S'];

const BILLBOARD_ADS = ['BUY NOW', 'NEW CAR', 'COLA', 'VACATION', 'TV 24/7', 'SALE', 'BANK ON US', 'DIET', 'MOVIES'];
const BILLBOARD_TRUTH = ['OBEY', 'CONSUME', 'SLEEP', 'CONFORM', 'NO THOUGHT', 'SUBMIT', 'WATCH TV', 'STAY ASLEEP', 'BUY', 'DO NOT QUESTION', 'MARRY AND REPRODUCE'];
const BOSS_NAMES = ['THE OVERSEER', 'THE ANCHORMAN', 'THE LANDLORD', 'THE BROADCASTER', 'THE CHAIRMAN', 'THE SPOKESMAN'];

/** Bigger numbers are harder; levels off after stage 10. */
export function difficulty(stage) {
  const s = Math.min(stage, 10) - 1;
  return {
    cityLength: 110 + 10 * s,
    tunnelLength: 90 + 10 * s,
    disguiseRatio: Math.min(0.3 + 0.04 * s, 0.6),
    maxGap: stage === 1 ? 2 : 3,
    tunnelSpacing: [Math.max(4, 8 - Math.floor(s / 2)), Math.max(6, 11 - Math.floor(s / 2))],
    waveDelay: Math.max(1.4, 3.6 - 0.22 * s),
    enemySpeed: 55 + 3 * s,
    fireDelay: Math.max(1.1, 2.2 - 0.11 * s),
    bossHp: 60 + 25 * (stage - 1),
  };
}

export function generateStage(stage, runSeed = 1) {
  const seed = hash(runSeed, stage);
  const diff = difficulty(stage);
  return {
    stage,
    seed,
    diff,
    bossName: BOSS_NAMES[hash(seed, 7) % BOSS_NAMES.length],
    city: generateCity(makeRng(hash(seed, 1)), stage, diff),
    tunnel: generateTunnel(makeRng(hash(seed, 2)), stage, diff),
    boss: generateBoss(stage),
  };
}

export function tileAt(area, c, r) {
  if (c < 0 || c >= area.cols) return T.SOLID;
  if (r < 0 || r >= ROWS) return T.AIR;
  return area.tiles[r * area.cols + c];
}

export function isSolid(tile) {
  return tile === T.SOLID || tile === T.CRATE;
}

/** Top row a player could stand on in column c, or -1 (pit). */
export function groundRow(area, c) {
  for (let r = 0; r < ROWS; r++) {
    const t = tileAt(area, c, r);
    if ((isSolid(t) || t === T.ONEWAY) && r > 1 && !isSolid(tileAt(area, c, r - 1))) {
      if (area.kind === 'tunnel' && r <= area.ceiling[c]) continue;
      return r;
    }
  }
  return -1;
}

function makeArea(kind, cols) {
  return {
    kind,
    cols,
    tiles: new Uint8Array(cols * ROWS),
    ceiling: new Int8Array(cols), // tunnel: rows 0..ceiling-1 are solid
    ground: new Int8Array(cols).fill(-1), // top row of the floor, -1 = pit
    spawns: [],
    pickups: [],
    billboards: [],
    exit: null,
    startX: 2 * TILE,
  };
}

function set(area, c, r, t) {
  if (c >= 0 && c < area.cols && r >= 0 && r < ROWS) area.tiles[r * area.cols + c] = t;
}

/**
 * Lays out a run of floor heights in chunks: flats, steps, gaps, scaffolding
 * and crate stacks. Every chunk ends on enough flat floor to take off from.
 */
function layoutFloor(rng, length, minG, maxG, maxGap) {
  const ground = [];
  const platforms = [];
  const crates = [];
  let g = 8;
  const clamp = (v) => Math.max(minG, Math.min(maxG, v));
  const flat = (w) => {
    for (let i = 0; i < w; i++) ground.push(g);
  };
  flat(14);
  while (ground.length < length) {
    const roll = rng.next();
    if (roll < 0.22) {
      flat(rng.int(4, 9));
    } else if (roll < 0.42) {
      g = clamp(g + rng.pick([-2, -1, 1, 2]));
      flat(rng.int(3, 6));
    } else if (roll < 0.62) {
      const w = rng.int(2, maxGap);
      for (let i = 0; i < w; i++) ground.push(-1);
      // The wider the gap, the less the far side may rise.
      g = clamp(g + rng.int(w >= 3 ? -1 : -2, 2));
      flat(rng.int(3, 6));
    } else if (roll < 0.82) {
      const c0 = ground.length;
      const w = rng.int(7, 10);
      flat(w);
      if (g - 3 >= 3) platforms.push({ c0: c0 + 2, c1: c0 + w - 3, r: g - 3 });
    } else {
      const c0 = ground.length;
      flat(rng.int(6, 8));
      const height = rng.int(1, 2);
      const width = rng.int(1, 2);
      for (let c = c0 + 2; c < c0 + 2 + width; c++) {
        for (let k = 0; k < height; k++) crates.push({ c, r: g - 1 - k });
      }
    }
  }
  return { ground, platforms, crates, endG: () => g, flat };
}

function applyFloor(area, layout, pitFill) {
  layout.ground.forEach((g, c) => {
    area.ground[c] = g;
    if (g < 0) {
      if (pitFill) set(area, c, ROWS - 1, pitFill);
      return;
    }
    for (let r = g; r < ROWS; r++) set(area, c, r, T.SOLID);
  });
  for (const p of layout.platforms) for (let c = p.c0; c <= p.c1; c++) set(area, c, p.r, T.ONEWAY);
  for (const k of layout.crates) set(area, k.c, k.r, T.CRATE);
}

/** Floor columns with nothing on top, between c0 and c1. */
function openFloor(area, c0, c1) {
  const out = [];
  for (let c = Math.max(c0, 0); c <= Math.min(c1, area.cols - 1); c++) {
    const g = area.ground[c];
    if (g >= 0 && tileAt(area, c, g - 1) === T.AIR && tileAt(area, c, g - 2) === T.AIR) out.push(c);
  }
  return out;
}

function pickupAt(area, kind, c, r, hidden = false) {
  area.pickups.push({ kind, x: c * TILE + TILE / 2, y: r * TILE, hidden });
}

function generateCity(rng, stage, diff) {
  const layout = layoutFloor(rng, diff.cityLength, 6, 9, diff.maxGap);
  layout.flat(10);
  const manhole = layout.ground.length;
  layout.ground.push(-1, -1);
  layout.flat(12);

  const area = makeArea('city', layout.ground.length);
  applyFloor(area, layout, 0);
  area.exit = { c0: manhole, c1: manhole + 1, r: layout.endG() };

  // The sunglasses, in a box outside a church early in the stage.
  const early = openFloor(area, Math.floor(area.cols * 0.12), Math.floor(area.cols * 0.3));
  const gc = rng.pick(early);
  area.glasses = { x: gc * TILE + TILE / 2, y: area.ground[gc] * TILE };

  // Pedestrians. Some of them are lizards in disguise.
  const open = new Set(openFloor(area, 0, area.cols));
  let c = 20;
  while (c < manhole - 6) {
    if (open.has(c) && Math.abs(c - gc) > 2) {
      const look = rng.int(0, 5);
      const y = area.ground[c] * TILE;
      if (rng.chance(diff.disguiseRatio)) {
        area.spawns.push({ type: rng.chance(0.55) ? 'grunt' : 'gunner', x: c * TILE + 8, y, disguised: true, look });
      } else {
        area.spawns.push({ type: 'civilian', x: c * TILE + 8, y, look });
      }
    }
    c += rng.int(3, 6);
  }

  // A weapon up on the scaffolding, or on the floor if there is none.
  const plat = layout.platforms.find((p) => p.c0 > gc) || layout.platforms[0];
  if (plat) pickupAt(area, rng.pick(WEAPONS), (plat.c0 + plat.c1) >> 1, plat.r);
  else {
    const fc = rng.pick(openFloor(area, gc + 4, manhole - 4));
    pickupAt(area, rng.pick(WEAPONS), fc, area.ground[fc]);
  }
  // A stash only the sunglasses can see.
  const hc = rng.pick(openFloor(area, gc + 6, manhole - 4));
  pickupAt(area, rng.pick(['+', 'H', ...WEAPONS]), hc, area.ground[hc], true);

  for (let b = rng.int(6, 10); b < area.cols - 8; b += rng.int(14, 22)) {
    area.billboards.push({
      c: b,
      r: 1,
      w: 6,
      h: 3,
      ad: rng.pick(BILLBOARD_ADS),
      truth: rng.pick(BILLBOARD_TRUTH),
    });
  }
  return area;
}

function generateTunnel(rng, stage, diff) {
  const layout = layoutFloor(rng, diff.tunnelLength, 7, 9, diff.maxGap);
  layout.flat(14);
  const area = makeArea('tunnel', layout.ground.length);
  applyFloor(area, layout, T.SLUDGE);

  // Ceiling: one or two rows, changing every few columns. Kept low enough
  // that a full jump always fits.
  let ceil = 1;
  for (let c = 0; c < area.cols; c++) {
    if (c % 6 === 0) ceil = rng.int(1, 2);
    const g = area.ground[c];
    const limit = g >= 0 ? g - 5 : 2;
    area.ceiling[c] = Math.max(1, Math.min(ceil, limit));
    for (let r = 0; r < area.ceiling[c]; r++) set(area, c, r, T.SOLID);
  }
  area.exit = { c0: area.cols - 6, c1: area.cols - 1, r: area.ground[area.cols - 1] };

  const open = new Set(openFloor(area, 0, area.cols));
  let c = 18;
  while (c < area.cols - 12) {
    if (open.has(c)) {
      area.spawns.push({ type: rng.chance(0.6) ? 'grunt' : 'gunner', x: c * TILE + 8, y: area.ground[c] * TILE });
    }
    c += rng.int(diff.tunnelSpacing[0], diff.tunnelSpacing[1]);
  }
  for (const p of layout.platforms) {
    if (rng.chance(0.7)) area.spawns.push({ type: 'gunner', x: ((p.c0 + p.c1) >> 1) * TILE + 8, y: p.r * TILE });
  }

  const floor = openFloor(area, 20, area.cols - 14);
  const wc = rng.pick(floor);
  pickupAt(area, rng.pick(WEAPONS), wc, area.ground[wc]);
  const hc = rng.pick(floor);
  pickupAt(area, '+', hc, area.ground[hc]);
  const sc = rng.pick(floor);
  pickupAt(area, rng.chance(0.3) ? 'C' : 'H', sc, area.ground[sc], true);
  return area;
}

export const ARENA_COLS = 26;

function generateBoss() {
  const area = makeArea('boss', ARENA_COLS);
  const g = 9;
  for (let c = 0; c < ARENA_COLS; c++) {
    area.ground[c] = g;
    for (let r = g; r < ROWS; r++) set(area, c, r, T.SOLID);
  }
  for (let r = 0; r < g; r++) {
    set(area, 0, r, T.SOLID);
    set(area, ARENA_COLS - 1, r, T.SOLID);
  }
  for (let c = 4; c <= 8; c++) set(area, c, 6, T.ONEWAY);
  for (let c = 17; c <= 21; c++) set(area, c, 6, T.ONEWAY);
  area.startX = 3 * TILE;
  return area;
}
