// Endless stage generator. A stage is two areas played in order:
//   street - one long level seen as two lanes stacked on screen:
//            the city on top, where lizards walk around disguised as people,
//            and the sewers below, where they run around in their true form
//            and the weapons and hearts are. A portal device, carried by one
//            disguised lizard, lets the player warp between the lanes.
//            Children play on the street; snatchers portal up to take them.
//   boss   - a locked arena at the end of the street
// Everything comes from (stage number, run seed), so the same pair always
// gives the same stage. The tests check every stage can be finished.

import { makeRng, hash } from './rng.js';

export const TILE = 16;
export const LANE_ROWS = 9;
export const ROWS = LANE_ROWS * 2;

// Player physics live here so the generator and the tests agree with the
// game about how far the player can jump.
export const GRAVITY = 900;
export const JUMP_V = 320;
export const RUN_SPEED = 90;

export const T = { AIR: 0, SOLID: 1, ONEWAY: 2, CRATE: 3, SLUDGE: 4 };

export const WEAPONS = ['M', 'N', 'T', 'S'];

const BILLBOARD_ADS = ['BUY NOW', 'NEW CAR', 'COLA', 'VACATION', 'TV 24/7', 'SALE', 'BANK ON US', 'DIET', 'MOVIES'];
const BILLBOARD_TRUTH = ['OBEY', 'CONSUME', 'SLEEP', 'CONFORM', 'NO THOUGHT', 'SUBMIT', 'WATCH TV', 'STAY ASLEEP', 'BUY', 'DO NOT QUESTION', 'MARRY AND REPRODUCE'];
const BOSS_NAMES = ['THE OVERSEER', 'THE ANCHORMAN', 'THE LANDLORD', 'THE BROADCASTER', 'THE CHAIRMAN', 'THE SPOKESMAN'];

/** Bigger numbers are harder; levels off after stage 10. */
export function difficulty(stage) {
  const s = Math.min(stage, 10) - 1;
  return {
    length: 130 + 10 * s,
    disguiseRatio: Math.min(0.3 + 0.04 * s, 0.6),
    maxGap: stage === 1 ? 2 : 3,
    sewerSpacing: [Math.max(4, 8 - Math.floor(s / 2)), Math.max(6, 11 - Math.floor(s / 2))],
    waveDelay: Math.max(1.0, 2.8 - 0.18 * s),
    enemySpeed: 55 + 3 * s,
    fireDelay: Math.max(1.1, 2.2 - 0.11 * s),
    bossHp: 45 + 18 * (stage - 1),
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
    street: generateStreet(makeRng(hash(seed, 1)), makeRng(hash(seed, 2)), diff),
    boss: generateBoss(),
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

/** 0 for the top lane (city), 1 for the bottom lane (sewers), from a y in pixels. */
export function laneOf(y) {
  return y <= LANE_ROWS * TILE ? 0 : 1;
}

function makeArea(kind, cols) {
  return {
    kind,
    cols,
    tiles: new Uint8Array(cols * ROWS),
    // Per lane, the floor's top row in each column (-1 = pit).
    ground: [new Int8Array(cols).fill(-1), new Int8Array(cols).fill(-1)],
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
 * Lays out exactly `length` columns of floor heights in chunks: flats,
 * steps, gaps, scaffolding and crate stacks, ending on a long flat. Every
 * chunk ends on enough flat floor to take off from.
 */
function layoutFloor(rng, length, minG, maxG, maxGap) {
  const ground = [];
  const platforms = [];
  const crates = [];
  let g = maxG;
  const clamp = (v) => Math.max(minG, Math.min(maxG, v));
  const flat = (w) => {
    for (let i = 0; i < w; i++) ground.push(g);
  };
  const body = length - 14;
  flat(14);
  while (ground.length < body) {
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
      platforms.push({ c0: c0 + 2, c1: c0 + w - 3, r: g - 3 });
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
  // Cut back to the body (a chunk may have run over), then finish flat.
  ground.length = body;
  while (ground[ground.length - 1] < 0) ground.pop();
  g = ground[ground.length - 1];
  flat(length - ground.length);
  return {
    ground,
    platforms: platforms.filter((p) => p.c1 < body).filter((p) => p.r >= 2),
    crates: crates.filter((k) => k.c < body),
  };
}

/** Writes a lane's layout into the area. Rows in `layout` are lane rows. */
function applyLane(area, lane, layout, pitFill) {
  const top = lane * LANE_ROWS;
  const bottom = top + LANE_ROWS - 1;
  layout.ground.forEach((g, c) => {
    if (g < 0) {
      set(area, c, bottom, pitFill);
      return;
    }
    area.ground[lane][c] = top + g;
    for (let r = top + g; r <= bottom; r++) set(area, c, r, T.SOLID);
  });
  for (const p of layout.platforms) for (let c = p.c0; c <= p.c1; c++) set(area, c, top + p.r, T.ONEWAY);
  for (const k of layout.crates) set(area, k.c, top + k.r, T.CRATE);
}

/** Floor columns of a lane with nothing on top, between c0 and c1. */
export function openFloor(area, lane, c0, c1) {
  const out = [];
  for (let c = Math.max(c0, 0); c <= Math.min(c1, area.cols - 1); c++) {
    const g = area.ground[lane][c];
    if (g >= 0 && tileAt(area, c, g - 1) === T.AIR && tileAt(area, c, g - 2) === T.AIR) out.push(c);
  }
  return out;
}

function pickupAt(area, kind, c, r, hidden = false) {
  area.pickups.push({ kind, x: c * TILE + TILE / 2, y: r * TILE, hidden });
}

function generateStreet(cityRng, sewerRng, diff) {
  const length = diff.length;
  const area = makeArea('street', length);
  area.exit = { c0: length - 6 };

  // ---- Top lane: the city. Pits are full of wet cement.
  const city = layoutFloor(cityRng, length, 5, 7, diff.maxGap);
  applyLane(area, 0, city, T.SLUDGE);
  for (let b = cityRng.int(6, 10); b < length - 10; b += cityRng.int(14, 22)) {
    area.billboards.push({ c: b, r: 1, w: 6, h: 3, ad: cityRng.pick(BILLBOARD_ADS), truth: cityRng.pick(BILLBOARD_TRUTH) });
  }

  // ---- Bottom lane: the sewers, with a low ceiling and sludge in the pits.
  const sewer = layoutFloor(sewerRng, length, 6, 7, diff.maxGap);
  applyLane(area, 1, sewer, T.SLUDGE);
  const under = new Set();
  for (const p of sewer.platforms) for (let c = p.c0 - 1; c <= p.c1 + 1; c++) under.add(c);
  let ceil = 1;
  for (let c = 0; c < length; c++) {
    if (c % 6 === 0) ceil = sewerRng.int(1, 2);
    const g = sewer.ground[c];
    // Leave room for a full jump everywhere, and above the scaffolding.
    const rows = g >= 0 && !under.has(c) ? Math.min(ceil, g - 5) : 1;
    for (let r = 0; r < Math.max(1, rows); r++) set(area, c, LANE_ROWS + r, T.SOLID);
  }

  // ---- People on the street. Some of them are lizards in disguise.
  const early = openFloor(area, 0, Math.floor(length * 0.1), Math.floor(length * 0.25));
  const gc = cityRng.pick(early);
  area.glasses = { x: gc * TILE + TILE / 2, y: area.ground[0][gc] * TILE };

  const open = new Set(openFloor(area, 0, 0, length));
  for (let c = 20; c < area.exit.c0 - 6; c += cityRng.int(3, 6)) {
    if (!open.has(c) || Math.abs(c - gc) <= 2) continue;
    const look = cityRng.int(0, 5);
    const y = area.ground[0][c] * TILE;
    const x = c * TILE + 8;
    if (cityRng.chance(diff.disguiseRatio)) {
      area.spawns.push({ type: cityRng.chance(0.55) ? 'grunt' : 'gunner', x, y, disguised: true, look, lane: 0 });
    } else {
      area.spawns.push({ type: 'civilian', x, y, look, lane: 0 });
    }
  }
  // Children playing on the street. Snatchers portal up to grab them.
  const kids = Math.min(6, 4 + Math.floor(diff.length / 160));
  const kidCols = openFloor(area, 0, 24, area.exit.c0 - 10).filter((c) => !area.spawns.some((sp) => Math.abs(sp.x - (c * TILE + 8)) < TILE));
  for (let i = 0; i < kids && kidCols.length; i++) {
    const c = kidCols[Math.floor(((i + 0.5) / kids) * kidCols.length)];
    area.spawns.push({ type: 'child', x: c * TILE + 8, y: area.ground[0][c] * TILE, look: cityRng.int(0, 3), lane: 0 });
  }

  // One disguised lizard after the glasses carries the portal device.
  const carrierZone = area.spawns.filter((s) => s.type !== 'child' && s.x > (gc + 8) * TILE && s.x < length * TILE * 0.55);
  const carrier = carrierZone.find((s) => s.disguised) || carrierZone[0] || area.spawns.filter((s) => s.type !== 'child').pop();
  Object.assign(carrier, { type: 'grunt', disguised: true, carrier: true });

  // ---- Lizards in the sewers.
  const openBelow = new Set(openFloor(area, 1, 0, length));
  for (let c = 18; c < area.exit.c0 - 6; c += sewerRng.int(diff.sewerSpacing[0], diff.sewerSpacing[1])) {
    if (!openBelow.has(c)) continue;
    area.spawns.push({ type: sewerRng.chance(0.6) ? 'grunt' : 'gunner', x: c * TILE + 8, y: area.ground[1][c] * TILE, lane: 1 });
  }
  for (const p of sewer.platforms) {
    if (sewerRng.chance(0.7)) {
      area.spawns.push({ type: 'gunner', x: ((p.c0 + p.c1) >> 1) * TILE + 8, y: (LANE_ROWS + p.r) * TILE, lane: 1 });
    }
  }
  area.spawns.sort((a, b) => a.x - b.x);

  // ---- The loot is all down in the sewers.
  const floor = openFloor(area, 1, 16, area.exit.c0 - 4);
  const spread = (i, n) => floor[Math.floor(((i + 0.5) / n) * floor.length)];
  const loot = [sewerRng.pick(WEAPONS), '+', sewerRng.pick(WEAPONS), 'H', '+', sewerRng.pick(WEAPONS)];
  loot.forEach((kind, i) => {
    const c = spread(i, loot.length);
    pickupAt(area, kind, c, area.ground[1][c]);
  });
  for (const p of sewer.platforms.slice(0, 2)) pickupAt(area, sewerRng.pick(['+', ...WEAPONS]), p.c1, LANE_ROWS + p.r);
  // A stash only the sunglasses can see.
  const sc = sewerRng.pick(floor);
  pickupAt(area, sewerRng.chance(0.35) ? 'C' : sewerRng.pick(['+', 'H']), sc, area.ground[1][sc], true);
  return area;
}

export const ARENA_COLS = 40;
export const ARENA_FLOOR = 16;

function generateBoss() {
  const area = makeArea('boss', ARENA_COLS);
  for (let c = 0; c < ARENA_COLS; c++) {
    area.ground[0][c] = ARENA_FLOOR;
    for (let r = ARENA_FLOOR; r < ROWS; r++) set(area, c, r, T.SOLID);
  }
  for (let r = 0; r < ARENA_FLOOR; r++) {
    set(area, 0, r, T.SOLID);
    set(area, ARENA_COLS - 1, r, T.SOLID);
  }
  for (let c = 5; c <= 10; c++) set(area, c, 13, T.ONEWAY);
  for (let c = 29; c <= 34; c++) set(area, c, 13, T.ONEWAY);
  for (let c = 16; c <= 23; c++) set(area, c, 10, T.ONEWAY);
  area.startX = 4 * TILE;
  return area;
}
