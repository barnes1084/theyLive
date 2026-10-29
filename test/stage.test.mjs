// Checks generated stages are deterministic and can always be finished:
// every area's exit is reachable from its start using the player's jump.
import assert from 'node:assert/strict';
import { generateStage, tileAt, isSolid, laneOf, T, ROWS, LANE_ROWS, TILE, GRAVITY, JUMP_V, RUN_SPEED } from '../web/js/stage.js';

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

/** Can the player walk and jump from startCol to goalCol, staying in rows r0..r1? */
function exitReachable(area, startCol, goalCol, r0 = 0, r1 = ROWS - 1) {
  const cells = [];
  for (let c = 0; c < area.cols; c++) for (let r = r0; r <= r1; r++) if (standable(area, c, r)) cells.push({ c, r });
  const start = cells.find((p) => p.c >= startCol);
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
    assert.deepEqual(Array.from(s.street.tiles), Array.from(again.street.tiles), 'stages must be deterministic');

    const { street, boss } = s;
    const startCol = Math.floor(street.startX / TILE);
    const at = `seed ${seed} stage ${stage}`;
    assert.ok(exitReachable(street, startCol, street.exit.c0, 0, LANE_ROWS - 1), `${at}: city lane exit unreachable`);
    assert.ok(exitReachable(street, startCol, street.exit.c0, LANE_ROWS, ROWS - 1), `${at}: sewer lane exit unreachable`);
    assert.ok(exitReachable(boss, Math.floor(boss.startX / TILE), boss.cols - 3), `${at}: boss arena broken`);

    // Glasses, people and pickups all stand on something, in the right lane.
    const onFloor = (x, y, what) => {
      const c = Math.floor(x / TILE);
      const r = y / TILE;
      assert.ok(Number.isInteger(r) && standable(street, c, r), `${at}: ${what} floating at col ${c} row ${r}`);
    };
    onFloor(street.glasses.x, street.glasses.y, 'glasses');
    assert.equal(laneOf(street.glasses.y), 0, 'glasses belong on the street');
    for (const sp of street.spawns) {
      onFloor(sp.x, sp.y, sp.type);
      assert.equal(laneOf(sp.y), sp.lane, `${at}: ${sp.type} in the wrong lane`);
      if (sp.lane === 1) assert.ok(!sp.disguised && sp.type !== 'civilian', 'nobody pretends in the sewers');
    }
    for (const p of street.pickups) {
      onFloor(p.x, p.y, `pickup ${p.kind}`);
      assert.equal(laneOf(p.y), 1, `${at}: loot belongs in the sewers`);
    }
    assert.ok(street.pickups.filter((p) => p.kind === '+').length >= 2, `${at}: not enough hearts`);
    assert.ok(street.pickups.filter((p) => ['N', 'T', 'S'].includes(p.kind)).length >= 3, `${at}: not enough weapons`);
    assert.ok(street.glasses.x < street.cols * TILE * 0.3, 'glasses should be early');
    const carriers = street.spawns.filter((sp) => sp.carrier);
    assert.equal(carriers.length, 1, `${at}: exactly one lizard carries the portal device`);
    assert.ok(carriers[0].disguised && carriers[0].x > street.glasses.x, `${at}: carrier should be disguised, after the glasses`);
    assert.ok(street.spawns.some((sp) => sp.type === 'civilian'), `${at}: no civilians`);

    for (let c = 0; c < street.cols; c++) {
      // The lanes never connect: earth (or cement over earth) between them.
      assert.ok(isSolid(tileAt(street, c, LANE_ROWS)), `${at}: lanes connect at col ${c}`);
      // City pits have a bottom of wet cement.
      if (street.ground[0][c] < 0) assert.equal(tileAt(street, c, LANE_ROWS - 1), T.SLUDGE, `${at}: bottomless city pit at col ${c}`);
      // Room to jump everywhere in the sewers.
      const g = street.ground[1][c];
      if (g >= 0) {
        let open = 0;
        for (let r = g - 1; r >= LANE_ROWS && tileAt(street, c, r) !== T.SOLID; r--) open++;
        assert.ok(open >= 5, `${at}: sewer ceiling too low at col ${c}`);
      }
    }
    checked++;
  }
}

const s1 = generateStage(1, 1);
const s2 = generateStage(1, 2);
assert.notDeepEqual(Array.from(s1.street.tiles), Array.from(s2.street.tiles), 'different runs should get different stages');

console.log(`ok: ${checked} stages checked (jump ${jumpRows.toFixed(2)} rows x ${jumpCols.toFixed(2)} cols)`);
