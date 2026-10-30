// Draws the game at the screen's full resolution with smooth vector art,
// gradients and lighting. The world is drawn in world pixels scaled to fill
// the screen; the HUD and menus use screen units (VIEW_H tall). With the
// sunglasses on, the world turns black and white and lizards stay in color.

import { TILE, ROWS, LANE_ROWS, ARENA_COLS, ARENA_FLOOR, T, tileAt, isSolid, laneOf } from './stage.js';
import { drawFigure, drawHeroBall, drawMoloch, drawTile, drawHeart, drawHardHat, drawShades, roundRect, tone, alpha } from './art.js';
import { heroPose, heroMuzzle } from './hero.js';
import { hash } from './rng.js';
import { WEAPON_INFO, VIEW_H, PEDESTAL_H } from './game.js';

const H = VIEW_H;
const LANE_H = LANE_ROWS * TILE;
const FONT = '"Russo One", "Arial Black", sans-serif';

let K = 1; // canvas pixels per world pixel
let HK = 1; // canvas pixels per screen unit
let frameCount = 0;

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const cache = new Map();
function cached(key, w, h, draw) {
  let c = cache.get(key);
  if (!c) {
    c = makeCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
    draw(c.getContext('2d'));
    cache.set(key, c);
  }
  return c;
}

function dropCached(prefix, keep) {
  const keys = [...cache.keys()].filter((k) => k.startsWith(prefix));
  for (const k of keys.slice(0, Math.max(0, keys.length - keep))) cache.delete(k);
}

// ---------- Text ----------

/** Text with a dark outline, in the current transform's units. */
export function text(ctx, str, x, y, size, color, align = 'left', outline = 'rgba(8,4,16,0.9)') {
  ctx.save();
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = size * 0.22;
    ctx.strokeText(str, x, y);
  }
  const g = ctx.createLinearGradient(0, y, 0, y + size);
  g.addColorStop(0, tone(color, 0.35));
  g.addColorStop(1, tone(color, -0.1));
  ctx.fillStyle = g;
  ctx.fillText(str, x, y);
  ctx.restore();
}

// ---------- Main ----------

export function render(ctx, g, usingTouch) {
  const canvas = ctx.canvas;
  K = canvas.height / g.viewH;
  HK = canvas.height / H;
  const SW = g.screenW;
  const screen = () => ctx.setTransform(HK, 0, 0, HK, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  g.menuRects = [];
  if (++frameCount % 120 === 0) {
    dropCached('bld:', 40);
    dropCached('tile:', 400);
  }

  if (g.mode === 'title') {
    screen();
    drawTitle(ctx, g, usingTouch);
    drawMenu(ctx, g, 138);
    return;
  }

  const shaking = g.shake > 0;
  const sx = shaking ? (Math.random() - 0.5) * 3 : 0;
  const sy = shaking ? (Math.random() - 0.5) * 2 : 0;
  const camX = g.cam.x;
  const camY = g.cam.y;
  const truth = g.glasses.on;
  // World transform: world pixels, camera at the top-left.
  const world = (dx = 0, dy = 0) => {
    ctx.setTransform(K, 0, 0, K, 0, 0);
    ctx.translate(dx, dy - camY);
  };

  world();
  const lamps = drawBackground(ctx, g, camX);
  ctx.translate(-camX + sx, sy);
  drawDecor(ctx, g, truth);
  drawTiles(ctx, g, camX);
  drawPickups(ctx, g, false);
  for (const a of g.actors) if (!(truth && isLizard(a))) drawActor(ctx, g, a, false);
  drawPlayer(ctx, g);
  drawBullets(ctx, g);
  if (!truth) drawShots(ctx, g);
  drawParticles(ctx, g);
  world();
  if (g.area.kind === 'street') drawSewerLight(ctx, g, camX, lamps);
  else drawTempleLight(ctx, g, camX);

  if (truth) {
    truthFilter(ctx);
    world(-camX + sx, sy);
    for (const a of g.actors) if (isLizard(a)) drawActor(ctx, g, a, true);
    drawPickups(ctx, g, true);
    drawShots(ctx, g);
  }

  world(-camX, 0);
  drawPortalFx(ctx, g);
  for (const t of g.texts) text(ctx, t.text, t.x, t.y - 4, 4.2, t.color, 'center');

  screen();
  drawVignette(ctx, SW);
  drawLaneAlerts(ctx, g, camX, camY);
  drawHud(ctx, g);
  if (g.banner) drawBanner(ctx, g);
  if (g.fade > 0) {
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, g.fade)})`;
    ctx.fillRect(0, 0, SW, H);
  }
  if (g.mode === 'paused') drawPaused(ctx, g);
  else if (g.mode === 'gameover') drawGameOver(ctx, g);
  else if (g.mode === 'clear') drawClear(ctx, g);
}

function isLizard(a) {
  return a.type === 'grunt' || a.type === 'gunner' || a.type === 'snatcher' || a.type === 'cultist' || a.type === 'boss';
}

// ---------- Effects ----------

/** A soft additive glow. */
function glow(ctx, x, y, r, color, a = 1) {
  if (r <= 0 || a <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, alpha(color, 0.8 * a));
  g.addColorStop(0.4, alpha(color, 0.35 * a));
  g.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

function drawVignette(ctx, SW) {
  const g = ctx.createRadialGradient(SW / 2, H / 2, H * 0.45, SW / 2, H / 2, SW * 0.7);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SW, H);
}

let scratch = null;
let grain = null;

/** Black and white with extra contrast and film grain, like the film's glasses. */
function truthFilter(ctx) {
  const canvas = ctx.canvas;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if ('filter' in ctx) {
    if (!scratch || scratch.width !== canvas.width || scratch.height !== canvas.height) scratch = makeCanvas(canvas.width, canvas.height);
    const s = scratch.getContext('2d');
    s.clearRect(0, 0, scratch.width, scratch.height);
    s.drawImage(canvas, 0, 0);
    ctx.filter = 'grayscale(1) contrast(1.4) brightness(1.05)';
    ctx.drawImage(scratch, 0, 0);
    ctx.filter = 'none';
  }
  if (!grain) {
    grain = makeCanvas(128, 128);
    const gc = grain.getContext('2d');
    const img = gc.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data.set([v, v, v, 28], i);
    }
    gc.putImageData(img, 0, 0);
  }
  const ox = Math.floor(Math.random() * 128);
  const oy = Math.floor(Math.random() * 128);
  for (let y = -oy; y < canvas.height; y += 128) for (let x = -ox; x < canvas.width; x += 128) ctx.drawImage(grain, x, y);
  ctx.restore();
}

// ---------- City background ----------

function drawCitySky(ctx, W, camX, time, top = 0) {
  const sky = ctx.createLinearGradient(0, top, 0, top + LANE_H);
  sky.addColorStop(0, '#141a44');
  sky.addColorStop(0.45, '#3a3c8c');
  sky.addColorStop(0.75, '#c8607a');
  sky.addColorStop(1, '#f8b070');
  ctx.fillStyle = sky;
  ctx.fillRect(0, top, W, LANE_H);
  // Setting sun
  const sunX = W * 0.72;
  glow(ctx, sunX, top + 108, 80, '#ff9a50', 0.5);
  ctx.fillStyle = '#ffd890';
  ctx.beginPath();
  ctx.arc(sunX, top + 108, 13, 0, Math.PI * 2);
  ctx.fill();
  // Clouds
  const cp = camX * 0.06 + time * 2;
  for (let k = Math.floor(cp / 120) - 1; k < (cp + W) / 120 + 1; k++) {
    const x = k * 120 - cp + (hash(k, 3) % 50);
    const y = top + 18 + (hash(k, 4) % 34);
    for (let i = 0; i < 4; i++) {
      const bx = x + i * 9 - 12;
      const by = y + Math.sin(i * 2 + k) * 2;
      const r = 9 + (hash(k, i) % 5);
      const cg = ctx.createRadialGradient(bx, by - 2, 1, bx, by, r);
      cg.addColorStop(0, 'rgba(255,214,200,0.55)');
      cg.addColorStop(1, 'rgba(160,110,160,0)');
      ctx.fillStyle = cg;
      ctx.fillRect(bx - r, by - r, r * 2, r * 2);
    }
  }
  // Far skyline silhouettes
  const far = camX * 0.18;
  ctx.fillStyle = '#4a3a78';
  for (let k = Math.floor(far / 18) - 1; k < (far + W) / 18 + 1; k++) {
    const h = 26 + (hash(k, 11) % 46);
    const x = k * 18 - far;
    ctx.fillRect(x, top + 104 - h, 17.4, h + 40);
    if (hash(k, 12) % 5 === 0) {
      ctx.fillRect(x + 8, top + 96 - h, 0.8, 8);
      if (Math.floor(time * 2 + k) % 2) glow(ctx, x + 8.4, top + 96 - h, 2.5, '#ff4040');
      ctx.fillStyle = '#4a3a78';
    }
  }
  ctx.fillStyle = 'rgba(255,220,150,0.55)';
  for (let k = Math.floor(far / 18) - 1; k < (far + W) / 18 + 1; k++) {
    const h = 26 + (hash(k, 11) % 46);
    const x = k * 18 - far;
    for (let wy = top + 108 - h; wy < top + 100; wy += 4) for (let wx = 2; wx < 15; wx += 3) if (hash(k, wx, wy - top) % 4 === 0) ctx.fillRect(x + wx, wy, 1, 1.2);
  }
  // Haze
  const haze = ctx.createLinearGradient(0, top + 60, 0, top + LANE_H);
  haze.addColorStop(0, 'rgba(248,170,120,0)');
  haze.addColorStop(1, 'rgba(248,170,120,0.35)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, top + 60, W, LANE_H - 60);
  // Middle layer
  const mid = camX * 0.32;
  for (let k = Math.floor(mid / 34) - 1; k < (mid + W) / 34 + 1; k++) {
    const h = 30 + (hash(k, 31) % 40);
    const x = k * 34 - mid;
    const mg = ctx.createLinearGradient(x, 0, x + 32, 0);
    mg.addColorStop(0, '#3c3466');
    mg.addColorStop(1, '#2a2450');
    ctx.fillStyle = mg;
    ctx.fillRect(x, top + 120 - h, 32, h + 30);
    ctx.fillStyle = 'rgba(255,214,140,0.8)';
    for (let wy = top + 125 - h; wy < top + 118; wy += 6) {
      for (let wx = 3; wx < 27; wx += 5) if (hash(k, wx, wy - top) % 4 === 0) ctx.fillRect(x + wx, wy, 2.4, 3);
    }
  }
  // Near buildings
  const near = camX * 0.52;
  for (let k = Math.floor(near / 62) - 1; k < (near + W) / 62 + 1; k++) {
    const b = buildingImage(k);
    ctx.drawImage(b.img, k * 62 - near, top + 134 - b.h - 22, 56, b.h + 22);
  }
}

/** A detailed brick building, cached at the current resolution. */
function buildingImage(k) {
  const floors = 3 + (hash(k, 21) % 4);
  const h = floors * 14 + 10;
  const w = 56;
  const img = cached(`bld:${k}:${K.toFixed(2)}`, w * K, (h + 22) * K, (c) => {
    c.scale(K, K);
    c.translate(0, 22);
    const palettes = ['#9c4a34', '#7c7c8c', '#a07c44', '#6c4c3c', '#8a4c62', '#4c5c80'];
    const base = palettes[hash(k, 22) % palettes.length];
    const bg = c.createLinearGradient(0, 0, w, 0);
    bg.addColorStop(0, tone(base, 0.05));
    bg.addColorStop(0.8, base);
    bg.addColorStop(1, tone(base, -0.35));
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h + 40);
    c.strokeStyle = tone(base, -0.2);
    c.lineWidth = 0.25;
    for (let y = 4; y < h + 40; y += 2) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    c.fillStyle = tone(base, 0.3);
    c.fillRect(-1, 0, w + 2, 3);
    c.fillStyle = tone(base, -0.4);
    c.fillRect(-1, 3, w + 2, 1);
    for (let f = 0; f < floors; f++) {
      const wy = 7 + f * 14;
      for (let i = 0; i < 4; i++) {
        const wx = 4 + i * 12.5;
        const lit = hash(k, i, f) % 4 === 0;
        roundRect(c, wx - 0.6, wy - 0.6, 8.2, 10.2, 0.6);
        c.fillStyle = tone(base, -0.5);
        c.fill();
        const gg = c.createLinearGradient(0, wy, 0, wy + 9);
        if (lit) {
          gg.addColorStop(0, '#fff0b0');
          gg.addColorStop(1, '#e09040');
        } else {
          gg.addColorStop(0, '#a6c0e8');
          gg.addColorStop(1, '#283656');
        }
        c.fillStyle = gg;
        c.fillRect(wx, wy, 7, 9);
        c.fillStyle = 'rgba(255,255,255,0.35)';
        c.beginPath();
        c.moveTo(wx + 1, wy + 6);
        c.lineTo(wx + 4, wy + 1);
        c.lineTo(wx + 5, wy + 1);
        c.lineTo(wx + 2, wy + 6);
        c.fill();
        c.fillStyle = '#d8d0c0';
        c.fillRect(wx - 1, wy + 9.4, 9, 1);
        c.fillRect(wx + 3.2, wy, 0.6, 9);
      }
    }
    const roof = hash(k, 23) % 3;
    if (roof === 0) {
      c.fillStyle = '#5c3c24';
      roundRect(c, 15, -15, 12, 11, 1);
      c.fill();
      c.fillStyle = '#3c3c48';
      c.fillRect(16, -4, 1, 4);
      c.fillRect(25, -4, 1, 4);
      c.beginPath();
      c.moveTo(14, -15);
      c.lineTo(21, -20);
      c.lineTo(28, -15);
      c.fill();
    } else if (roof === 1) {
      for (const x of [8, 32]) {
        c.fillStyle = '#9c9ca8';
        roundRect(c, x, -6, 11, 6, 0.8);
        c.fill();
        c.fillStyle = '#4c4c58';
        c.beginPath();
        c.arc(x + 5.5, -3, 2, 0, Math.PI * 2);
        c.fill();
      }
    } else {
      c.fillStyle = '#4c4c58';
      c.fillRect(35, -20, 1, 20);
      c.fillRect(32, -15, 7, 0.6);
      c.fillStyle = '#ff4040';
      c.beginPath();
      c.arc(35.5, -21, 0.9, 0, Math.PI * 2);
      c.fill();
    }
    if (hash(k, 24) % 2) {
      c.strokeStyle = '#1c1c24';
      c.lineWidth = 0.6;
      for (let f = 0; f < floors; f++) {
        const y = 17 + f * 14;
        c.beginPath();
        c.moveTo(2, y);
        c.lineTo(17, y);
        c.moveTo(2, y - 3);
        c.lineTo(17, y - 3);
        c.moveTo(4, y);
        c.lineTo(14, y + 12);
        c.stroke();
      }
    }
  });
  return { img, h };
}

// ---------- Sewer background ----------

function lampXs(camX, W) {
  const po = camX * 0.75;
  const out = [];
  for (let k = Math.floor(po / 128) - 1; k < (po + W) / 128 + 1; k++) out.push({ x: k * 128 - po + 40, k });
  return out;
}

function drawTunnelBack(ctx, W, camX, time, y0) {
  const h = H - y0;
  const bg = ctx.createLinearGradient(0, y0, 0, H);
  bg.addColorStop(0, '#0e0e1e');
  bg.addColorStop(1, '#05050c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, y0, W, h);
  const off = camX * 0.45;
  const bricks = ['#1c1c32', '#19192c', '#202038'];
  for (let y = y0; y < H; y += 6) {
    const row = Math.floor((y - y0) / 6);
    const shift = row % 2 ? 5 : 0;
    for (let x = -((off + shift) % 10) - 10; x < W; x += 10) {
      ctx.fillStyle = bricks[hash(Math.floor((x + off + shift) / 10), row) % 3];
      roundRect(ctx, x + 0.3, y + 0.3, 9.4, 5.4, 0.8);
      ctx.fill();
    }
  }
  const ao = camX * 0.6;
  for (let k = Math.floor(ao / 150) - 1; k < (ao + W) / 150 + 1; k++) {
    const cx = k * 150 - ao + 60;
    const top = y0 + 44;
    ctx.fillStyle = '#2a2a48';
    ctx.beginPath();
    ctx.moveTo(cx - 30, H);
    ctx.lineTo(cx - 30, top + 26);
    ctx.arc(cx, top + 26, 30, Math.PI, 0);
    ctx.lineTo(cx + 30, H);
    ctx.fill();
    const ag = ctx.createLinearGradient(0, top, 0, H);
    ag.addColorStop(0, '#04040a');
    ag.addColorStop(1, '#0a1c10');
    ctx.fillStyle = ag;
    ctx.beginPath();
    ctx.moveTo(cx - 26, H);
    ctx.lineTo(cx - 26, top + 26);
    ctx.arc(cx, top + 26, 26, Math.PI, 0);
    ctx.lineTo(cx + 26, H);
    ctx.fill();
  }
  const po = camX * 0.75;
  const pipe = (y, r, color) => {
    const g = ctx.createLinearGradient(0, y, 0, y + r);
    g.addColorStop(0, tone(color, 0.45));
    g.addColorStop(0.35, color);
    g.addColorStop(1, tone(color, -0.6));
    ctx.fillStyle = g;
    ctx.fillRect(0, y, W, r);
    const fg = ctx.createLinearGradient(0, y - 1, 0, y + r + 1);
    fg.addColorStop(0, tone(color, 0.5));
    fg.addColorStop(1, tone(color, -0.5));
    ctx.fillStyle = fg;
    for (let x = -(po % 64); x < W; x += 64) {
      roundRect(ctx, x, y - 1, 4, r + 2, 0.8);
      ctx.fill();
    }
  };
  pipe(y0 + 36, 6, '#6c6c7c');
  pipe(y0 + 50, 5, '#4c7c4c');
  ctx.fillStyle = 'rgba(120,170,230,0.8)';
  for (let k = Math.floor(po / 52) - 1; k < (po + W) / 52 + 1; k++) {
    const x = k * 52 - po + (hash(k, 40) % 30);
    const fall = (time * 70 + (hash(k, 41) % 80)) % 90;
    ctx.beginPath();
    ctx.ellipse(x, y0 + 18 + fall, 0.6, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const { x, k } of lampXs(camX, W)) {
    const on = (Math.floor(time * 3) + k) % 7 !== 0;
    ctx.fillStyle = '#2c2c38';
    roundRect(ctx, x - 1.5, y0 + 57, 7, 7, 1);
    ctx.fill();
    ctx.fillStyle = on ? '#c8ff9c' : '#1c4c1c';
    roundRect(ctx, x, y0 + 59, 4, 3.4, 0.8);
    ctx.fill();
    if (on) glow(ctx, x + 2, y0 + 61, 20, '#68e060', 0.6);
  }
  const mist = ctx.createLinearGradient(0, H - 40, 0, H);
  mist.addColorStop(0, 'rgba(90,140,110,0)');
  mist.addColorStop(1, 'rgba(90,140,110,0.18)');
  ctx.fillStyle = mist;
  ctx.fillRect(0, H - 40, W, 40);
}

/** Darkens the sewer lane, except around lamps, the player and gunfire. */
let lightCanvas = null;
function drawSewerLight(ctx, g, camX, lamps) {
  const W = g.W;
  const lw = Math.ceil(W / 4);
  const lh = Math.ceil(LANE_H / 4);
  if (!lightCanvas || lightCanvas.width !== lw || lightCanvas.height !== lh) lightCanvas = makeCanvas(lw, lh);
  const l = lightCanvas.getContext('2d');
  l.globalCompositeOperation = 'source-over';
  l.clearRect(0, 0, lw, lh);
  l.fillStyle = 'rgba(2,2,14,0.6)';
  l.fillRect(0, 0, lw, lh);
  l.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r) => {
    const gx = x / 4;
    const gy = (y - LANE_H) / 4;
    const gr = r / 4;
    const grad = l.createRadialGradient(gx, gy, 0, gx, gy, gr);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    l.fillStyle = grad;
    l.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
  };
  for (const { x } of lamps || []) hole(x + 2, LANE_H + 62, 52);
  const p = g.player;
  if (p && laneOf(p.y) === 1) {
    hole(p.x - camX, p.y - 12, 74);
    if (p.firing > 0) hole(p.x - camX + p.aim.x * 12, p.y - 13, 60);
  }
  for (const s of g.shots) if (s.y > LANE_H) hole(s.x - camX, s.y, 18);
  for (const b of g.bullets) if (b.kind === 'flame' && b.y > LANE_H) hole(b.x - camX, b.y, 16);
  for (const f of g.portalFx) if (f.y > LANE_H) hole(f.x - camX, f.y, 50);
  ctx.drawImage(lightCanvas, 0, LANE_H, lw * 4, lh * 4);
}

/** Warm torchlight and dark corners in the temple. */
function drawTempleLight(ctx, g, camX) {
  const floor = ARENA_FLOOR * TILE;
  const cx = (ARENA_COLS / 2) * TILE - camX;
  const lg = ctx.createRadialGradient(cx, floor - 30, 20, cx, floor - 30, 220);
  lg.addColorStop(0, 'rgba(255,120,40,0.12)');
  lg.addColorStop(0.6, 'rgba(0,0,0,0)');
  lg.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = lg;
  ctx.fillRect(0, floor - 160, g.W, 200);
}

// ---------- Temple background ----------

function drawLairBack(ctx, g, camX) {
  const W = g.W;
  const floor = ARENA_FLOOR * TILE;
  const bg = ctx.createLinearGradient(0, floor - 160, 0, floor);
  bg.addColorStop(0, '#0c0404');
  bg.addColorStop(0.6, '#2c0c08');
  bg.addColorStop(1, '#4c1810');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const ox = camX * 0.9;
  for (let y = floor - 132; y < floor; y += 12) {
    const sg = ctx.createLinearGradient(0, y, 0, y + 12);
    sg.addColorStop(0, '#4a2418');
    sg.addColorStop(1, '#2a120c');
    ctx.fillStyle = sg;
    const off = ((y / 12) % 2 ? 0 : 12) - (ox % 24);
    for (let x = off - 24; x < W; x += 24) {
      roundRect(ctx, x + 0.4, y + 0.4, 23.2, 11.2, 1.2);
      ctx.fill();
    }
  }
  const cx = (ARENA_COLS / 2) * TILE - camX;
  ctx.fillStyle = '#140604';
  ctx.beginPath();
  ctx.moveTo(cx - 36, floor);
  ctx.lineTo(cx - 36, floor - 84);
  ctx.arc(cx, floor - 84, 36, Math.PI, 0);
  ctx.lineTo(cx + 36, floor);
  ctx.fill();
  glow(ctx, cx, floor - 44, 70, '#ff5010', 0.3 + Math.sin(g.time * 3) * 0.05);
  for (const bx of [cx - 72, cx + 60]) {
    const bgr = ctx.createLinearGradient(bx, 0, bx + 12, 0);
    bgr.addColorStop(0, '#8c1820');
    bgr.addColorStop(1, '#4c0810');
    ctx.fillStyle = bgr;
    ctx.beginPath();
    ctx.moveTo(bx, floor - 124);
    ctx.lineTo(bx + 12, floor - 124);
    ctx.lineTo(bx + 12, floor - 80);
    ctx.lineTo(bx + 6, floor - 84);
    ctx.lineTo(bx, floor - 80);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f0c040';
    ctx.beginPath();
    ctx.arc(bx + 6, floor - 104, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f0c040';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx + 3, floor - 105);
    ctx.quadraticCurveTo(bx + 1.5, floor - 111, bx + 3.6, floor - 113);
    ctx.moveTo(bx + 9, floor - 105);
    ctx.quadraticCurveTo(bx + 10.5, floor - 111, bx + 8.4, floor - 113);
    ctx.stroke();
  }
  for (const x of [2, ARENA_COLS - 3]) {
    const px = x * TILE - camX;
    const pg = ctx.createLinearGradient(px, 0, px + 14, 0);
    pg.addColorStop(0, '#6c4430');
    pg.addColorStop(0.4, '#4c2c1c');
    pg.addColorStop(1, '#1c0c08');
    ctx.fillStyle = pg;
    ctx.fillRect(px, 0, 14, H);
    const ty = floor - 70;
    ctx.fillStyle = '#2c2c34';
    ctx.fillRect(px + 5, ty, 4, 8);
    flame(ctx, px + 7, ty, 1.2, g.time + x);
  }
  for (const x of [cx - 52, cx + 46]) {
    ctx.fillStyle = '#2c2420';
    ctx.fillRect(x + 2, floor - 10, 2, 10);
    roundRect(ctx, x - 2, floor - 14, 10, 5, 1.5);
    ctx.fillStyle = '#8c6c44';
    ctx.fill();
    flame(ctx, x + 3, floor - 14, 1.4, g.time * 1.1 + x);
  }
}

/** A flickering flame with glow, base at (x, y). */
function flame(ctx, x, y, s, t) {
  const f = Math.sin(t * 17) * 0.6 + Math.sin(t * 29) * 0.4;
  glow(ctx, x, y - 4 * s, 22 * s, '#ff7020', 0.55 + f * 0.1);
  for (const [w, h, c] of [[3.4, 8, '#e84010'], [2.4, 6, '#ffa030'], [1.2, 3.6, '#fff0b0']]) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x - w * s, y);
    ctx.quadraticCurveTo(x - w * s, y - h * s * 0.6, x + f * s, y - h * s * (1 + f * 0.1));
    ctx.quadraticCurveTo(x + w * s, y - h * s * 0.6, x + w * s, y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawBackground(ctx, g, camX) {
  if (g.area.kind === 'street') {
    drawCitySky(ctx, g.W, camX, g.time);
    drawTunnelBack(ctx, g.W, camX, g.time, LANE_H);
    return lampXs(camX, g.W);
  }
  drawLairBack(ctx, g, camX);
  return null;
}

// ---------- Decor ----------

function drawDecor(ctx, g, truth) {
  const area = g.area;
  if (area.kind !== 'street') return;
  for (const b of area.billboards) drawBillboard(ctx, b, truth, g.time);
  if (!g.glasses.taken) drawChurch(ctx, area.glasses.x, area.glasses.y);
  const x = (area.exit.c0 + 1) * TILE;
  for (const lane of [0, 1]) {
    const y = area.ground[lane][area.exit.c0 + 1] * TILE;
    roundRect(ctx, x, y - 64, 56, 64, 3);
    ctx.fillStyle = '#3c2878';
    ctx.fill();
    roundRect(ctx, x + 4, y - 60, 48, 60, 2);
    const dg = ctx.createLinearGradient(x, 0, x + 56, 0);
    dg.addColorStop(0, '#8c6cff');
    dg.addColorStop(1, '#4c2cb8');
    ctx.fillStyle = dg;
    ctx.fill();
    ctx.fillStyle = '#050208';
    roundRect(ctx, x + 12, y - 48, 32, 48, 4);
    ctx.fill();
    glow(ctx, x + 28, y - 24, 26, '#9878f8', 0.5 + Math.sin(g.time * 4) * 0.15);
    text(ctx, '>>>', x + 28, y - 58, 6, Math.floor(g.time * 4) % 2 ? '#88ff70' : '#3cbc3c', 'center');
  }
}

function fitLines(str, maxChars) {
  const words = str.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if (line && (line + ' ' + w).length > maxChars) {
      lines.push(line);
      line = w;
    } else line = line ? line + ' ' + w : w;
  }
  lines.push(line);
  return lines;
}

function drawBillboard(ctx, b, truth, time) {
  const x = b.c * TILE;
  const y = b.r * TILE;
  const w = b.w * TILE;
  const h = b.h * TILE;
  for (const px of [x + 16, x + w - 19]) {
    const pg = ctx.createLinearGradient(px, 0, px + 3, 0);
    pg.addColorStop(0, '#8c8c9c');
    pg.addColorStop(1, '#2c2c38');
    ctx.fillStyle = pg;
    ctx.fillRect(px, y + h, 3, LANE_H - y - h);
  }
  roundRect(ctx, x, y, w, h, 2);
  ctx.fillStyle = '#2c2c38';
  ctx.fill();
  const bg = ['#d83020', '#2060e0', '#f08020', '#7048e0', '#20a050'][hash(b.c, 9) % 5];
  roundRect(ctx, x + 2.5, y + 2.5, w - 5, h - 5, 1.5);
  if (truth) ctx.fillStyle = '#f4f4f4';
  else {
    const gg = ctx.createLinearGradient(x, y, x + w, y + h);
    gg.addColorStop(0, tone(bg, 0.3));
    gg.addColorStop(1, tone(bg, -0.35));
    ctx.fillStyle = gg;
  }
  ctx.fill();
  const str = truth ? b.truth : b.ad;
  let size = 11;
  let lines = fitLines(str, 10);
  if (lines.length > 2 || lines.some((l) => l.length > 11)) {
    size = 6;
    lines = fitLines(str, 20);
  }
  const lh = size * 1.15;
  const top = y + h / 2 - (lines.length * lh) / 2;
  lines.forEach((l, i) => text(ctx, l, x + w / 2, top + i * lh, size, truth ? '#101010' : '#ffffff', 'center', truth ? null : 'rgba(0,0,0,0.6)'));
  for (let i = 0; i < 3; i++) {
    const lx = x + 14 + i * 34;
    ctx.fillStyle = '#1c1c24';
    ctx.fillRect(lx, y - 3, 6, 3);
    if (!truth) glow(ctx, lx + 3, y + 6, 14, '#fff0b0', 0.25);
  }
  if (!truth) glow(ctx, x + 10 + ((time * 20) % (w - 20)), y + 8, 5, '#ffffff', 0.35);
}

function drawChurch(ctx, cx, groundY) {
  const x = cx - 32;
  const top = groundY - 64;
  const wg = ctx.createLinearGradient(x, 0, x + 64, 0);
  wg.addColorStop(0, '#b4b0bc');
  wg.addColorStop(1, '#787480');
  ctx.fillStyle = wg;
  ctx.fillRect(x, top + 16, 64, 48);
  ctx.strokeStyle = 'rgba(60,56,70,0.4)';
  ctx.lineWidth = 0.3;
  for (let yy = top + 20; yy < groundY; yy += 4) {
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + 64, yy);
    ctx.stroke();
  }
  ctx.fillStyle = '#6c2c2c';
  ctx.beginPath();
  ctx.moveTo(x - 3, top + 16);
  ctx.lineTo(x + 32, top + 6);
  ctx.lineTo(x + 67, top + 16);
  ctx.fill();
  ctx.fillStyle = '#a8a4b0';
  ctx.fillRect(x + 25, top - 2, 14, 18);
  ctx.fillStyle = '#5c2424';
  ctx.beginPath();
  ctx.moveTo(x + 23, top - 2);
  ctx.lineTo(x + 32, top - 14);
  ctx.lineTo(x + 41, top - 2);
  ctx.fill();
  ctx.fillStyle = '#f0e8c0';
  ctx.fillRect(x + 31.3, top - 26, 1.4, 12);
  ctx.fillRect(x + 28.5, top - 22, 7, 1.4);
  glow(ctx, x + 32, top - 21, 7, '#ffe890', 0.5);
  for (const wx of [x + 8, x + 48]) {
    ctx.save();
    roundRect(ctx, wx, top + 24, 8, 15, 4);
    ctx.clip();
    const sg = ctx.createLinearGradient(wx, top + 24, wx + 8, top + 39);
    sg.addColorStop(0, '#e83838');
    sg.addColorStop(0.33, '#3878e8');
    sg.addColorStop(0.66, '#f8c838');
    sg.addColorStop(1, '#38b858');
    ctx.fillStyle = sg;
    ctx.fillRect(wx, top + 24, 8, 15);
    ctx.restore();
  }
  roundRect(ctx, x + 25, top + 42, 14, 22, 6);
  ctx.fillStyle = '#5c3820';
  ctx.fill();
  text(ctx, 'CHURCH', x + 32, top + 18, 4.2, '#3c3c48', 'center', null);
}

function drawTiles(ctx, g, camX) {
  const area = g.area;
  const frame = Math.floor(g.time * 6) % 4;
  const c0 = Math.floor(camX / TILE) - 1;
  const c1 = c0 + Math.ceil(g.W / TILE) + 2;
  const r0 = Math.max(0, Math.floor(g.cam.y / TILE) - 1);
  const r1 = Math.min(ROWS - 1, Math.ceil((g.cam.y + g.viewH) / TILE));
  const px = Math.ceil(TILE * K);
  for (let c = c0; c <= c1; c++) {
    if (area.kind !== 'boss' && (c < 0 || c >= area.cols)) continue;
    for (let r = r0; r <= r1; r++) {
      const t = tileAt(area, c, r);
      if (t === T.AIR) continue;
      const kind = area.kind === 'boss' ? 'boss' : r < LANE_ROWS ? 'city' : 'tunnel';
      const above = tileAt(area, c, r - 1);
      const top = r > 0 && r !== LANE_ROWS && !isSolid(above) && above !== T.SLUDGE;
      const v = hash(c, r) % 4;
      const f = t === 4 ? frame : 0;
      const img = cached(`tile:${kind}:${t}:${top}:${t === 1 || t === 3 ? v : 0}:${f}:${px}`, px, px, (tc) => {
        tc.scale(px / TILE, px / TILE);
        drawTile(tc, kind, t, top, v, f);
      });
      ctx.drawImage(img, c * TILE, r * TILE, TILE + 0.05, TILE + 0.05);
    }
  }
}

function drawPortalFx(ctx, g) {
  for (const f of g.portalFx) {
    const k = f.t / 0.5;
    glow(ctx, f.x, f.y, 28 * (1 - k * 0.5), '#9878f8', 1 - k);
    for (let ring = 0; ring < 2; ring++) {
      ctx.strokeStyle = ring ? `rgba(104,68,252,${1 - k})` : `rgba(230,220,255,${1 - k})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, 4 + k * 14 + ring * 4, 10 + k * 6 + ring * 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

// ---------- Things ----------

const PICKUP_COLORS = { M: '#2860d8', N: '#d83020', T: '#e87818', S: '#c02060', C: '#20a8b8', P: '#7050f0' };

function capsule(ctx, x, y, r, color, letter) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, tone(color, 0.55));
  g.addColorStop(0.6, color);
  g.addColorStop(1, tone(color, -0.5));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(16,8,24,0.8)';
  ctx.lineWidth = 0.7;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.35, y - r * 0.45, r * 0.35, r * 0.2, -0.5, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, letter, x, y - r * 0.6, r * 1.2, '#ffffff', 'center', 'rgba(20,8,16,0.8)');
}

function drawPickups(ctx, g, truthLayer) {
  const bob = Math.sin(g.time * 4) * 1.5;
  if (!truthLayer && g.area.kind === 'street' && !g.glasses.taken) {
    const { x, y } = g.area.glasses;
    roundRect(ctx, x - 8, y - 9, 16, 9, 1);
    const bg = ctx.createLinearGradient(0, y - 9, 0, y);
    bg.addColorStop(0, '#d8a868');
    bg.addColorStop(1, '#8c6030');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.fillStyle = '#7c5428';
    ctx.fillRect(x - 0.5, y - 9, 1, 9);
    glow(ctx, x, y - 13 + bob, 10, '#ffffff', 0.4 + Math.sin(g.time * 5) * 0.15);
    drawShades(ctx, x - 5, y - 15 + bob, 10);
  }
  for (const k of g.pickups) {
    if (k.taken || k.hidden !== truthLayer) continue;
    if (k.hidden && !g.glasses.on) continue;
    const x = k.x;
    const y = k.y - 7 + bob;
    if (k.hidden) glow(ctx, x, y, 14, '#58d854', 0.6);
    if (k.kind === '+') {
      glow(ctx, x, y, 8, '#ff4040', 0.4);
      drawHeart(ctx, x - 5, y - 4.5, 10, '#e83838');
    } else if (k.kind === 'H') drawHardHat(ctx, x - 5, y - 6, 10);
    else {
      if (k.kind === 'P') glow(ctx, x, y, 14, '#9878f8', 0.6 + Math.sin(g.time * 8) * 0.3);
      capsule(ctx, x, y, 5.5, PICKUP_COLORS[k.kind] || '#d83020', k.kind);
    }
  }
}

// ---------- Characters ----------

const LOOKS = [
  { skin: '#f1c08a', hair: '#6b3a1a', shirt: '#c8382c', pants: '#2f5bb0' },
  { skin: '#f1c08a', hair: '#1c1414', shirt: '#f2f2f2', tie: '#a01828', pants: '#3a3a46', shoes: '#141018' },
  { skin: '#c98a5a', hair: '#1c1414', shirt: '#24357a', pants: '#1c2a5c', hat: 'cap', capColor: '#1c2a5c', badge: '#f0c840', shoes: '#141018' },
  { skin: '#f6c99a', hair: '#f0d070', longHair: true, shirt: '#7a4cd8', pants: '#1c1c24', shoes: '#c03040' },
  { skin: '#8c5a36', hair: '#141010', longHair: true, shirt: '#2c9a5a', pants: '#b08a50', shoes: '#5c3a1c' },
  { skin: '#d89a6a', hair: '#d8d8d8', shirt: '#b08a4c', pants: '#6c6c74' },
];

const CHILD_LOOKS = [
  { skin: '#f1c08a', hair: '#6b3a1a', shirt: '#f8c820', pants: '#2f5bb0', shoes: '#d83020' },
  { skin: '#8c5a36', hair: '#141010', shirt: '#d83020', pants: '#1c2a5c', shoes: '#f0f0f0' },
  { skin: '#f6c99a', hair: '#f0d070', longHair: true, shirt: '#58d854', pants: '#7a4cd8', shoes: '#3c3c48' },
  { skin: '#c98a5a', hair: '#4c2c1c', longHair: true, shirt: '#f878b8', pants: '#f0f0f0', shoes: '#7a4cd8' },
];

const LIZARD = { head: 'lizard', scales: '#38a04c', skin: '#38a04c', hands: '#38a04c', shirt: '#2f8a42', pants: '#226a34', shoes: '#7cd860', belt: '#1c4c24', tail: true };

export function heroSpec(shades = false, armor = false) {
  return {
    skin: '#eab07a',
    hair: '#e8c058',
    mullet: true,
    hat: 'hardhat',
    tank: true,
    shirt: '#f4f4ee',
    pants: '#2c5cc8',
    shoes: '#6c3c1c',
    belt: '#5c3c1c',
    buckle: '#f0c840',
    bulky: true,
    shades,
    armor,
  };
}

function withFlash(ctx, on, draw) {
  if (on) ctx.filter = 'brightness(2.6)';
  draw();
  if (on) ctx.filter = 'none';
}

function drawActor(ctx, g, a, truthLayer) {
  if (a.type === 'boss') return drawBoss(ctx, g, a);
  const pose = { t: a.anim, speed: Math.abs(a.vx), air: !a.onGround };
  if (a.type === 'child') {
    if (!a.carriedBy) drawFigure(ctx, a.x, a.y, a.face, { ...CHILD_LOOKS[a.look % CHILD_LOOKS.length], scale: 0.66 }, pose);
    return;
  }
  if (a.type === 'cultist') {
    const spec = { ...LIZARD, tail: false, robe: a.role === 'priest' ? '#4c2470' : '#7c1c24', hood: true };
    withFlash(ctx, a.flash > 0, () => drawFigure(ctx, a.x, a.y, a.face, spec, { ...pose, armsUp: a.chanting }));
    if (!a.chanting && a.role === 'priest') glow(ctx, a.x + a.face * 7, a.y - 15, 5, '#ff8020', 0.7);
    return;
  }
  let spec;
  if (a.type === 'civilian') spec = LOOKS[a.look];
  else if (!a.disguised) spec = LIZARD;
  else {
    const slip = a.glance > 0 && a.glance < 0.35 && Math.floor(a.anim * 12) % 3 === 0;
    const showLizard = a.revealed || truthLayer || slip;
    spec = showLizard ? { ...LOOKS[a.look], head: 'lizard', scales: '#3caa50', hands: '#3caa50', hat: null } : LOOKS[a.look];
  }
  if (a.type === 'gunner' && (a.revealed || truthLayer)) {
    const p = g.player;
    const dx = p.x - a.x;
    const dy = p.y - 12 - (a.y - 15);
    const len = Math.hypot(dx, dy) || 1;
    pose.gun = 'ray';
    pose.aim = { x: dx / len, y: dy / len };
  }
  if (a.child) pose.holdUp = true;
  withFlash(ctx, a.flash > 0, () => drawFigure(ctx, a.x, a.y, a.face, spec, pose));
  if (a.child) {
    const kid = a.child;
    const wig = Math.sin(g.time * 18) * 0.8;
    drawFigure(ctx, a.x + wig, a.y - 21, kid.face, { ...CHILD_LOOKS[kid.look % CHILD_LOOKS.length], scale: 0.66 }, { air: true, t: g.time });
    if (Math.floor(g.time * 4) % 2) text(ctx, 'HELP!', a.x, a.y - 44, 4.5, '#ff7060', 'center');
  }
  if (a.carrier && (a.revealed || truthLayer)) {
    const dx = a.x + a.face * 5;
    glow(ctx, dx, a.y - 11, 8, '#9878f8', 0.7 + Math.sin(g.time * 10) * 0.3);
    roundRect(ctx, dx - 2, a.y - 13, 4, 4, 1);
    ctx.fillStyle = '#7858f0';
    ctx.fill();
  }
  if (truthLayer && !a.revealed) {
    ctx.strokeStyle = a.carrier ? '#b8a0ff' : '#88ff70';
    ctx.lineWidth = 0.9;
    const x0 = a.x - 7;
    const y0 = a.y - 25;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + 4);
    ctx.lineTo(x0, y0);
    ctx.lineTo(x0 + 4, y0);
    ctx.moveTo(x0 + 10, y0);
    ctx.lineTo(x0 + 14, y0);
    ctx.lineTo(x0 + 14, y0 + 4);
    ctx.stroke();
  }
}

/** The idol of Moloch on its pedestal: stone while the ceremony goes on. */
function drawBoss(ctx, g, b) {
  const floor = ARENA_FLOOR * TILE;
  const px = (ARENA_COLS / 2) * TILE;
  roundRect(ctx, px - 28, floor - PEDESTAL_H, 56, PEDESTAL_H, 1.5);
  const pg = ctx.createLinearGradient(0, floor - PEDESTAL_H, 0, floor);
  pg.addColorStop(0, '#8c7460');
  pg.addColorStop(1, '#4c3c2c');
  ctx.fillStyle = pg;
  ctx.fill();
  ctx.fillStyle = '#3c2c20';
  for (let i = 0; i < 5; i++) ctx.fillRect(px - 22 + i * 10, floor - PEDESTAL_H + 3, 4, 4);
  if (b.state === 'awake' || b.dead) {
    ctx.strokeStyle = '#1c140c';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(px - 6, floor - PEDESTAL_H);
    ctx.lineTo(px - 4, floor - PEDESTAL_H + 4);
    ctx.lineTo(px - 6, floor - 2);
    ctx.moveTo(px + 9, floor - PEDESTAL_H);
    ctx.lineTo(px + 8, floor - 3);
    ctx.stroke();
  }
  if (b.dead && Math.floor(g.time * 20) % 2) return;
  const flicker = b.state === 'waking' && Math.floor(g.time * (6 + (2.2 - b.timer) * 8)) % 2 === 0;
  const awake = b.state === 'awake' || flicker;
  drawMoloch(ctx, b.x, b.y, b.face > 0 ? 1 : -1, awake, g.time, b.flash > 0);
  if (awake) {
    const pulse = 0.7 + Math.sin(g.time * 12) * 0.3;
    glow(ctx, b.x - 4.2, b.y - 57, 7, '#ff3018', pulse);
    glow(ctx, b.x + 4.2, b.y - 57, 7, '#ff3018', pulse);
    glow(ctx, b.x, b.y - 32, 26, '#ff8020', 0.55 + Math.sin(g.time * 9) * 0.2);
  } else if (b.state === 'waking') glow(ctx, b.x, b.y - 36, 36, '#ff3018', 0.3);
}

function drawPlayer(ctx, g) {
  const p = g.player;
  if (!p) return;
  if (p.inv > 0 && g.mode === 'play' && Math.floor(g.time * 20) % 2) return;
  const tackling = p.tackle > 0;
  if (tackling) {
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.6 - i * 0.09})`;
      ctx.beginPath();
      const ly = p.y - 3 - ((i * 4) % 14);
      ctx.moveTo(p.x - p.face * (6 + i * 3), ly);
      ctx.lineTo(p.x - p.face * (14 + i * 4), ly);
      ctx.stroke();
    }
  }
  const spec = heroSpec(g.glasses.on, g.armor);
  const pose = heroPose(p);
  if (pose === 'ball') drawHeroBall(ctx, p.x, p.y, p.face, spec, g.time);
  else {
    drawFigure(ctx, p.x, p.y, p.face, spec, {
      t: p.anim,
      speed: tackling ? 0 : Math.abs(p.vx),
      crouch: pose === 'crouch',
      gun: 'rifle',
      aim: p.aim,
    });
  }
  const m = heroMuzzle(p);
  const { x: ax, y: ay } = p.aim;
  if (p.planted) {
    for (let i = 0; i < 6; i++) {
      const d = 6 + i * 7 + ((g.time * 20) % 7);
      ctx.fillStyle = `rgba(248,216,0,${0.75 - i * 0.11})`;
      ctx.beginPath();
      ctx.arc(m.x + ax * d, m.y + ay * d, 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (p.firing > 0 && !tackling) {
    glow(ctx, m.x, m.y, 12, '#ffc040');
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(Math.atan2(ay, ax));
    ctx.fillStyle = '#fffbe0';
    ctx.beginPath();
    ctx.moveTo(0, -1.4);
    ctx.lineTo(5, 0);
    ctx.lineTo(0, 1.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawBullets(ctx, g) {
  for (const b of g.bullets) {
    const len = Math.hypot(b.vx, b.vy) || 1;
    const dx = b.vx / len;
    const dy = b.vy / len;
    if (b.kind === 'flame') {
      const t = b.life / 0.32;
      glow(ctx, b.x, b.y, 4 + (1 - t) * 5, t > 0.5 ? '#ffb030' : '#ff5010', 0.9);
      continue;
    }
    const color = b.kind === 'pellet' ? '#ffc040' : b.kind === 'bullet' ? '#ffe060' : b.kind === 'nail' ? '#c8c8e0' : '#ffffff';
    const tail = b.kind === 'slug' ? 6 : b.kind === 'pellet' ? 3 : 4.5;
    glow(ctx, b.x, b.y, b.kind === 'slug' ? 6 : 3.5, color, 0.7);
    ctx.strokeStyle = color;
    ctx.lineWidth = b.kind === 'slug' ? 1.6 : 0.9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - dx * tail, b.y - dy * tail);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.kind === 'slug' ? 1 : 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawShots(ctx, g) {
  const pulse = Math.sin(g.time * 20) * 0.5 + 0.5;
  for (const s of g.shots) {
    const color = s.fire ? '#ff7020' : '#ff40e0';
    glow(ctx, s.x, s.y, s.r * 3.2, color, 0.75 + pulse * 0.25);
    const cg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
    cg.addColorStop(0, '#ffffff');
    cg.addColorStop(0.5, s.fire ? '#ffd060' : '#ffa0f0');
    cg.addColorStop(1, s.fire ? '#e84010' : '#c020b0');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles(ctx, g) {
  for (const p of g.particles) {
    ctx.globalAlpha = Math.min(1, p.life * 3);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---------- HUD and screens ----------

function panel(ctx, x, y, w, h, a = 0.55) {
  roundRect(ctx, x, y, w, h, 3);
  ctx.fillStyle = `rgba(10,8,28,${a})`;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 0.6;
  ctx.stroke();
}

function meter(ctx, x, y, w, h, frac, color) {
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fill();
  if (frac <= 0) return;
  roundRect(ctx, x, y, Math.max(h, w * frac), h, h / 2);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, tone(color, 0.45));
  g.addColorStop(1, tone(color, -0.25));
  ctx.fillStyle = g;
  ctx.fill();
}

function drawLaneAlerts(ctx, g, camX, camY) {
  if (g.area.kind !== 'street') return;
  for (const a of g.actors) {
    if (a.type !== 'snatcher' || !a.child) continue;
    const top = (a.y - 30 - camY) * g.zoom;
    const bottom = (a.y - camY) * g.zoom;
    if (top >= 0 && bottom <= H) continue;
    const x = Math.max(16, Math.min(g.screenW - 16, (a.x - camX) * g.zoom));
    const up = top < 0;
    const y = up ? 34 : H - 18;
    glow(ctx, x, y, 14, '#ff4040', 0.4 + Math.sin(g.time * 8) * 0.2);
    ctx.fillStyle = '#ff5050';
    ctx.beginPath();
    ctx.moveTo(x - 6, up ? y + 3 : y - 3);
    ctx.lineTo(x, up ? y - 5 : y + 5);
    ctx.lineTo(x + 6, up ? y + 3 : y - 3);
    ctx.closePath();
    ctx.fill();
    text(ctx, 'HELP!', x, up ? y + 5 : y - 14, 7, '#ff9090', 'center');
  }
}

function drawHud(ctx, g) {
  const W = g.screenW;
  panel(ctx, 3, 3, 62, 15);
  for (let i = 0; i < 4; i++) drawHeart(ctx, 6 + i * 13, 5.5, 10.5, '#e83838', i >= g.hearts);
  if (g.armor) drawHardHat(ctx, 54, 4.5, 9);

  const gl = g.glasses;
  if (gl.have) {
    panel(ctx, 3, 20, 62, 11);
    drawShades(ctx, 6, 23.5, 11, gl.on ? '#78f060' : '#e8e8f0');
    meter(ctx, 20, 23, 42, 5, gl.meter, gl.locked ? '#e83030' : gl.on ? '#58d854' : '#e8e8f0');
    if (gl.contacts) text(ctx, 'C', 66, 21, 7, '#40f0f0');
  } else if (g.area.kind === 'street' && Math.floor(g.time * 2) % 2) {
    text(ctx, 'FIND THE SHADES', 5, 21, 7, '#f8d800');
  }
  const pt = g.portal;
  if (pt.have && g.area.kind === 'street') {
    panel(ctx, 3, 33, 62, 11);
    const ready = pt.cd <= 0;
    if (ready) glow(ctx, 10, 38.5, 7, '#9878f8', 0.6);
    ctx.strokeStyle = ready ? '#b8a0ff' : '#5c5c6c';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(10, 38.5, 4, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
    text(ctx, ready ? 'PORTAL' : 'CHARGING', 18, 35, 6.5, ready ? '#d0c4ff' : '#8c8c9c');
  }

  const part = { street: 1, boss: 2 }[g.areaKey];
  text(ctx, `STAGE ${g.stageNum}-${part}`, W / 2, 4, 8, '#ffffff', 'center');
  panel(ctx, W - 96, 3, 64, 22);
  text(ctx, String(g.score).padStart(7, '0'), W - 36, 5, 8.5, '#ffffff', 'right');
  text(ctx, WEAPON_INFO[g.weapon].name, W - 36, 15, 6.5, '#f8d800', 'right');
  if (g.player?.planted) text(ctx, 'LOCKED', W - 36, 27, 6.5, '#f8d800', 'right');

  panel(ctx, W - 28, 3, 25, 22);
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, W - 21, 8, 4, 12, 1);
  ctx.fill();
  roundRect(ctx, W - 14, 8, 4, 12, 1);
  ctx.fill();
  g.pauseRect = { x: W - 40, y: 0, w: 40, h: 32 };

  const b = g.boss;
  if (b && !b.dead && b.state !== 'awake') {
    const left = g.cultistsLeft();
    if (left > 0) text(ctx, `ATTENDEES LEFT: ${left}`, W / 2, 15, 7, '#ff8060', 'center');
  } else if (b && !b.dead) {
    text(ctx, b.name, W / 2, 15, 7, '#ffb040', 'center');
    meter(ctx, W / 2 - 60, 25, 120, 6, Math.max(0, b.hp) / b.maxHp, '#e83030');
  }
}

function drawBanner(ctx, g) {
  const { title, sub, t } = g.banner;
  const a = Math.min(1, t / 0.4);
  const W = g.screenW;
  const h = sub ? 38 : 26;
  ctx.save();
  ctx.globalAlpha = a;
  const bg = ctx.createLinearGradient(0, 50, 0, 50 + h);
  bg.addColorStop(0, 'rgba(6,4,20,0)');
  bg.addColorStop(0.5, 'rgba(6,4,20,0.75)');
  bg.addColorStop(1, 'rgba(6,4,20,0)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 50, W, h);
  text(ctx, title, W / 2, 54, 15, '#ffffff', 'center');
  if (sub) text(ctx, sub, W / 2, 73, 7.5, '#f8d800', 'center');
  ctx.restore();
}

function drawMenu(ctx, g, top) {
  const m = g.menu;
  if (!m) return;
  const W = g.screenW;
  const bw = 220;
  const bh = 32;
  m.items.forEach((item, i) => {
    const label = typeof item.label === 'function' ? item.label() : item.label;
    const x = Math.round(W / 2 - bw / 2);
    const y = top + i * (bh + 8);
    const sel = i === m.sel;
    if (sel) glow(ctx, W / 2, y + bh / 2, 90, '#f8a020', 0.25 + Math.sin(g.time * 5) * 0.06);
    roundRect(ctx, x, y, bw, bh, 8);
    const bg = ctx.createLinearGradient(0, y, 0, y + bh);
    bg.addColorStop(0, sel ? '#b0281c' : '#3c3448');
    bg.addColorStop(1, sel ? '#4c0c08' : '#14101c');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = sel ? '#f8c040' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = sel ? 1.6 : 1;
    ctx.stroke();
    text(ctx, label, W / 2, y + 8, 15, sel ? '#ffe080' : '#ffffff', 'center');
    g.menuRects.push({ x, y, w: bw, h: bh, index: i });
  });
}

function dim(ctx, g) {
  ctx.fillStyle = 'rgba(4,2,14,0.7)';
  ctx.fillRect(0, 0, g.screenW, H);
}

function drawPaused(ctx, g) {
  dim(ctx, g);
  text(ctx, 'PAUSED', g.screenW / 2, 58, 26, '#ffffff', 'center');
  drawMenu(ctx, g, 100);
}

function drawGameOver(ctx, g) {
  dim(ctx, g);
  text(ctx, 'GAME OVER', g.screenW / 2, 28, 28, '#e83030', 'center');
  text(ctx, `STAGE ${g.stageNum}   SCORE ${g.score}`, g.screenW / 2, 62, 8, '#ffffff', 'center');
  text(ctx, `BEST: STAGE ${g.save.bestStage}   SCORE ${g.save.bestScore}`, g.screenW / 2, 73, 7, '#bcbcc8', 'center');
  text(ctx, 'THEY LIVE. WE SLEEP.', g.screenW / 2, 86, 7, '#78f060', 'center');
  drawMenu(ctx, g, 104);
}

function drawClear(ctx, g) {
  dim(ctx, g);
  text(ctx, `STAGE ${g.stageNum} CLEAR!`, g.screenW / 2, 22, 20, '#f8d800', 'center');
  const s = g.stageStats;
  const rows = [
    ['LIZARDS EXPOSED', s.lizards],
    ['INNOCENTS HIT', s.innocents],
    ['CHILDREN SAVED', s.saved],
    ['CHILDREN TAKEN', s.lost],
    ['STAGE BONUS', g.clearInfo.bonus],
    ['SCORE', g.score],
  ];
  panel(ctx, g.screenW / 2 - 80, 48, 160, 74, 0.6);
  rows.forEach(([label, value], i) => {
    text(ctx, label, g.screenW / 2 - 72, 52 + i * 11.5, 7.5, '#ffffff');
    text(ctx, String(value), g.screenW / 2 + 72, 52 + i * 11.5, 7.5, '#ffe080', 'right');
  });
  drawMenu(ctx, g, 128);
}

function drawTitle(ctx, g, usingTouch) {
  const W = g.screenW;
  const cam = g.time * 12;
  // A dusk city, scaled to fill the title screen.
  ctx.save();
  ctx.scale(H / LANE_H, H / LANE_H);
  drawCitySky(ctx, W * (LANE_H / H), cam, g.time);
  ctx.restore();
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(4,2,14,0.2)');
  shade.addColorStop(1, 'rgba(4,2,14,0.85)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);

  glow(ctx, W / 2, 70, 140, '#e83030', 0.3);
  ctx.save();
  ctx.font = `48px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1a0004';
  ctx.lineWidth = 9;
  ctx.strokeText('THEY LIVE', W / 2, 46);
  const tg = ctx.createLinearGradient(0, 46, 0, 94);
  tg.addColorStop(0, '#ffffff');
  tg.addColorStop(0.5, '#e8e0e0');
  tg.addColorStop(0.52, '#c02020');
  tg.addColorStop(1, '#600010');
  ctx.fillStyle = tg;
  ctx.fillText('THEY LIVE', W / 2, 46);
  ctx.restore();
  text(ctx, 'PUT ON THE SHADES. SEE THE TRUTH.', W / 2, 104, 8, '#f8d800', 'center');
  text(ctx, 'THE LOOT IS BELOW. FIND THE PORTAL.', W / 2, 116, 7, '#c8b8fc', 'center');
  if (g.save.bestStage > 0) text(ctx, `BEST: STAGE ${g.save.bestStage}   SCORE ${g.save.bestScore}`, W / 2, H - 28, 7, '#ffffff', 'center');
  if (!usingTouch) text(ctx, 'ARROWS MOVE  Z JUMP  X FIRE  F TACKLE  SHIFT LOCK AIM  G SHADES  V PORTAL  P PAUSE', W / 2, H - 15, 6, '#bcbcc8', 'center');
}
