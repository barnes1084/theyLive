// Checks generated stages are deterministic and can always be finished:
// every area's exit is reachable from its start using the player's jump.
import assert from 'node:assert/strict';
import { generateStage, tileAt, isSolid, T, ROWS, TILE, GRAVITY, JUMP_V, RUN_SPEED } from '../web/js/stage.js';

// How far the player can really jump, from the game's physics.
const jumpRows = (JUMP_V * JUMP_V) / (2 * GRAVITY) / TILE;
const jumpCols = ((2 * JUMP_V) / GRAVITY) * RUN_SPEED / TILE;
assert.ok(jumpRows >= 3.2, `jump height ${jumpRows.toFixed(2)} rows is too low for 3-row steps`);
assert.ok(jumpCols >= 3.8, `jump length ${jumpCols.toFixed(2)} cols is too short for 3-col gaps`);

/** Cells (c, r) the player can stand on: a floor tile with two free rows above. */
function standable(area, c, r) {
  const t = tileAt(area, c, r);
  if (!(isSolid(t) || t === T.ONEWAY)) return false;
  return r >= 2 && !isSolid(tileAt(area, c, r - 1)) && !isSolid(tileAt(area, c, r - 2));
}

function canReach(area, from, to) {
  const rise = from.r - to.r; // rows up
  const dc = Math.abs(to.c - from.c);
  if (rise > 3) return false;
  if (rise === 3) return dc <= 3;
  if (rise >= 1) return dc <= 4;
  return dc <= 4 + Math.floor(-rise / 2);
}

function exitReachable(area, startCol, goalCol) {
  const cells = [];
  for (let c = 0; c < area.cols; c++) for (let r = 0; r < ROWS; r++) if (standable(area, c, r)) cells.push({ c, r });
  const start = cells.find((p) => p.c === startCol);
  assert.ok(start, `${area.kind}: nowhere to stand at the start`);
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const p = queue.shift();
    if (p.c >= goalCol) return true;
    for (const q of cells) {
      if (!seen.has(q) && Math.abs(q.c - p.c) <= 6 && canReach(area, p, q)) {
        seen.add(q);
        queue.push(q);
      }
    }
  }
  return false;
}

const seeds = [1, 42, 1234567, 987654321];
let checked = 0;
for (const seed of seeds) {
  for (let stage = 1; stage <= 30; stage++) {
    const s = generateStage(stage, seed);
    const again = generateStage(stage, seed);
    assert.deepEqual(Array.from(s.city.tiles), Array.from(again.city.tiles), 'stages must be deterministic');

    const { city, tunnel, boss } = s;
    const startCol = (a) => Math.floor(a.startX / TILE);
    assert.ok(exitReachable(city, startCol(city), city.exit.c0 - 1), `seed ${seed} stage ${stage}: city exit unreachable`);
    assert.ok(exitReachable(tunnel, startCol(tunnel), tunnel.exit.c0), `seed ${seed} stage ${stage}: tunnel exit unreachable`);
    assert.ok(exitReachable(boss, startCol(boss), boss.cols - 3), `seed ${seed} stage ${stage}: boss arena broken`);

    // Glasses, people and pickups all stand on something.
    const onFloor = (area, x, y, what) => {
      const c = Math.floor(x / TILE);
      const r = y / TILE;
      assert.ok(Number.isInteger(r) && standable(area, c, r), `seed ${seed} stage ${stage}: ${what} floating at col ${c} row ${r}`);
    };
    onFloor(city, city.glasses.x, city.glasses.y, 'glasses');
    for (const a of [city, tunnel]) {
      for (const sp of a.spawns) onFloor(a, sp.x, sp.y, sp.type);
      for (const p of a.pickups) onFloor(a, p.x, p.y, `pickup ${p.kind}`);
    }
    assert.ok(city.glasses.x < city.cols * TILE * 0.35, 'glasses should be early in the city');
    assert.ok(city.spawns.some((sp) => sp.disguised), `seed ${seed} stage ${stage}: no disguised lizards`);
    assert.ok(city.spawns.some((sp) => sp.type === 'civilian'), `seed ${seed} stage ${stage}: no civilians`);

    // The manhole goes all the way down; tunnels have room to jump everywhere.
    for (let r = 0; r < ROWS; r++) assert.equal(tileAt(city, city.exit.c0, r), T.AIR);
    for (let c = 0; c < tunnel.cols; c++) {
      const g = tunnel.ground[c];
      if (g >= 0) assert.ok(g - tunnel.ceiling[c] >= 5, `seed ${seed} stage ${stage}: tunnel ceiling too low at col ${c}`);
    }
    checked++;
  }
}

const s1 = generateStage(1, 1);
const s2 = generateStage(1, 2);
assert.notDeepEqual(Array.from(s1.city.tiles), Array.from(s2.city.tiles), 'different runs should get different stages');

console.log(`ok: ${checked} stages checked (jump ${jumpRows.toFixed(2)} rows x ${jumpCols.toFixed(2)} cols)`);
