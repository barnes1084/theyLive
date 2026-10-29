// Game rules: the player, weapons, sunglasses, people, lizards, the boss,
// and moving from the city down to the tunnels and on to the next stage.

import { TILE, ROWS, T, GRAVITY, JUMP_V, RUN_SPEED, ARENA_COLS, WEAPONS, tileAt, isSolid, generateStage } from './stage.js';
import { sfx, playMusic } from './audio.js';
import { makeRng } from './rng.js';

export const VIEW_H = ROWS * TILE;
const STEP = 1 / 60;
const MAX_HEARTS = 4;

export const WEAPON_INFO = {
  G: { name: 'SHOTGUN', delay: 0.5 },
  N: { name: 'NAIL GUN', delay: 0.1 },
  T: { name: 'TORCH', delay: 0.05 },
  S: { name: 'SLUGS', delay: 0.42 },
};

const AREA_TITLES = { city: 'THE STREETS', tunnel: 'THE SEWERS', boss: 'THE LAIR' };

// ---------- Saved progress ----------

const SAVE_KEY = 'theylive-save';

export function loadSave() {
  try {
    return { bestStage: 0, bestScore: 0, sound: true, music: true, ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') };
  } catch {
    return { bestStage: 0, bestScore: 0, sound: true, music: true };
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
    areaKey: 'city',
    area: null,
    cam: { x: 0 },
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
      ],
      sel: 0,
    };
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
    g.startStage(1);
  };

  g.startStage = function (n) {
    g.stageNum = n;
    g.stage = generateStage(n, g.runSeed);
    // The lizards took your shades. Find them again.
    Object.assign(g.glasses, { have: false, on: false, meter: 1, locked: false, taken: false });
    g.stageStats = { lizards: 0, innocents: 0, score: g.score };
    g.enterArea('city');
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
      y: g.area.ground[startC] * TILE,
      w: 8,
      h: 21,
      vx: 0,
      vy: 0,
      face: 1,
      onGround: true,
      crouch: false,
      aim: { x: 1, y: 0 },
      fireCd: 0,
      inv: key === 'city' ? 0 : 1,
      drop: 0,
      coyote: 0,
      jumpBuf: 0,
      anim: 0,
      firing: 0,
    };
    if (key === 'boss') {
      g.cam.x = (ARENA_COLS * TILE - g.W) / 2;
      const d = g.stage.diff;
      g.boss = {
        type: 'boss',
        x: ARENA_COLS * TILE * 0.7,
        y: 100,
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
        baseY: 100,
        name: g.stage.bossName,
      };
      g.actors.push(g.boss);
    }
    playMusic(key);
    g.mode = 'play';
  };

  /** Fades to black, swaps area, fades back in. */
  g.transitionTo = function (key) {
    g.mode = 'transition';
    g.transition = { key, t: 0 };
    sfx('descend');
  };

  g.stageClear = function () {
    g.mode = 'clear';
    const bonus = 1000 * g.stageNum;
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
    if (!force && p.inv > 0) return;
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

  /** First standable column at or after column c. */
  function safeColumn(c) {
    for (let i = Math.max(c, 0); i < g.area.cols; i++) {
      const gr = g.area.ground[i];
      if (gr >= 0 && !isSolid(tileAt(g.area, i, gr - 1)) && !isSolid(tileAt(g.area, i, gr - 2))) return i;
    }
    return c;
  }

  function respawnPlayer() {
    const p = g.player;
    const c = safeColumn(Math.floor((g.cam.x + 24) / TILE));
    p.x = c * TILE + TILE / 2;
    p.y = g.area.ground[c] * TILE;
    p.vx = p.vy = 0;
    p.inv = 2;
  }

  // ---------- Glasses ----------

  function updateGlasses(dt) {
    const gl = g.glasses;
    if (!gl.have) return;
    if (input.pressed.glasses) {
      if (gl.on) {
        gl.on = false;
        sfx('glassesOff');
      } else if (!gl.locked) {
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

    p.crouch = p.onGround && dirY > 0 && dirX === 0;
    p.h = p.crouch ? 13 : 21;
    p.vx = p.crouch ? 0 : dirX * RUN_SPEED;
    if (dirX) p.face = dirX;

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

    // Falling into the manhole takes you down to the tunnels.
    const exit = area.exit;
    if (area.kind === 'city' && p.y > exit.r * TILE + 24 && p.x > exit.c0 * TILE - 4 && p.x < (exit.c1 + 1) * TILE + 4) {
      g.transitionTo('tunnel');
      return;
    }
    if (area.kind === 'tunnel' && p.x >= exit.c0 * TILE + 8) {
      g.transitionTo('boss');
      return;
    }
    // Pits and sludge.
    const inSludge = area.kind === 'tunnel' && p.y > (ROWS - 1) * TILE + 4;
    if (p.y > VIEW_H + 24 || inSludge) {
      if (inSludge) burst(p.x, p.y - 4, '#58d854', 12);
      p.inv = 0;
      hurtPlayer(true);
      if (g.mode === 'play') respawnPlayer();
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
      for (let i = -2; i <= 2; i++) shoot(i * 0.11 + (g.rng.next() - 0.5) * 0.05, 250 + g.rng.next() * 40, 0.3, 1, 'pellet');
      sfx('shotgun');
      g.shake = Math.max(g.shake, 0.06);
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
    for (const a of g.actors) if (a.type === 'civilian' && Math.abs(a.x - p.x) < 160) a.panic = true;
  }

  // ---------- People and lizards ----------

  function spawnActor(sp) {
    const tunnel = g.area.kind !== 'city';
    const a = {
      type: sp.type,
      x: sp.x,
      y: sp.y,
      w: 8,
      h: 21,
      vx: 0,
      vy: 0,
      face: g.rng.chance(0.5) ? 1 : -1,
      onGround: true,
      look: sp.look ?? 0,
      disguised: !!sp.disguised,
      revealed: !sp.disguised,
      hp: sp.type === 'gunner' ? 4 : tunnel ? 3 : 2,
      walk: 0,
      timer: 1 + g.rng.next() * 2,
      fireTimer: 1 + g.rng.next() * g.stage.diff.fireDelay,
      glance: 0,
      alert: 0,
      anim: g.rng.next() * 2,
      flash: 0,
      panic: false,
    };
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

  /** Lizards keep pouring out of the dark in the tunnels. */
  function spawnWave(dt) {
    if (g.area.kind !== 'tunnel') return;
    g.waveTimer -= dt;
    if (g.waveTimer > 0) return;
    const d = g.stage.diff;
    g.waveTimer = d.waveDelay * (0.7 + g.rng.next() * 0.6);
    if (g.cam.x + g.W > (g.area.exit.c0 - 4) * TILE) return;
    const behind = g.rng.chance(0.2);
    const x = behind ? g.cam.x + 4 : g.cam.x + g.W + 8;
    const c = Math.floor(x / TILE);
    const gr = g.area.ground[c];
    if (gr < 0) return;
    const a = spawnActor({ type: 'grunt', x, y: gr * TILE });
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
    if (a.type === 'civilian') {
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
    // Sometimes they drop something.
    if (g.rng.chance(0.09)) {
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
    if (a.type !== 'civilian') {
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
    if (a.panic) {
      const dir = a.x < g.player.x ? -1 : 1;
      a.face = dir;
      a.vx = dir * 75;
      if (a.onGround && !floorAhead(a, g.area, dir)) a.vy = -260;
    } else walkAround(a, dt, 20);
    if (applyPhysics(a, dt, g.area) && a.onGround) a.vy = -260;
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

  function updateGrunt(a, dt) {
    const p = g.player;
    const d = g.stage.diff;
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
    if (a.fireTimer <= 0 && onScreen && Math.abs(p.x - a.x) < g.W * 0.7) {
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
            const a = spawnActor({ type: 'grunt', x, y: 9 * TILE });
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
          b.y = Math.min(b.y + 150 * dt, 9 * TILE);
          if (b.y >= 9 * TILE) {
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
    for (const a of g.actors) if (a !== b && a.type !== 'civilian') killActor(a, false);
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
        if (a.dead || b.hit.has(a) || b.life <= 0) continue;
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
    if (g.area.kind === 'city' && !gl.taken) {
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
        if (k.y > VIEW_H + 20) k.taken = true;
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
      if (a.type === 'boss') updateBoss(a, dt);
      else if (a.type === 'civilian') updateCivilian(a, dt);
      else if (!a.revealed) updateDisguised(a, dt);
      else if (a.type === 'grunt') updateGrunt(a, dt);
      else updateGunner(a, dt);

      if (a.type !== 'boss' && a.type !== 'civilian' && a.revealed && overlap(a, g.player)) hurtPlayer();
      // Gone off the bottom, or left far behind.
      if (a.y > VIEW_H + 30 || (a.type !== 'boss' && (a.x < g.cam.x - 48 || a.x > g.cam.x + g.W + 160))) a.gone = true;
    }
    g.actors = g.actors.filter((a) => !a.dead && !a.gone);
  }

  function updatePlay(dt) {
    updateGlasses(dt);
    updatePlayer(dt);
    if (g.mode !== 'play' && g.mode !== 'dying') return;
    if (g.areaKey !== 'boss') {
      const target = g.player.x - g.W * 0.4;
      g.cam.x = Math.max(g.cam.x, Math.min(target, g.area.cols * TILE - g.W));
      spawnFromSpawnList();
      spawnWave(dt);
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
