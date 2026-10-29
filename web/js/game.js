// Game rules: the player, weapons, sunglasses, the portal device, people,
// lizards, the boss, and moving on through the stages.

import { TILE, ROWS, T, GRAVITY, JUMP_V, RUN_SPEED, ARENA_COLS, ARENA_FLOOR, WEAPONS, tileAt, isSolid, laneOf, generateStage } from './stage.js';
import { sfx, playMusic } from './audio.js';
import { makeRng } from './rng.js';

export const VIEW_H = ROWS * TILE;
const STEP = 1 / 60;
const BOSS_Y = ARENA_FLOOR * TILE - 78;
const MAX_HEARTS = 4;

export const WEAPON_INFO = {
  G: { name: 'SPREAD GUN', delay: 0.36 },
  M: { name: 'MACHINE GUN', delay: 0.075 },
  N: { name: 'NAIL GUN', delay: 0.1 },
  T: { name: 'TORCH', delay: 0.05 },
  S: { name: 'SLUGS', delay: 0.42 },
};

const AREA_TITLES = { street: 'THE STREETS', boss: 'THE LAIR' };
const MUSIC = { street: 'city', boss: 'boss' };
const PORTAL_COOLDOWN = 1.2;
const TACKLE_TIME = 0.28;
const TACKLE_SPEED = 240;
const TACKLE_COOLDOWN = 0.7;

// ---------- Saved progress ----------

const SAVE_KEY = 'theylive-save';

export function loadSave() {
  try {
    return { bestStage: 0, bestScore: 0, sound: true, music: true, view: 'close', ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') };
  } catch {
    return { bestStage: 0, bestScore: 0, sound: true, music: true, view: 'close' };
  }
}

export function writeSave(save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be unavailable (private mode); progress just isn't kept.
  }
}

// ---------- Tile physics ----------

function blocked(area, x, y) {
  return isSolid(tileAt(area, Math.floor(x / TILE), Math.floor(y / TILE)));
}

/** Moves a body horizontally; returns true if it hit a wall. */
function moveX(b, dx, area) {
  if (!dx) return false;
  b.x += dx;
  const top = b.y - b.h + 1;
  const bottom = b.y - 1;
  const edge = dx > 0 ? b.x + b.w / 2 - 0.001 : b.x - b.w / 2;
  const c = Math.floor(edge / TILE);
  for (let r = Math.floor(top / TILE); r <= Math.floor(bottom / TILE); r++) {
    if (isSolid(tileAt(area, c, r))) {
      b.x = dx > 0 ? c * TILE - b.w / 2 : (c + 1) * TILE + b.w / 2;
      return true;
    }
  }
  return false;
}

/** Moves a body vertically, landing on floors and one-way platforms. */
function moveY(b, dy, area) {
  const prevBottom = b.y;
  b.y += dy;
  b.onGround = false;
  const c0 = Math.floor((b.x - b.w / 2 + 0.001) / TILE);
  const c1 = Math.floor((b.x + b.w / 2 - 0.001) / TILE);
  if (dy > 0) {
    const r = Math.floor((b.y - 0.001) / TILE);
    for (let c = c0; c <= c1; c++) {
      const t = tileAt(area, c, r);
      const oneway = t === T.ONEWAY && prevBottom <= r * TILE + 0.01 && !(b.drop > 0);
      if (isSolid(t) || oneway) {
        b.y = r * TILE;
        b.vy = 0;
        b.onGround = true;
        b.groundTile = t;
        return;
      }
    }
  } else if (dy < 0) {
    const r = Math.floor((b.y - b.h) / TILE);
    for (let c = c0; c <= c1; c++) {
      if (isSolid(tileAt(area, c, r))) {
        b.y = (r + 1) * TILE + b.h;
        b.vy = 0;
        return;
      }
    }
  }
}

function applyPhysics(b, dt, area) {
  b.vy = Math.min(b.vy + GRAVITY * dt, 420);
  const hitWall = moveX(b, b.vx * dt, area);
  moveY(b, b.vy * dt, area);
  if (b.drop > 0) b.drop -= dt;
  return hitWall;
}

/** Is there floor just ahead of a walker's feet? */
function floorAhead(b, area, dir) {
  const x = b.x + dir * (b.w / 2 + 2);
  const t = tileAt(area, Math.floor(x / TILE), Math.floor((b.y + 2) / TILE));
  return isSolid(t) || t === T.ONEWAY;
}

function overlap(a, b) {
  return Math.abs(a.x - b.x) * 2 < a.w + b.w && a.y - a.h < b.y && b.y - b.h < a.y;
}

function pointIn(b, x, y, pad = 0) {
  return x > b.x - b.w / 2 - pad && x < b.x + b.w / 2 + pad && y > b.y - b.h - pad && y < b.y + pad;
}

// ---------- The game ----------

export function createGame(save) {
  const g = {
    save,
    mode: 'title', // title | play | paused | transition | dying | clear | gameover
    menu: null,
    W: 320,
    time: 0,
    runSeed: 1,
    stageNum: 1,
    stage: null,
    areaKey: 'street',
    area: null,
    cam: { x: 0, y: 0 },
    // Set by main.js from the screen size and the VIEW setting.
    zoom: 1,
    viewH: VIEW_H,
    screenW: 320,
    helpTimer: 0,
    player: null,
    actors: [],
    bullets: [],
    shots: [],
    pickups: [],
    particles: [],
    texts: [],
    banner: null,
    fade: 0,
    shake: 0,
    score: 0,
    hearts: MAX_HEARTS,
    armor: false,
    weapon: 'G',
    glasses: { have: false, on: false, meter: 1, locked: false, contacts: false, taken: false },
    portal: { have: false, cd: 0 },
    carrierPending: false,
    portalFx: [],
    spawnIndex: 0,
    waveTimer: 3,
    boss: null,
    bossDeadTimer: 0,
    stageStats: null,
    rng: makeRng(Date.now() >>> 0),
  };

  // ---------- Flow ----------

  g.showTitle = function () {
    g.mode = 'title';
    playMusic('tunnel');
    g.menu = {
      items: [
        { label: 'START', action: () => g.newRun() },
        { label: () => `SOUND: ${g.save.sound ? 'ON' : 'OFF'}`, action: () => g.toggleSetting('sound') },
        { label: () => `MUSIC: ${g.save.music ? 'ON' : 'OFF'}`, action: () => g.toggleSetting('music') },
        { label: () => `VIEW: ${g.save.view === 'full' ? 'FULL' : 'CLOSE'}`, action: () => g.toggleView() },
      ],
      sel: 0,
    };
  };

  /** Close follows the player's lane zoomed in; full shows both lanes whole. */
  g.toggleView = function () {
    g.save.view = g.save.view === 'full' ? 'close' : 'full';
    writeSave(g.save);
    g.onSettingsChanged?.();
  };

  g.toggleSetting = function (key) {
    g.save[key] = !g.save[key];
    writeSave(g.save);
    g.onSettingsChanged?.();
  };

  g.newRun = function () {
    g.runSeed = (Math.random() * 2 ** 32) >>> 0;
    g.score = 0;
    g.hearts = MAX_HEARTS;
    g.armor = false;
    g.weapon = 'G';
    g.glasses.contacts = false;
    g.helpTimer = 10;
    g.startStage(1);
  };

  g.startStage = function (n) {
    g.stageNum = n;
    g.stage = generateStage(n, g.runSeed);
    // The lizards took your shades and the portal device. Find them again.
    Object.assign(g.glasses, { have: false, on: false, meter: 1, locked: false, taken: false });
    g.portal = { have: false, cd: 0 };
    g.carrierPending = false;
    g.stageStats = { lizards: 0, innocents: 0, saved: 0, lost: 0, score: g.score };
    g.snatchTimer = 9;
    g.enterArea('street');
    g.banner = {
      title: `STAGE ${n}`,
      sub: n === 1 ? 'FIND THE SUNGLASSES' : 'THEY TOOK YOUR SHADES. FIND THEM!',
      t: 3,
    };
  };

  g.enterArea = function (key) {
    g.areaKey = key;
    g.area = g.stage[key];
    g.actors = [];
    g.bullets = [];
    g.shots = [];
    g.particles = [];
    g.texts = [];
    g.portalFx = [];
    g.boss = null;
    g.bossDeadTimer = 0;
    g.pickups = g.area.pickups.map((p) => ({ ...p, vy: 0, taken: false }));
    g.spawnIndex = 0;
    g.waveTimer = 3;
    g.cam.x = 0;
    const startX = g.area.startX;
    const startC = Math.floor(startX / TILE);
    g.player = {
      x: startX,
      y: g.area.ground[0][startC] * TILE,
      w: 8,
      h: 21,
      vx: 0,
      vy: 0,
      face: 1,
      onGround: true,
      crouch: false,
      aim: { x: 1, y: 0 },
      fireCd: 0,
      inv: key === 'street' ? 0 : 1,
      drop: 0,
      coyote: 0,
      jumpBuf: 0,
      anim: 0,
      firing: 0,
      tackle: 0,
      tackleCd: 0,
      tackleHit: null,
      burstStep: 0,
    };
    if (key === 'boss') {
      const d = g.stage.diff;
      g.boss = {
        type: 'boss',
        x: ARENA_COLS * TILE * 0.7,
        y: BOSS_Y,
        w: 26,
        h: 60,
        vx: 0,
        hp: d.bossHp,
        maxHp: d.bossHp,
        flash: 0,
        pattern: 'move',
        timer: 2,
        count: 0,
        targetX: ARENA_COLS * TILE * 0.5,
        baseY: BOSS_Y,
        name: g.stage.bossName,
      };
      g.actors.push(g.boss);
    }
    g.updateCamera(0, true);
    playMusic(MUSIC[key]);
    g.mode = 'play';
  };

  /**
   * Moves the camera. Across, it follows the player forward only (Contra
   * style), or tracks them in a boss arena wider than the screen. Up and
   * down, when zoomed in, it sits at the bottom so the whole sewer lane is
   * always in view, cropping the sky; it only rises to keep the player's head
   * on screen when they climb or jump near the top.
   */
  g.updateCamera = function (dt, snap = false) {
    const p = g.player;
    if (!p || !g.area) return;
    const areaW = g.area.cols * TILE;
    if (g.area.kind === 'boss') {
      g.cam.x = g.W >= areaW ? (areaW - g.W) / 2 : Math.max(0, Math.min(areaW - g.W, p.x - g.W / 2));
    } else {
      const target = Math.min(p.x - g.W * 0.4, areaW - g.W);
      g.cam.x = snap ? Math.max(0, target) : Math.max(g.cam.x, target);
    }
    const free = VIEW_H - g.viewH;
    const head = p.y - p.h - 10;
    const ty = Math.max(0, Math.min(free, head));
    g.cam.y = snap ? ty : g.cam.y + (ty - g.cam.y) * Math.min(1, dt * 8);
  };

  /** Fades to black, swaps area, fades back in. */
  g.transitionTo = function (key) {
    g.mode = 'transition';
    g.transition = { key, t: 0 };
    sfx('descend');
  };

  g.stageClear = function () {
    g.mode = 'clear';
    const bonus = 1000 * g.stageNum + 500 * g.stageStats.saved;
    g.score += bonus;
    g.save.bestStage = Math.max(g.save.bestStage, g.stageNum);
    g.save.bestScore = Math.max(g.save.bestScore, g.score);
    writeSave(g.save);
    g.clearInfo = { bonus };
    sfx('clear');
    playMusic(null);
    g.menu = { items: [{ label: `GO TO STAGE ${g.stageNum + 1}`, action: () => g.startStage(g.stageNum + 1) }], sel: 0 };
  };

  g.gameOver = function () {
    g.mode = 'gameover';
    g.save.bestStage = Math.max(g.save.bestStage, g.stageNum - 1);
    g.save.bestScore = Math.max(g.save.bestScore, g.score);
    writeSave(g.save);
    sfx('gameover');
    playMusic(null);
    g.menu = {
      items: [
        {
          label: `RETRY STAGE ${g.stageNum}`,
          action: () => {
            g.score = g.stageStats.score;
            g.hearts = MAX_HEARTS;
            g.armor = false;
            g.startStage(g.stageNum);
          },
        },
        { label: 'NEW RUN', action: () => g.newRun() },
        { label: 'TITLE', action: () => g.showTitle() },
      ],
      sel: 0,
    };
  };

  g.pause = function () {
    if (g.mode !== 'play') return;
    g.mode = 'paused';
    g.menu = {
      items: [
        { label: 'RESUME', action: () => g.resume() },
        { label: () => `SOUND: ${g.save.sound ? 'ON' : 'OFF'}`, action: () => g.toggleSetting('sound') },
        { label: () => `MUSIC: ${g.save.music ? 'ON' : 'OFF'}`, action: () => g.toggleSetting('music') },
        { label: () => `VIEW: ${g.save.view === 'full' ? 'FULL' : 'CLOSE'}`, action: () => g.toggleView() },
        { label: 'QUIT RUN', action: () => g.showTitle() },
      ],
      sel: 0,
    };
  };

  g.resume = function () {
    g.mode = 'play';
    g.menu = null;
  };

  // ---------- Helpers ----------

  function addText(x, y, text, color = '#fcfcfc', life = 1) {
    g.texts.push({ x, y, text, color, life, max: life });
  }

  function burst(x, y, color, n = 8, speed = 80) {
    for (let i = 0; i < n; i++) {
      const a = g.rng.next() * Math.PI * 2;
      const s = speed * (0.3 + g.rng.next());
      g.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, life: 0.3 + g.rng.next() * 0.4, color, size: 1 + (g.rng.next() < 0.3) });
    }
  }

  g.addScore = function (n) {
    g.score = Math.max(0, g.score + n);
  };

  function hurtPlayer(force = false) {
    const p = g.player;
    if (!force && (p.inv > 0 || p.tackle > 0)) return;
    if (g.mode !== 'play') return;
    g.shake = 0.25;
    if (g.armor && !force) {
      g.armor = false;
      p.inv = 1.2;
      sfx('hit');
      addText(p.x, p.y - 28, 'HARD HAT!', '#f8d800');
      burst(p.x, p.y - 20, '#f8d800', 6);
      return;
    }
    g.hearts--;
    p.inv = 1.6;
    p.vy = -160;
    sfx('hurt');
    burst(p.x, p.y - 12, '#d82800', 10);
    if (g.hearts <= 0) {
      g.mode = 'dying';
      g.dyingTimer = 1.6;
      p.vy = -220;
    }
  }

  /** Can the player stand in column c of a lane? */
  function standableColumn(c, lane) {
    const gr = g.area.ground[lane][c];
    return gr >= 0 && !isSolid(tileAt(g.area, c, gr - 1)) && !isSolid(tileAt(g.area, c, gr - 2));
  }

  /** First standable column at or after column c. */
  function safeColumn(c, lane) {
    for (let i = Math.max(c, 0); i < g.area.cols; i++) if (standableColumn(i, lane)) return i;
    return c;
  }

  function laneOfPlayer() {
    return g.area.kind === 'street' ? laneOf(g.player.y) : 0;
  }

  function respawnPlayer(lane) {
    const p = g.player;
    const c = safeColumn(Math.floor((g.cam.x + 24) / TILE), lane);
    p.x = c * TILE + TILE / 2;
    p.y = g.area.ground[lane][c] * TILE;
    p.vx = p.vy = 0;
    p.inv = 2;
  }

  // ---------- Portal device ----------

  /** Warps to the other lane, at the nearest spot on screen to stand on. */
  function usePortal() {
    const p = g.player;
    const pt = g.portal;
    if (!pt.have || g.area.kind !== 'street') return;
    if (pt.cd > 0) return;
    const to = 1 - laneOf(p.y);
    const c0 = Math.floor(p.x / TILE);
    let target = -1;
    for (let d = 0; d < 16 && target < 0; d++) {
      for (const c of [c0 + d, c0 - d]) {
        const x = c * TILE + TILE / 2;
        if (x > g.cam.x + 8 && x < g.cam.x + g.W - 8 && standableColumn(c, to)) {
          target = c;
          break;
        }
      }
    }
    if (target < 0) {
      addText(p.x, p.y - 30, 'NO SIGNAL', '#9878f8');
      return;
    }
    g.portalFx.push({ x: p.x, y: p.y - 11, t: 0 });
    burst(p.x, p.y - 11, '#9878f8', 12, 60);
    p.x = target * TILE + TILE / 2;
    p.y = g.area.ground[to][target] * TILE;
    p.vx = p.vy = 0;
    p.inv = Math.max(p.inv, 0.6);
    g.portalFx.push({ x: p.x, y: p.y - 11, t: 0 });
    burst(p.x, p.y - 11, '#9878f8', 12, 60);
    pt.cd = PORTAL_COOLDOWN;
    sfx('portal');
    playMusic(to ? 'tunnel' : 'city');
  }

  // ---------- Glasses ----------

  function updateGlasses(dt) {
    const gl = g.glasses;
    if (!gl.have) return;
    // Touch swipes say on or off; the keyboard toggles.
    const want = input.pressed.glassesOn ? 'on' : input.pressed.glassesOff ? 'off' : input.pressed.glasses ? (gl.on ? 'off' : 'on') : null;
    if (want === 'off' && gl.on) {
      gl.on = false;
      sfx('glassesOff');
    } else if (want === 'on' && !gl.on) {
      if (!gl.locked) {
        gl.on = true;
        sfx('glassesOn');
      } else {
        addText(g.player.x, g.player.y - 30, 'HEADACHE...', '#fc7460');
      }
    }
    if (gl.on) {
      gl.meter -= dt / (gl.contacts ? 12 : 6);
      if (gl.meter <= 0) {
        gl.meter = 0;
        gl.on = false;
        gl.locked = true;
        g.shake = 0.3;
        sfx('headache');
        addText(g.player.x, g.player.y - 30, 'HEADACHE!', '#fc7460', 1.5);
      }
    } else {
      gl.meter = Math.min(1, gl.meter + dt / 4);
      if (gl.locked && gl.meter >= 0.5) gl.locked = false;
    }
  }

  // ---------- Player ----------

  let input = null;

  function updatePlayer(dt) {
    const p = g.player;
    const area = g.area;
    const dirX = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
    const dirY = (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0);

    // Holding lock (or holding still on the left of a touch screen) plants
    // your feet: direction input only aims.
    p.planted = !!input.held.lock && p.onGround;
    p.crouch = p.onGround && dirY > 0 && dirX === 0;
    p.h = p.crouch ? 13 : 21;
    p.vx = p.crouch || p.planted ? 0 : dirX * RUN_SPEED;
    if (dirX) p.face = dirX;

    // Tackle: a shoulder charge that plows through lizards.
    p.tackleCd -= dt;
    if (input.pressed.tackle && p.tackleCd <= 0 && p.tackle <= 0) {
      // A touch swipe says which way.
      if (input.tackleDir) p.face = input.tackleDir;
      p.tackle = TACKLE_TIME;
      p.tackleCd = TACKLE_COOLDOWN;
      p.tackleHit = new Set();
      p.crouch = false;
      p.h = 21;
      sfx('tackle');
    }
    if (p.tackle > 0) {
      p.tackle -= dt;
      p.vx = p.face * TACKLE_SPEED;
      p.planted = false;
      if (p.vy > 0) p.vy = 0; // a midair tackle carries straight across
      if (g.rng.chance(0.6)) burst(p.x - p.face * 6, p.y - 2, '#bcbcbc', 1, 30);
    }

    if (input.tackleDir && !input.pressed.tackle) input.tackleDir = 0;
    // Swipe down drops through scaffolding.
    if (input.pressed.drop && p.onGround && p.groundTile === T.ONEWAY) {
      p.drop = 0.25;
      p.y += 2;
    }
    p.coyote = p.onGround ? 0.08 : p.coyote - dt;
    p.jumpBuf = input.pressed.jump ? 0.12 : p.jumpBuf - dt;
    if (p.jumpBuf > 0 && p.coyote > 0) {
      p.jumpBuf = 0;
      p.coyote = 0;
      if (dirY > 0 && p.groundTile === T.ONEWAY) {
        p.drop = 0.25;
        p.y += 2;
      } else {
        p.vy = -JUMP_V;
        sfx('jump');
      }
    }
    // Let go of jump early for a short hop.
    if (!input.held.jump && p.vy < 0) p.vy += GRAVITY * dt * 1.2;

    const wasGround = p.onGround;
    applyPhysics(p, dt, area);
    if (p.onGround && !wasGround) sfx('land');

    if (p.tackle > 0) tackleHits();

    // Contra rules: the screen only scrolls forward.
    const minX = g.cam.x + p.w / 2 + 1;
    if (p.x < minX) p.x = minX;
    p.anim += dt * (p.vx ? 1 : 0);

    // Aiming in eight directions.
    let ax = p.face;
    let ay = 0;
    if (dirY < 0) {
      ax = dirX;
      ay = -1;
    } else if (dirY > 0 && (!p.onGround || dirX)) {
      ax = dirX;
      ay = 1;
    }
    const len = Math.hypot(ax, ay);
    p.aim = { x: ax / len, y: ay / len };

    p.fireCd -= dt;
    p.firing -= dt;
    if (input.held.fire && p.fireCd <= 0) fire();
    if (p.inv > 0) p.inv -= dt;

    if (input.pressed.portal) usePortal();

    // The lair door is at the end of both lanes.
    if (area.kind === 'street' && p.x >= area.exit.c0 * TILE + 8) {
      g.transitionTo('boss');
      return;
    }
    // Wet cement in the city pits, sludge in the sewer pits.
    const lane = laneOfPlayer();
    const sunk = inSludge(p);
    if (p.y > VIEW_H + 24 || sunk) {
      if (sunk) burst(p.x, p.y - 4, lane ? '#58d854' : '#bcbcbc', 12);
      p.inv = 0;
      hurtPlayer(true);
      if (g.mode === 'play') respawnPlayer(lane);
    }
  }

  function inSludge(b) {
    return tileAt(g.area, Math.floor(b.x / TILE), Math.floor((b.y - 2) / TILE)) === T.SLUDGE;
  }

  function tackleHits() {
    const p = g.player;
    const box = { x: p.x + p.face * 4, y: p.y, w: p.w + 10, h: p.h };
    for (const a of g.actors) {
      if (a.dead || a.carriedBy || isInnocent(a) || p.tackleHit.has(a) || !overlap(box, a)) continue;
      p.tackleHit.add(a);
      g.shake = Math.max(g.shake, 0.15);
      burst(a.x, a.y - 12, '#fcfcfc', 8, 90);
      if (a.type === 'boss') {
        damageActor(a, 4);
        p.tackle = 0;
        p.vx = -p.face * 120;
        p.vy = -180;
        continue;
      }
      // Knocks a snatcher's grip loose so the child can run for it.
      if (a.child) freeChild(a);
      a.x += p.face * 12;
      a.vy = -160;
      damageActor(a, 3);
      if (!a.dead) a.flash = 0.2;
    }
  }

  function gunOrigin() {
    const p = g.player;
    const shoulder = p.crouch ? p.y - 8 : p.y - 13;
    return { x: p.x + p.aim.x * 9, y: shoulder + p.aim.y * 9 };
  }

  function fire() {
    const p = g.player;
    const o = gunOrigin();
    const { x: ax, y: ay } = p.aim;
    const shoot = (angle, speed, life, dmg, kind, pierce = 0) => {
      const a = Math.atan2(ay, ax) + angle;
      g.bullets.push({ x: o.x, y: o.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life, dmg, kind, pierce, hit: new Set() });
    };
    p.fireCd = WEAPON_INFO[g.weapon].delay;
    p.firing = 0.08;
    if (g.weapon === 'G') {
      // Spread gun: five pellets in a wide fan.
      for (let i = -2; i <= 2; i++) shoot(i * 0.16 + (g.rng.next() - 0.5) * 0.04, 280 + g.rng.next() * 30, 0.42, 1, 'pellet');
      sfx('shotgun');
      g.shake = Math.max(g.shake, 0.05);
    } else if (g.weapon === 'M') {
      // Machine gun: rapid fire that sweeps straight, up, down, and repeats.
      const sweep = [0, -0.22, 0.22];
      shoot(sweep[p.burstStep++ % sweep.length], 340, 0.8, 1, 'bullet');
      sfx('mg');
    } else if (g.weapon === 'N') {
      shoot((g.rng.next() - 0.5) * 0.06, 320, 0.7, 1, 'nail');
      sfx('nail');
    } else if (g.weapon === 'T') {
      shoot((g.rng.next() - 0.5) * 0.35, 150 + g.rng.next() * 40, 0.32, 0.45, 'flame', 99);
      if (g.time % 0.15 < STEP) sfx('torch');
    } else {
      shoot(0, 340, 0.9, 5, 'slug', 2);
      sfx('slug');
      g.shake = Math.max(g.shake, 0.08);
    }
    burst(o.x, o.y, '#f8d800', g.weapon === 'G' ? 4 : 1, 40);
    // Gunfire sends people running.
    for (const a of g.actors) if (isInnocent(a) && Math.abs(a.x - p.x) < 160 && Math.abs(a.y - p.y) < 80) a.panic = true;
  }

  // ---------- People and lizards ----------

  function isInnocent(a) {
    return a.type === 'civilian' || a.type === 'child';
  }

  function spawnActor(sp) {
    const tunnel = g.area.kind === 'boss' || sp.lane === 1;
    const a = {
      type: sp.type,
      x: sp.x,
      y: sp.y,
      w: sp.type === 'child' ? 6 : 8,
      h: sp.type === 'child' ? 14 : 21,
      vx: 0,
      vy: 0,
      face: g.rng.chance(0.5) ? 1 : -1,
      onGround: true,
      look: sp.look ?? 0,
      disguised: !!sp.disguised,
      revealed: !sp.disguised,
      // A few hits at most: this is a shoot-'em-up.
      hp: sp.type === 'child' ? 1 : sp.type === 'gunner' || sp.type === 'snatcher' || tunnel ? 2 : 1,
      walk: 0,
      timer: 1 + g.rng.next() * 2,
      fireTimer: 1 + g.rng.next() * g.stage.diff.fireDelay,
      glance: 0,
      alert: 0,
      anim: g.rng.next() * 2,
      flash: 0,
      panic: false,
      carrier: !!sp.carrier,
    };
    // The carrier got away earlier, so another lizard picks up the device.
    if (g.carrierPending && a.disguised) {
      a.carrier = true;
      g.carrierPending = false;
    }
    g.actors.push(a);
    return a;
  }

  function spawnFromSpawnList() {
    const list = g.area.spawns;
    while (g.spawnIndex < list.length && list[g.spawnIndex].x < g.cam.x + g.W + 24) {
      const sp = list[g.spawnIndex++];
      if (sp.x > g.cam.x - 8) spawnActor(sp);
    }
  }

  /** Lizards keep pouring out of the dark while you're in the sewers. */
  function spawnWave(dt) {
    if (g.area.kind !== 'street' || laneOfPlayer() !== 1) return;
    g.waveTimer -= dt;
    if (g.waveTimer > 0) return;
    const d = g.stage.diff;
    g.waveTimer = d.waveDelay * (0.7 + g.rng.next() * 0.6);
    if (g.cam.x + g.W > (g.area.exit.c0 - 4) * TILE) return;
    const behind = g.rng.chance(0.2);
    const x = behind ? g.cam.x + 4 : g.cam.x + g.W + 8;
    const c = Math.floor(x / TILE);
    const gr = g.area.ground[1][c];
    if (gr < 0) return;
    const a = spawnActor({ type: 'grunt', x, y: gr * TILE, lane: 1 });
    a.face = behind ? 1 : -1;
    a.charging = true;
  }

  function reveal(a) {
    if (a.revealed) return;
    a.revealed = true;
    a.alert = 0;
    sfx('reveal');
    addText(a.x, a.y - 30, '!', '#fc7460', 0.8);
  }

  function killActor(a, byPlayer = true) {
    a.dead = true;
    if (a.child) freeChild(a);
    if (isInnocent(a)) {
      burst(a.x, a.y - 12, '#d82800', 12);
      sfx('innocent');
      g.stageStats.innocents++;
      g.addScore(-500);
      addText(a.x, a.y - 30, 'INNOCENT! -1 HEART', '#fc7460', 1.6);
      hurtPlayer(true);
      return;
    }
    burst(a.x, a.y - 12, '#58d854', 14, 100);
    sfx('die');
    if (!byPlayer) return;
    g.stageStats.lizards++;
    let points = a.type === 'gunner' ? 150 : 100;
    if (a.caught) {
      points += 200;
      addText(a.x, a.y - 30, 'SPOTTED! +' + points, '#58d854');
    } else addText(a.x, a.y - 30, '+' + points, '#fcfcfc', 0.7);
    g.addScore(points);
    if (a.carrier) {
      g.pickups.push({ kind: 'P', x: a.x, y: a.y - 8, vy: -160, hidden: false, taken: false, dropped: true });
      addText(a.x, a.y - 40, 'IT DROPPED SOMETHING!', '#9878f8', 1.5);
      return;
    }
    // In the sewers they sometimes drop something.
    if (laneOf(a.y) === 1 && g.rng.chance(0.09)) {
      const kind = g.rng.pick(['+', 'H', ...WEAPONS, ...WEAPONS]);
      g.pickups.push({ kind, x: a.x, y: a.y - 8, vy: -120, hidden: false, taken: false, dropped: true });
    }
  }

  function damageActor(a, dmg) {
    if (a.type === 'boss') {
      if (a.hp <= 0) return;
      a.hp -= dmg;
      a.flash = 0.06;
      sfx('hit');
      if (a.hp <= 0) killBoss();
      return;
    }
    if (!isInnocent(a)) {
      // Shot before it dropped the act: bonus points.
      if (!a.revealed) a.caught = true;
      reveal(a);
    }
    a.hp -= dmg;
    a.flash = 0.08;
    if (a.hp <= 0) killActor(a);
    else sfx('hit');
  }

  function walkAround(a, dt, speed) {
    a.timer -= dt;
    if (a.timer <= 0) {
      a.timer = 1.5 + g.rng.next() * 3;
      a.walk = g.rng.chance(0.3) ? 0 : g.rng.chance(0.5) ? 1 : -1;
    }
    if (a.walk) {
      a.face = a.walk;
      if (!floorAhead(a, g.area, a.walk)) a.walk = -a.walk;
    }
    a.vx = a.walk * speed;
  }

  function updateCivilian(a, dt) {
    const kid = a.type === 'child';
    if (a.panic) {
      const dir = a.x < g.player.x ? -1 : 1;
      a.face = dir;
      a.vx = dir * (kid ? 60 : 75);
      if (a.onGround && !floorAhead(a, g.area, dir)) a.vy = -260;
    } else walkAround(a, dt, kid ? 16 : 20);
    if (applyPhysics(a, dt, g.area) && a.onGround) a.vy = -260;
  }

  // ---------- Child snatchers ----------
  // Now and then a lizard portals up next to a child on the street, grabs
  // them and portals back down to the sewers, then runs for its den. Shoot
  // it to save the child; if it gets away, the child is gone.

  function onScreen(a, margin = 8) {
    return a.x > g.cam.x + margin && a.x < g.cam.x + g.W - margin;
  }

  /** Nearest column near c where someone can stand in a lane, on screen. */
  function standNear(c, lane, range = 16) {
    for (let d = 0; d <= range; d++) {
      for (const cc of [c + d, c - d]) {
        if (standableColumn(cc, lane) && onScreen({ x: cc * TILE + 8 })) return cc;
      }
    }
    return -1;
  }

  function trySnatch(dt) {
    if (g.area.kind !== 'street') return;
    g.snatchTimer -= dt;
    if (g.snatchTimer > 0) return;
    const n = g.stageNum;
    g.snatchTimer = Math.max(8, 17 - n) * (0.8 + g.rng.next() * 0.4);
    const active = g.actors.filter((a) => a.type === 'snatcher').length;
    if (active >= (n >= 4 ? 2 : 1)) return;
    const kids = g.actors.filter((a) => a.type === 'child' && !a.carriedBy && onScreen(a, 24) && laneOf(a.y) === 0);
    if (!kids.length) return;
    const kid = g.rng.pick(kids);
    const side = kid.x > g.player.x ? 1 : -1;
    const c = standNear(Math.floor((kid.x + side * 40) / TILE), 0, 6);
    if (c < 0) return;
    const a = spawnActor({ type: 'snatcher', x: c * TILE + 8, y: g.area.ground[0][c] * TILE, lane: 0 });
    a.target = kid;
    a.state = 'emerge';
    a.timer = 0.5;
    a.face = kid.x < a.x ? -1 : 1;
    g.portalFx.push({ x: a.x, y: a.y - 11, t: 0 });
    sfx('portal');
    addText(kid.x, kid.y - 24, 'HELP!', '#fc7460', 1.2);
  }

  function freeChild(a) {
    const kid = a.child;
    a.child = null;
    kid.carriedBy = null;
    g.stageStats.saved++;
    g.addScore(500);
    if (laneOf(a.y) === 1 || g.area.kind !== 'street') {
      // Down in the sewers: beam them home.
      kid.dead = true;
      g.portalFx.push({ x: a.x, y: a.y - 30, t: 0 });
      burst(a.x, a.y - 30, '#fcfcfc', 14, 60);
    } else {
      kid.x = a.x;
      kid.y = a.y;
      kid.vy = -200;
      kid.panic = true;
    }
    sfx('found');
    addText(a.x, a.y - 44, 'CHILD SAVED! +500', '#88ff70', 1.6);
  }

  function childLost(a) {
    const kid = a.child;
    if (!kid) return;
    a.child = null;
    kid.dead = true;
    g.stageStats.lost++;
    g.addScore(-1000);
    g.portalFx.push({ x: a.x, y: a.y - 11, t: 0 });
    sfx('innocent');
    g.banner = { title: 'A CHILD WAS TAKEN', sub: 'DRAGGED DOWN TO THE NEST. -1000', t: 2.5 };
  }

  function updateSnatcher(a, dt) {
    const d = g.stage.diff;
    a.timer -= dt;
    if (a.state === 'emerge') {
      a.vx = 0;
      if (a.timer <= 0) a.state = 'approach';
    } else if (a.state === 'approach') {
      const kid = a.target;
      if (!kid || kid.dead || kid.carriedBy) {
        a.state = 'flee';
        a.fled = 0;
      } else {
        const dir = kid.x < a.x ? -1 : 1;
        a.face = dir;
        a.vx = dir * 75;
        if (Math.abs(kid.x - a.x) < 8 && Math.abs(kid.y - a.y) < 12) {
          kid.carriedBy = a;
          a.child = kid;
          a.state = 'grab';
          a.timer = 0.8;
          a.vx = 0;
          addText(a.x, a.y - 44, 'NO!', '#fc7460', 1);
        }
      }
    } else if (a.state === 'grab') {
      // A moment to struggle: the player's chance to stop it in the street.
      a.vx = 0;
      if (a.timer <= 0) {
        const c = standNear(Math.floor(a.x / TILE), 1);
        if (c >= 0) {
          g.portalFx.push({ x: a.x, y: a.y - 11, t: 0 });
          a.x = c * TILE + 8;
          a.y = g.area.ground[1][c] * TILE;
          a.vy = 0;
          g.portalFx.push({ x: a.x, y: a.y - 11, t: 0 });
          sfx('portal');
        }
        a.state = 'flee';
        a.fled = 0;
        a.face = 1;
      }
    } else {
      // Run for the den.
      a.vx = a.face * (d.enemySpeed + 5);
      a.fled += Math.abs(a.vx) * dt;
      if (a.fled > 18 * TILE) {
        childLost(a);
        a.gone = true;
        return;
      }
    }
    const hitWall = applyPhysics(a, dt, g.area);
    if (a.onGround && a.vx && (hitWall || !floorAhead(a, g.area, Math.sign(a.vx)))) a.vy = -290;
  }

  function updateDisguised(a, dt) {
    const p = g.player;
    // Tells: now and then they stop and stare, and the mask slips.
    if (a.glance > 0) {
      a.glance -= dt;
      a.vx = 0;
      a.face = p.x < a.x ? -1 : 1;
    } else {
      walkAround(a, dt, 20);
      if (g.rng.chance(dt / 4)) a.glance = 0.9;
    }
    applyPhysics(a, dt, g.area);
    // Get too close and they drop the act.
    const near = Math.abs(p.x - a.x) < 70 && Math.abs(p.y - a.y) < 40;
    if (near) {
      a.alert += dt;
      if (a.alert > 0.45) reveal(a);
    } else a.alert = Math.max(0, a.alert - dt);
  }

  function sameLane(a) {
    return g.area.kind !== 'street' || laneOf(a.y) === laneOf(g.player.y);
  }

  function updateGrunt(a, dt) {
    const p = g.player;
    const d = g.stage.diff;
    if (!sameLane(a)) {
      walkAround(a, dt, 25);
      applyPhysics(a, dt, g.area);
      return;
    }
    const dir = a.charging ? a.face : p.x < a.x ? -1 : 1;
    if (!a.charging) a.face = dir;
    // Charging grunts run past the player, Contra style, until they turn.
    if (a.charging && Math.abs(p.x - a.x) > 120 && Math.sign(p.x - a.x) !== a.face) a.charging = false;
    a.vx = dir * d.enemySpeed;
    const hitWall = applyPhysics(a, dt, g.area);
    if (a.onGround && (hitWall || (!floorAhead(a, g.area, dir) && g.rng.chance(0.7)))) a.vy = -290;
  }

  function updateGunner(a, dt) {
    const p = g.player;
    const d = g.stage.diff;
    a.face = p.x < a.x ? -1 : 1;
    a.vx = 0;
    applyPhysics(a, dt, g.area);
    a.fireTimer -= dt;
    const onScreen = a.x > g.cam.x && a.x < g.cam.x + g.W;
    if (a.fireTimer <= 0 && onScreen && sameLane(a) && Math.abs(p.x - a.x) < g.W * 0.7) {
      a.fireTimer = d.fireDelay * (0.8 + g.rng.next() * 0.4);
      const ox = a.x + a.face * 7;
      const oy = a.y - 15;
      const dx = p.x - ox;
      const dy = p.y - 12 - oy;
      let vx;
      let vy;
      if (Math.abs(dy) < 14) {
        // Level shots fly at chest height, so crouching dodges them.
        vx = a.face * 105;
        vy = 0;
      } else {
        const len = Math.hypot(dx, dy);
        vx = (dx / len) * 95;
        vy = (dy / len) * 95;
      }
      g.shots.push({ x: ox, y: oy, vx, vy, life: 4, r: 2 });
      sfx('plasma');
    }
  }

  // ---------- Boss ----------

  function bossShoot(b, angle, speed = 90) {
    g.shots.push({ x: b.x, y: b.y - 34, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 5, r: 3 });
  }

  function updateBoss(b, dt) {
    const p = g.player;
    const n = g.stageNum;
    const enraged = b.hp < b.maxHp * 0.5;
    b.timer -= dt;
    b.flash -= dt;
    const left = 3 * TILE;
    const right = (ARENA_COLS - 3) * TILE;
    const toward = (tx, speed) => {
      const dx = tx - b.x;
      b.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
      return Math.abs(dx) < 2;
    };
    const t = g.time;
    switch (b.pattern) {
      case 'move':
        b.y = b.baseY + Math.sin(t * 2) * 8;
        if (toward(b.targetX, 70) || b.timer <= 0) {
          const pool = ['aimed', 'rain'];
          if (n >= 2 || enraged) pool.push('summon');
          if (n >= 3) pool.push('ring');
          if (n >= 4 || enraged) pool.push('dive');
          b.pattern = g.rng.pick(pool);
          b.timer = 0.6;
          b.count = 0;
        }
        break;
      case 'aimed':
        b.y = b.baseY + Math.sin(t * 2) * 8;
        if (b.timer <= 0) {
          const a = Math.atan2(p.y - 12 - (b.y - 34), p.x - b.x);
          const spread = enraged ? [-0.3, -0.15, 0, 0.15, 0.3] : [-0.2, 0, 0.2];
          spread.forEach((s) => bossShoot(b, a + s, 95 + n * 3));
          sfx('plasma');
          b.timer = enraged ? 0.45 : 0.6;
          if (++b.count >= 3) nextBossMove(b);
        }
        break;
      case 'rain':
        b.y = b.baseY - 20;
        if (b.count === 0) b.targetX = b.x < (left + right) / 2 ? right : left;
        b.count = 1;
        if (b.timer <= 0) {
          g.shots.push({ x: b.x, y: b.y, vx: 0, vy: 70, life: 4, r: 3 });
          sfx('plasma');
          b.timer = enraged ? 0.18 : 0.26;
        }
        if (toward(b.targetX, 85)) nextBossMove(b);
        break;
      case 'summon':
        b.y = b.baseY + Math.sin(t * 4) * 4;
        if (b.timer <= 0) {
          for (const side of [-1, 1]) {
            const x = side < 0 ? left : right;
            const a = spawnActor({ type: 'grunt', x, y: ARENA_FLOOR * TILE });
            a.face = -side;
          }
          sfx('reveal');
          nextBossMove(b);
        }
        break;
      case 'ring':
        b.y = b.baseY + Math.sin(t * 2) * 8;
        if (b.timer <= 0) {
          const k = enraged ? 14 : 10;
          for (let i = 0; i < k; i++) bossShoot(b, (i / k) * Math.PI * 2 + b.count * 0.3, 80);
          sfx('plasma');
          b.timer = 0.7;
          if (++b.count >= 2) nextBossMove(b);
        }
        break;
      case 'dive':
        // Swoop down at the player, then climb back up.
        if (b.count === 0) {
          b.diveX = p.x;
          b.count = 1;
        }
        if (b.count === 1) {
          toward(b.diveX, 110);
          b.y = Math.min(b.y + 150 * dt, ARENA_FLOOR * TILE);
          if (b.y >= ARENA_FLOOR * TILE) {
            b.count = 2;
            g.shake = 0.3;
            sfx('explode');
            for (const dir of [-1, 1]) g.shots.push({ x: b.x, y: b.y - 4, vx: dir * 110, vy: 0, life: 3, r: 3 });
          }
        } else {
          b.y -= 90 * dt;
          if (b.y <= b.baseY) nextBossMove(b);
        }
        break;
    }
    if (overlap(b, p)) hurtPlayer();
  }

  function nextBossMove(b) {
    b.pattern = 'move';
    b.targetX = (4 + g.rng.next() * (ARENA_COLS - 8)) * TILE;
    b.timer = 2.5;
  }

  function killBoss() {
    const b = g.boss;
    b.hp = 0;
    b.dead = true;
    g.bossDeadTimer = 2.5;
    g.addScore(5000);
    addText(b.x, b.y - 70, '+5000', '#f8d800', 2);
    sfx('explode');
    g.shots = [];
    for (const a of g.actors) if (a !== b && !isInnocent(a)) killActor(a, false);
  }

  // ---------- Bullets, shots, pickups ----------

  function updateBullets(dt) {
    for (const b of g.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.kind === 'flame') {
        b.vy -= 60 * dt;
        b.vx *= 0.97;
      }
      if (blocked(g.area, b.x, b.y)) {
        b.life = 0;
        burst(b.x, b.y, b.kind === 'flame' ? '#f87800' : '#fcfcfc', 2, 30);
        continue;
      }
      for (const a of g.actors) {
        if (a.dead || a.carriedBy || b.hit.has(a) || b.life <= 0) continue;
        if (!pointIn(a, b.x, b.y, b.kind === 'flame' ? 3 : 1)) continue;
        b.hit.add(a);
        damageActor(a, b.dmg);
        if (b.pierce-- <= 0) b.life = 0;
      }
    }
    g.bullets = g.bullets.filter((b) => b.life > 0);
  }

  function updateShots(dt) {
    const p = g.player;
    const hitbox = { x: p.x, y: p.y, w: p.w - 2, h: p.h - 2 };
    for (const s of g.shots) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (blocked(g.area, s.x, s.y)) s.life = 0;
      else if (g.mode === 'play' && pointIn(hitbox, s.x, s.y, s.r - 1)) {
        s.life = 0;
        hurtPlayer();
      }
    }
    g.shots = g.shots.filter((s) => s.life > 0 && s.x > g.cam.x - 40 && s.x < g.cam.x + g.W + 40 && s.y < VIEW_H + 20);
  }

  function updatePickups(dt) {
    const p = g.player;
    const gl = g.glasses;
    if (g.area.kind === 'street' && !gl.taken) {
      const box = { x: g.area.glasses.x, y: g.area.glasses.y, w: 14, h: 14 };
      if (overlap(box, p)) {
        gl.taken = true;
        gl.have = true;
        gl.on = true;
        gl.meter = 1;
        sfx('found');
        g.banner = { title: 'SUNGLASSES!', sub: input.usingTouch ? 'TAP THE SHADES BUTTON TO SEE THE TRUTH' : 'PRESS G TO PUT THEM ON AND OFF', t: 3.5 };
      }
    }
    for (const k of g.pickups) {
      if (k.taken) continue;
      if (k.dropped) {
        const body = { x: k.x, y: k.y, w: 8, h: 8, vx: 0, vy: k.vy };
        applyPhysics(body, dt, g.area);
        k.y = body.y;
        k.vy = body.vy;
        if (k.y > VIEW_H + 20 || inSludge(k)) {
          k.taken = true;
          if (k.kind === 'P') g.carrierPending = true;
        }
      }
      if (k.hidden && !gl.on) continue;
      if (!overlap({ x: k.x, y: k.y, w: 10, h: 12 }, p)) continue;
      k.taken = true;
      sfx('pickup');
      collect(k);
    }
  }

  function collect(k) {
    const p = g.player;
    if (WEAPON_INFO[k.kind]) {
      g.weapon = k.kind;
      addText(p.x, p.y - 30, WEAPON_INFO[k.kind].name, '#f8d800', 1.2);
    } else if (k.kind === '+') {
      if (g.hearts < MAX_HEARTS) {
        g.hearts++;
        addText(p.x, p.y - 30, '+1 HEART', '#fc7460');
      } else {
        g.addScore(500);
        addText(p.x, p.y - 30, '+500', '#fcfcfc');
      }
    } else if (k.kind === 'H') {
      g.armor = true;
      addText(p.x, p.y - 30, 'HARD HAT', '#f8d800');
    } else if (k.kind === 'P') {
      g.portal.have = true;
      g.banner = {
        title: 'PORTAL DEVICE!',
        sub: input.usingTouch ? 'TAP THE PORTAL BUTTON TO WARP BELOW' : 'PRESS V TO WARP BETWEEN STREET AND SEWER',
        t: 3.5,
      };
    } else if (k.kind === 'C') {
      if (g.glasses.contacts) {
        g.addScore(1000);
        addText(p.x, p.y - 30, '+1000', '#fcfcfc');
      } else {
        g.glasses.contacts = true;
        g.banner = { title: 'CONTACT LENSES!', sub: 'SHADES HURT HALF AS MUCH', t: 2.5 };
      }
    }
  }

  function updateParticles(dt) {
    for (const q of g.particles) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 300 * dt;
      q.life -= dt;
    }
    g.particles = g.particles.filter((q) => q.life > 0);
    for (const t of g.texts) {
      t.y -= 18 * dt;
      t.life -= dt;
    }
    g.texts = g.texts.filter((t) => t.life > 0);
  }

  // ---------- Main update ----------

  function updateActors(dt) {
    for (const a of g.actors) {
      if (a.dead) continue;
      if (a.flash > 0) a.flash -= dt;
      a.anim += dt;
      if (a.carriedBy) {
        // Held over a snatcher's head.
        a.x = a.carriedBy.x;
        a.y = a.carriedBy.y - 22;
        a.face = a.carriedBy.face;
        continue;
      }
      if (a.type === 'boss') updateBoss(a, dt);
      else if (isInnocent(a)) updateCivilian(a, dt);
      else if (a.type === 'snatcher') updateSnatcher(a, dt);
      else if (!a.revealed) updateDisguised(a, dt);
      else if (a.type === 'grunt') updateGrunt(a, dt);
      else updateGunner(a, dt);

      if (a.type !== 'boss' && !isInnocent(a) && a.revealed && overlap(a, g.player)) hurtPlayer();
      // Sunk, gone off the bottom, or left far behind.
      if (a.y > VIEW_H + 30 || (a.type !== 'boss' && (inSludge(a) || a.x < g.cam.x - 48 || a.x > g.cam.x + g.W + 160))) {
        a.gone = true;
        if (a.carrier && !g.portal.have) g.carrierPending = true;
        if (a.child) childLost(a);
      }
    }
    g.actors = g.actors.filter((a) => !a.dead && !a.gone && !(a.carriedBy && (a.carriedBy.dead || a.carriedBy.gone)));
  }

  function updatePlay(dt) {
    if (g.portal.cd > 0) g.portal.cd -= dt;
    for (const f of g.portalFx) f.t += dt;
    g.portalFx = g.portalFx.filter((f) => f.t < 0.5);
    updateGlasses(dt);
    updatePlayer(dt);
    if (g.mode !== 'play' && g.mode !== 'dying') return;
    g.updateCamera(dt);
    if (g.helpTimer > 0) g.helpTimer -= dt;
    if (g.areaKey !== 'boss') {
      spawnFromSpawnList();
      spawnWave(dt);
      trySnatch(dt);
    }
    updateActors(dt);
    updateBullets(dt);
    updateShots(dt);
    updatePickups(dt);
    if (g.boss && g.boss.dead) {
      g.bossDeadTimer -= dt;
      if (g.rng.chance(dt * 12)) {
        burst(g.boss.x + (g.rng.next() - 0.5) * 40, g.boss.y - g.rng.next() * 60, g.rng.pick(['#f87800', '#f8d800', '#58d854']), 10, 120);
        if (g.rng.chance(0.3)) sfx('explode');
      }
      if (g.bossDeadTimer <= 0) g.stageClear();
    }
  }

  function updateMenu() {
    const m = g.menu;
    if (!m) return;
    const n = m.items.length;
    if (input.pressed.up) m.sel = (m.sel + n - 1) % n;
    if (input.pressed.down) m.sel = (m.sel + 1) % n;
    if (input.pressed.start || input.pressed.fire || input.pressed.jump) {
      const item = m.items[m.sel];
      g.menu = null;
      item.action();
      if (!g.menu && (g.mode === 'title' || g.mode === 'paused')) g.menu = m; // settings toggles keep the menu
    }
  }

  g.activate = function (index) {
    const m = g.menu;
    if (!m || !m.items[index]) return;
    m.sel = index;
    g.menu = null;
    m.items[index].action();
    if (!g.menu && (g.mode === 'title' || g.mode === 'paused')) g.menu = m;
  };

  /** Advances the game by one fixed step. */
  g.step = function (inp) {
    input = inp;
    const dt = STEP;
    g.time += dt;
    if (g.shake > 0) g.shake -= dt;
    if (g.banner) {
      g.banner.t -= dt;
      if (g.banner.t <= 0) g.banner = null;
    }
    if (input.pressed.pause) {
      if (g.mode === 'play') return g.pause();
      if (g.mode === 'paused') return g.resume();
    }
    switch (g.mode) {
      case 'title':
      case 'paused':
      case 'gameover':
      case 'clear':
        updateMenu();
        break;
      case 'play':
        updatePlay(dt);
        updateParticles(dt);
        break;
      case 'dying': {
        const p = g.player;
        p.vy += GRAVITY * dt;
        p.y += p.vy * dt;
        g.dyingTimer -= dt;
        updateShots(dt);
        updateParticles(dt);
        if (g.dyingTimer <= 0) g.gameOver();
        break;
      }
      case 'transition': {
        const tr = g.transition;
        tr.t += dt;
        g.fade = tr.t < 0.6 ? tr.t / 0.6 : Math.max(0, 1 - (tr.t - 0.9) / 0.6);
        if (tr.t >= 0.9 && !tr.done) {
          tr.done = true;
          g.enterArea(tr.key);
          g.mode = 'transition';
          g.banner = { title: AREA_TITLES[tr.key], sub: tr.key === 'boss' ? g.stage.bossName : '', t: 2 };
        }
        if (tr.t >= 1.5) {
          g.fade = 0;
          g.mode = 'play';
        }
        updateParticles(dt);
        break;
      }
    }
  };

  g.STEP = STEP;
  return g;
}
