// Draws the game in a 16-bit style. Drawing happens in world units (VIEW_H
// tall) on a canvas with RES canvas pixels per world pixel, so sprites and
// tiles can carry finer detail than the world grid. With the sunglasses on,
// the world turns black and white and the lizards are drawn on top in color.

import { TILE, ROWS, LANE_ROWS, ARENA_COLS, ARENA_FLOOR, T, tileAt, isSolid, laneOf } from './stage.js';
import {
  personSprite, playerSprite, heroPose, heroMuzzle, childSprite, molochSprite, cultistSprite, tileSprite, icon, drawSprite, flashSprite, drawText, drawTextOutlined,
  cachedCanvas, dropCached, makeCanvas, shade, shadeHex, mix, rgb, css, DETAIL, COLORS as C,
} from './sprites.js';
import { hash } from './rng.js';
import { WEAPON_INFO, VIEW_H, PEDESTAL_H } from './game.js';

export const RES = DETAIL;
const H = VIEW_H;
const LANE_H = LANE_ROWS * TILE;
const P = 1 / RES; // one canvas pixel, in world units

/** Snaps a world coordinate to the canvas pixel grid. */
const q = (v) => Math.round(v * RES) / RES;

let frameCount = 0;

export function render(ctx, g, usingTouch) {
  const SW = g.screenW;
  const screen = () => ctx.setTransform(RES, 0, 0, RES, 0, 0);
  screen();
  ctx.imageSmoothingEnabled = false;
  g.menuRects = [];
  if (++frameCount % 120 === 0) dropCached('bld:', 40);

  if (g.mode === 'title') {
    drawTitle(ctx, g, usingTouch);
    drawMenu(ctx, g, 138);
    return;
  }

  const shaking = g.shake > 0;
  const sx = shaking ? q((Math.random() - 0.5) * 4) : 0;
  const sy = shaking ? q((Math.random() - 0.5) * 3) : 0;
  const camX = q(g.cam.x);
  const camY = q(g.cam.y);
  const truth = g.glasses.on;
  // The world is drawn zoomed, with the camera's view at the top-left.
  const world = (dx = 0, dy = 0) => {
    const z = RES * g.zoom;
    ctx.setTransform(z, 0, 0, z, 0, 0);
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
  if (g.area.kind === 'street') {
    world();
    drawSewerLight(ctx, g, camX, lamps);
  }

  if (truth) {
    screen();
    truthFilter(ctx, SW);
    world(-camX + sx, sy);
    for (const a of g.actors) if (isLizard(a)) drawActor(ctx, g, a, true);
    drawPickups(ctx, g, true);
    drawShots(ctx, g);
  }

  world(-camX, 0);
  drawPortalFx(ctx, g);
  for (const t of g.texts) drawTextOutlined(ctx, t.text, t.x, t.y, t.color, 1, 'center');

  screen();
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

/** Arrows at the screen edge for snatchers carrying a child out of view. */
function drawLaneAlerts(ctx, g, camX, camY) {
  if (g.area.kind !== 'street') return;
  for (const a of g.actors) {
    if (a.type !== 'snatcher' || !a.child) continue;
    const top = (a.y - 30 - camY) * g.zoom;
    const bottom = (a.y - camY) * g.zoom;
    if (top >= 0 && bottom <= H) continue;
    const x = Math.max(12, Math.min(g.screenW - 12, (a.x - camX) * g.zoom));
    const up = top < 0;
    const y = up ? 30 : H - 14;
    if (Math.floor(g.time * 4) % 2) glow(ctx, x, y, 10, '#ff4040', 0.6);
    ctx.fillStyle = '#ff5050';
    for (let i = 0; i < 5; i++) ctx.fillRect(x - i, up ? y - 4 + i : y + 4 - i, i * 2 + 1, 1);
    drawTextOutlined(ctx, 'HELP!', x, up ? y + 4 : y - 10, '#ff8080', 1, 'center');
  }
}

function isLizard(a) {
  return a.type === 'grunt' || a.type === 'gunner' || a.type === 'snatcher' || a.type === 'cultist' || a.type === 'boss';
}

// ---------- The sunglasses view ----------

let scratch = null;

/** Black and white with a little extra contrast, and faint scanlines. */
function truthFilter(ctx, W) {
  const canvas = ctx.canvas;
  if ('filter' in ctx) {
    if (!scratch || scratch.width !== canvas.width || scratch.height !== canvas.height) {
      scratch = makeCanvas(canvas.width, canvas.height);
    }
    const s = scratch.getContext('2d');
    s.clearRect(0, 0, scratch.width, scratch.height);
    s.drawImage(canvas, 0, 0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = 'grayscale(1) contrast(1.35) brightness(1.05)';
    ctx.drawImage(scratch, 0, 0);
    ctx.restore();
  } else {
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const l = Math.min(255, Math.max(0, (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11 - 128) * 1.35 + 134));
      d[i] = d[i + 1] = d[i + 2] = l;
    }
    ctx.putImageData(img, 0, 0);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  for (let y = 0; y < H; y += 1) ctx.fillRect(0, y, W, P);
}

// ---------- Small drawing helpers ----------

/** A soft round glow, drawn additively. */
function glow(ctx, x, y, r, color, alpha = 1) {
  const size = Math.max(4, Math.round(r * 2 * RES));
  const img = cachedCanvas(`glow:${color}:${size}`, size, size, (c) => {
    const grad = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    const col = rgb(color);
    grad.addColorStop(0, css(col, 0.9));
    grad.addColorStop(0.35, css(col, 0.45));
    grad.addColorStop(1, css(col, 0));
    c.fillStyle = grad;
    c.fillRect(0, 0, size, size);
  });
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/** A box with light top-left and dark bottom-right edges. */
function bevelBox(ctx, x, y, w, h, color, edge = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = shade(color, 0.35);
  ctx.fillRect(x, y, w, edge);
  ctx.fillRect(x, y, edge * 0.5, h);
  ctx.fillStyle = shade(color, -0.45);
  ctx.fillRect(x, y + h - edge, w, edge);
  ctx.fillRect(x + w - edge * 0.5, y, edge * 0.5, h);
}

/** A see-through HUD panel with a beveled border. */
function panel(ctx, x, y, w, h, alpha = 0.6) {
  ctx.fillStyle = `rgba(10,8,28,${alpha})`;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(x, y, w, P);
  ctx.fillRect(x, y, P, h);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y + h - P, w, P);
  ctx.fillRect(x + w - P, y, P, h);
}

/** A meter bar with a two-tone fill. */
function meter(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = '#101018';
  ctx.fillRect(x, y, w, h);
  const fw = Math.max(0, Math.round(w * frac * RES) / RES);
  ctx.fillStyle = shade(color, -0.25);
  ctx.fillRect(x, y, fw, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, fw, h * 0.6);
  ctx.fillStyle = shade(color, 0.55);
  ctx.fillRect(x, y, fw, P);
}

/** Vertical gradient made of flat bands, like SNES color gradients. */
function bands(ctx, x, y, w, h, stops, count) {
  const cols = stops.map(([, c]) => rgb(c));
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    let k = 0;
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const local = (t - stops[k][0]) / (stops[k + 1][0] - stops[k][0]);
    ctx.fillStyle = css(mix(cols[k], cols[k + 1], Math.min(1, Math.max(0, local))));
    const y0 = q(y + (h * i) / count);
    ctx.fillRect(x, y0, w, q(y + (h * (i + 1)) / count) - y0);
  }
}

// ---------- City background ----------

const SKY = [[0, '#1c3478'], [0.4, '#3c70cc'], [0.72, '#86bdf0'], [1, '#f6d8b0']];

function cloudImage(i) {
  return cachedCanvas(`cloud:${i}`, 96, 36, (c, px) => {
    const blobs = [];
    for (let b = 0; b < 6; b++) {
      const r = 7 + (hash(i, b, 1) % 9);
      blobs.push([12 + (hash(i, b, 2) % 66), 22 - (hash(i, b, 3) % 8), r]);
    }
    for (let y = 0; y < 36; y++) {
      for (let x = 0; x < 96; x++) {
        let inside = null;
        for (const [cx, cy, r] of blobs) if ((x - cx) ** 2 + ((y - cy) * 1.4) ** 2 < r * r) inside = [cx, cy, r];
        if (!inside) continue;
        const rel = (y - inside[1]) / inside[2];
        px(x, y, 1, 1, rel > 0.35 ? '#b8c6ec' : rel > 0 ? '#dfe6f8' : '#fbfbff');
      }
    }
  });
}

/** A detailed brick building, cached per index. */
function buildingImage(k) {
  const floors = 3 + (hash(k, 21) % 4);
  const hWorld = floors * 14 + 10;
  const w = 112;
  const extra = 44;
  const h = hWorld * 2 + extra;
  const img = cachedCanvas(`bld:${k}`, w, h, (c, px) => {
    const palettes = ['#a8462a', '#8c8c94', '#b0843c', '#6c4c34', '#8e4462', '#5c6c8c'];
    const base = palettes[hash(k, 22) % palettes.length];
    const top = extra;
    px(0, top, w, h - top, shade(base, 0));
    // Bricks
    for (let y = top + 8; y < h; y += 4) {
      px(0, y, w, 1, shade(base, -0.18));
      const off = (y / 4) % 2 ? 0 : 4;
      for (let x = off; x < w; x += 8) px(x, y - 3, 1, 3, shade(base, -0.12));
    }
    // Parapet
    px(0, top, w, 6, shade(base, 0.25));
    px(0, top, w, 1, shade(base, 0.5));
    px(0, top + 6, w, 2, shade(base, -0.4));
    // Windows
    const lit = (fx, fy) => hash(k, fx, fy) % 4 === 0;
    for (let f = 0; f < floors; f++) {
      const wy = top + 14 + f * 28;
      for (let i = 0; i < 4; i++) {
        const wx = 8 + i * 25;
        px(wx - 1, wy - 1, 16, 21, shade(base, -0.45));
        px(wx, wy, 14, 19, '#d8d0c0');
        const on = lit(i, f);
        for (let gy = 0; gy < 17; gy++) {
          const t = gy / 16;
          px(wx + 1, wy + 1 + gy, 12, 1, css(on ? mix([255, 236, 160], [224, 150, 60], t) : mix([150, 186, 228], [36, 50, 84], t)));
        }
        if (!on) {
          px(wx + 3, wy + 3, 1, 4, 'rgba(255,255,255,0.6)');
          px(wx + 4, wy + 2, 1, 2, 'rgba(255,255,255,0.6)');
        } else if (hash(k, i, f, 5) % 2) {
          px(wx + 1, wy + 1, 4, 17, '#c05050'); // a curtain
        }
        px(wx + 1, wy + 9, 12, 1, '#a8a090');
        px(wx - 2, wy + 20, 18, 2, shade(base, 0.35));
      }
    }
    // The shaded side of the building.
    px(w - 10, top, 10, h - top, 'rgba(0,0,0,0.28)');
    // Rooftop details.
    const roof = hash(k, 23) % 3;
    if (roof === 0) {
      px(30, top - 30, 24, 22, '#7c4c2c');
      for (let y = top - 28; y < top - 8; y += 5) px(30, y, 24, 1, '#5c3418');
      px(30, top - 30, 24, 2, '#a87048');
      px(28, top - 34, 28, 4, '#4c4c58');
      px(32, top - 8, 2, 8, '#3c3c48');
      px(50, top - 8, 2, 8, '#3c3c48');
    } else if (roof === 1) {
      for (const x of [14, 60]) {
        px(x, top - 12, 22, 12, '#9c9ca8');
        px(x, top - 12, 22, 2, '#c8c8d4');
        px(x + 4, top - 8, 14, 6, '#5c5c68');
        for (let gx = x + 5; gx < x + 18; gx += 2) px(gx, top - 8, 1, 6, '#3c3c48');
      }
    } else {
      px(70, top - 40, 2, 40, '#5c5c68');
      px(64, top - 30, 14, 1, '#5c5c68');
      px(66, top - 22, 10, 1, '#5c5c68');
      px(70, top - 43, 2, 3, '#ff4040');
    }
    if (hash(k, 24) % 2) {
      // Fire escape
      for (let f = 0; f < floors; f++) {
        const y = top + 34 + f * 28;
        px(4, y, 30, 2, '#202028');
        for (let x = 4; x < 34; x += 3) px(x, y - 6, 1, 6, '#2c2c34');
        px(4, y - 6, 30, 1, '#2c2c34');
        for (let i = 0; i < 20; i++) px(8 + i, y + 2 + i * 1.3, 2, 1, '#2c2c34');
      }
    }
  });
  return { img, wWorld: w / 2, hWorld, extraWorld: extra / 2 };
}

function drawCitySky(ctx, W, camX, time) {
  bands(ctx, 0, 0, W, LANE_H, SKY, 48);
  // A hazy sun low on the horizon.
  glow(ctx, W * 0.78, 92, 50, '#ffd890', 0.35);
  // Clouds
  const cp = camX * 0.08 + time * 2;
  for (let k = Math.floor(cp / 130) - 1; k < (cp + W) / 130 + 1; k++) {
    const img = cloudImage(hash(k, 3) % 5);
    ctx.drawImage(img, q(k * 130 - cp + (hash(k, 3) % 50)), 10 + (hash(k, 4) % 30), 48, 18);
  }
  // Far skyline
  const far = camX * 0.18;
  for (let k = Math.floor(far / 18) - 1; k < (far + W) / 18 + 1; k++) {
    const h = 26 + (hash(k, 11) % 46);
    const x = q(k * 18 - far);
    ctx.fillStyle = '#6a8cd0';
    ctx.fillRect(x, 104 - h, 17, h + 40);
    ctx.fillStyle = '#8eaee4';
    ctx.fillRect(x, 104 - h, 17, P);
    ctx.fillStyle = '#b4cdf2';
    for (let wy = 108 - h; wy < 100; wy += 4) for (let wx = 2; wx < 15; wx += 3) if (hash(k, wx, wy) % 3 === 0) ctx.fillRect(x + wx, wy, P * 2, P * 2);
    if (hash(k, 12) % 5 === 0) {
      ctx.fillStyle = '#6a8cd0';
      ctx.fillRect(x + 8, 96 - h, P * 2, 8);
      if (Math.floor(time * 2 + k) % 2) glow(ctx, x + 8.5, 96 - h, 2.5, '#ff4040');
    }
  }
  // Haze over the far skyline.
  ctx.fillStyle = 'rgba(246,216,176,0.18)';
  ctx.fillRect(0, 70, W, LANE_H - 70);
  // Middle layer
  const mid = camX * 0.32;
  for (let k = Math.floor(mid / 34) - 1; k < (mid + W) / 34 + 1; k++) {
    const h = 30 + (hash(k, 31) % 40);
    const x = q(k * 34 - mid);
    ctx.fillStyle = '#4c5c94';
    ctx.fillRect(x, 120 - h, 32, h + 30);
    ctx.fillStyle = '#6474ac';
    ctx.fillRect(x, 120 - h, 32, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x + 26, 120 - h, 6, h + 30);
    for (let wy = 125 - h; wy < 118; wy += 6) {
      for (let wx = 3; wx < 25; wx += 5) {
        ctx.fillStyle = hash(k, wx, wy) % 5 === 0 ? '#ffe4a0' : '#34406c';
        ctx.fillRect(x + wx, wy, 2.5, 3);
      }
    }
  }
  // Near buildings
  const near = camX * 0.52;
  for (let k = Math.floor(near / 62) - 1; k < (near + W) / 62 + 1; k++) {
    const b = buildingImage(k);
    const top = 134 - b.hWorld;
    ctx.drawImage(b.img, q(k * 62 - near), top - b.extraWorld, b.wWorld, b.hWorld + b.extraWorld);
  }
}

// ---------- Sewer background ----------

function sewerWall() {
  return cachedCanvas('sewerwall', 128, LANE_H * 2, (c, px) => {
    px(0, 0, 128, LANE_H * 2, '#0c0c1c');
    for (let y = 0; y < LANE_H * 2; y += 12) {
      const off = (y / 12) % 2 ? 0 : 10;
      for (let x = -off; x < 128; x += 20) {
        const tone = ['#191930', '#16162a', '#1c1c36'][hash(x, y) % 3];
        px(x + 1, y + 1, 19, 11, tone);
        px(x + 1, y + 1, 19, 1, '#24243e');
        px(x + 1, y + 11, 19, 1, '#0a0a16');
      }
    }
  });
}

/** A dark archway with a stone rim, 60 world px wide. */
function archImage() {
  const w = 120;
  const h = (LANE_H - 40) * 2;
  return cachedCanvas('arch', w, h, (c, px) => {
    const r = 52;
    for (let y = 0; y < h; y++) {
      const dy = r + 8 - y;
      const outer = y < r + 8 ? Math.sqrt(Math.max(0, (r + 8) ** 2 - dy * dy)) : r + 8;
      const inner = y < r + 8 ? Math.sqrt(Math.max(0, r * r - dy * dy)) : r;
      px(60 - outer, y, outer * 2, 1, y < 4 ? '#3c3c60' : '#2c2c4c');
      if (y >= 8) px(60 - inner, y, inner * 2, 1, css(mix([4, 4, 12], [8, 26, 14], Math.max(0, (y - 90) / 120))));
    }
  });
}

/** Lamp x positions on screen, shared by the drawing and the lighting. */
function lampXs(camX, W) {
  const po = camX * 0.75;
  const out = [];
  for (let k = Math.floor(po / 128) - 1; k < (po + W) / 128 + 1; k++) out.push({ x: q(k * 128 - po + 40), k });
  return out;
}

function drawTunnelBack(ctx, W, camX, time, y0) {
  const h = H - y0;
  // Back wall
  const wall = sewerWall();
  const off = (camX * 0.45) % 64;
  for (let x = -off; x < W; x += 64) ctx.drawImage(wall, q(x), y0, 64, LANE_H);
  // Arches
  const ao = camX * 0.6;
  const arch = archImage();
  for (let k = Math.floor(ao / 150) - 1; k < (ao + W) / 150 + 1; k++) {
    ctx.drawImage(arch, q(k * 150 - ao + 60) - 30, y0 + 40, 60, LANE_H - 40);
  }
  // Pipes
  const po = camX * 0.75;
  const pipe = (y, colors) => {
    colors.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(0, y + i * P * 2, W, P * 2);
    });
    for (let x = -(po % 64); x < W; x += 64) {
      bevelBox(ctx, q(x), y - 1, 4, colors.length + 2, '#5c5c6c', 0.5);
      ctx.fillStyle = '#c8c8d8';
      ctx.fillRect(q(x) + 1, y, P * 2, P * 2);
      ctx.fillRect(q(x) + 1, y + colors.length - 1, P * 2, P * 2);
    }
  };
  pipe(y0 + 36, ['#9c9cac', '#7c7c8c', '#5c5c6c', '#4c4c5c', '#3c3c4a', '#2c2c38']);
  pipe(y0 + 50, ['#6c9c6c', '#4c7c4c', '#3c643c', '#2c4c2c', '#1c341c']);
  // Drips
  for (let k = Math.floor(po / 52) - 1; k < (po + W) / 52 + 1; k++) {
    const x = q(k * 52 - po + (hash(k, 40) % 30));
    const fall = (time * 70 + (hash(k, 41) % 80)) % 90;
    ctx.fillStyle = '#5c8cc0';
    ctx.fillRect(x, y0 + 18 + fall, P * 2, P * 3);
  }
  // Lamps
  for (const { x, k } of lampXs(camX, W)) {
    const on = (Math.floor(time * 3) + k) % 7 !== 0;
    bevelBox(ctx, x - 1, y0 + 58, 6, 6, '#3c3c48', 0.5);
    ctx.fillStyle = on ? '#b8ff90' : '#1c4c1c';
    ctx.fillRect(x, y0 + 60, 4, 3);
    if (on) glow(ctx, x + 2, y0 + 61.5, 16, '#58d854', 0.6);
  }
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
  l.fillStyle = 'rgba(2,2,14,0.62)';
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
  for (const { x } of lamps || []) hole(x + 2, LANE_H + 62, 50);
  const p = g.player;
  if (p && laneOf(p.y) === 1) {
    hole(p.x - camX, p.y - 12, 72);
    if (p.firing > 0) hole(p.x - camX + p.aim.x * 12, p.y - 13, 60);
  }
  for (const s of g.shots) if (s.y > LANE_H) hole(s.x - camX, s.y, 18);
  for (const b of g.bullets) if (b.kind === 'flame' && b.y > LANE_H) hole(b.x - camX, b.y, 16);
  for (const f of g.portalFx) if (f.y > LANE_H) hole(f.x - camX, f.y, 50);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(lightCanvas, 0, LANE_H, lw * 4, lh * 4);
  ctx.restore();
}

// ---------- Lair background ----------

/** The temple of Moloch: firelit stone, banners and braziers. */
function drawLairBack(ctx, g, camX) {
  const W = g.W;
  const floor = ARENA_FLOOR * TILE;
  bands(ctx, 0, 0, W, H, [[0, '#0c0404'], [0.55, '#2c0c08'], [1, '#4c1810']], 40);
  // Stone wall
  const ox = camX * 0.9;
  for (let y = floor - 128; y < floor; y += 12) {
    const off = ((y / 12) % 2 ? 0 : 12) - (ox % 24);
    for (let x = off - 24; x < W; x += 24) {
      ctx.fillStyle = (hash(Math.floor((x + ox) / 24), y) % 3 === 0) ? '#3c1c14' : '#341810';
      ctx.fillRect(q(x), y, 23, 11);
      ctx.fillStyle = '#4c2a1c';
      ctx.fillRect(q(x), y, 23, P);
    }
  }
  // A carved arch behind the idol, glowing from the furnace.
  const cx = q((ARENA_COLS / 2) * TILE - camX);
  ctx.fillStyle = '#1c0806';
  for (let i = 0; i < 40; i++) {
    const half = 34 * Math.sqrt(Math.max(0, 1 - ((40 - i) / 40) ** 2));
    ctx.fillRect(q(cx - half), floor - 120 + i, q(half * 2), 1);
  }
  ctx.fillRect(cx - 34, floor - 80, 68, 80);
  glow(ctx, cx, floor - 40, 60, '#ff5010', 0.25 + Math.sin(g.time * 3) * 0.05);
  // Banners with the horned sigil
  for (const bx of [cx - 70, cx + 58]) {
    ctx.fillStyle = '#6c1018';
    ctx.fillRect(bx, floor - 120, 12, 40);
    ctx.fillStyle = '#4c0810';
    ctx.fillRect(bx + 10, floor - 120, 2, 40);
    for (let i = 0; i < 6; i++) ctx.fillRect(bx + i * 2, floor - 80, 1, 3 + (i % 2) * 2);
    ctx.fillStyle = '#e8c040';
    ctx.fillRect(bx + 3, floor - 108, 6, 6);
    ctx.fillRect(bx + 2, floor - 112, 1.5, 4);
    ctx.fillRect(bx + 8.5, floor - 112, 1.5, 4);
  }
  // Pillars with torches
  for (const x of [2, ARENA_COLS - 3]) {
    const px = q(x * TILE - camX);
    ctx.fillStyle = '#3c2418';
    ctx.fillRect(px, 0, 14, H);
    ctx.fillStyle = '#5c3a28';
    ctx.fillRect(px, 0, 2, H);
    ctx.fillStyle = '#1c0c08';
    ctx.fillRect(px + 12, 0, 2, H);
    const ty = floor - 70;
    ctx.fillStyle = '#2c2c34';
    ctx.fillRect(px + 5, ty, 4, 8);
    const f = Math.sin(g.time * 20 + x) * 1;
    glow(ctx, px + 7, ty - 3, 20, '#ff7020', 0.55 + f * 0.1);
    ctx.fillStyle = '#ff9030';
    ctx.fillRect(px + 5, ty - 5 + f, 4, 5);
    ctx.fillStyle = '#fff0a0';
    ctx.fillRect(px + 6, ty - 3 + f, 2, 3);
  }
  // Braziers on the floor
  for (const x of [cx - 52, cx + 46]) {
    ctx.fillStyle = '#2c2420';
    ctx.fillRect(x + 2, floor - 10, 2, 10);
    bevelBox(ctx, x - 2, floor - 14, 10, 5, '#7c5c3c', 0.5);
    const f = Math.sin(g.time * 17 + x) * 1.2;
    glow(ctx, x + 3, floor - 20, 16, '#ff6010', 0.6);
    ctx.fillStyle = '#ff8020';
    ctx.fillRect(x, floor - 21 + f, 6, 7);
    ctx.fillStyle = '#ffe080';
    ctx.fillRect(x + 1.5, floor - 18 + f, 3, 4);
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

// ---------- Decor in world coordinates ----------

function drawDecor(ctx, g, truth) {
  const area = g.area;
  if (area.kind !== 'street') return;
  for (const b of area.billboards) drawBillboard(ctx, b, truth, g.time);
  if (!g.glasses.taken) drawChurch(ctx, area.glasses.x, area.glasses.y);
  // The lair door, at the end of both lanes.
  const x = (area.exit.c0 + 1) * TILE;
  for (const lane of [0, 1]) {
    const y = area.ground[lane][area.exit.c0 + 1] * TILE;
    bevelBox(ctx, x, y - 64, 56, 64, '#3c2878', 2);
    bevelBox(ctx, x + 4, y - 60, 48, 60, '#6844fc', 1.5);
    ctx.fillStyle = '#050208';
    ctx.fillRect(x + 12, y - 48, 32, 48);
    glow(ctx, x + 28, y - 24, 22, '#9878f8', 0.45 + Math.sin(g.time * 4) * 0.15);
    drawTextOutlined(ctx, '>>>', x + 28, y - 57, Math.floor(g.time * 4) % 2 ? '#88ff70' : '#3cbc3c', 1, 'center');
  }
}

function fitLines(text, maxChars) {
  const words = text.split(' ');
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
  // Poles
  for (const px of [x + 16, x + w - 19]) {
    ctx.fillStyle = '#3c3c48';
    ctx.fillRect(px, y + h, 3, LANE_H - y - h);
    ctx.fillStyle = '#7c7c8c';
    ctx.fillRect(px, y + h, 1, LANE_H - y - h);
  }
  bevelBox(ctx, x, y, w, h, '#4c4c58', 1.5);
  const bg = ['#c82818', '#1c58d8', '#e87818', '#6844dc', '#1c9c4c'][hash(b.c, 9) % 5];
  if (truth) {
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
  } else {
    bands(ctx, x + 3, y + 3, w - 6, h - 6, [[0, shadeHex(bg, 0.25)], [1, shadeHex(bg, -0.25)]], 10);
  }
  const text = truth ? b.truth : b.ad;
  let scale = 2;
  let lines = fitLines(text, 10);
  if (lines.length > 2 || lines.some((l) => l.length > 11)) {
    scale = 1;
    lines = fitLines(text, 21);
  }
  const lh = 7 * scale;
  const top = y + h / 2 - (lines.length * lh - 2 * scale) / 2;
  lines.forEach((l, i) => {
    if (truth) drawText(ctx, l, x + w / 2, top + i * lh, '#101010', scale, 'center');
    else drawTextOutlined(ctx, l, x + w / 2, top + i * lh, '#ffffff', scale, 'center', shadeHex(bg, -0.6));
  });
  // Spotlights along the top.
  for (let i = 0; i < 3; i++) {
    const lx = x + 14 + i * 34;
    ctx.fillStyle = '#2c2c34';
    ctx.fillRect(lx, y - 3, 6, 3);
    if (!truth) {
      ctx.fillStyle = '#fff4c0';
      ctx.fillRect(lx + 1, y - 1, 4, 1);
      glow(ctx, lx + 3, y + 6, 12, '#fff0b0', 0.25);
    }
  }
  if (!truth && Math.floor(time * 3 + b.c) % 4 === 0) glow(ctx, x + 10, y + 8, 4, '#ffffff', 0.9);
}

function drawChurch(ctx, cx, groundY) {
  const x = Math.round(cx - 32);
  const top = groundY - 64;
  // Walls of stone blocks
  ctx.fillStyle = '#9c98a4';
  ctx.fillRect(x, top + 16, 64, 48);
  for (let yy = top + 16; yy < groundY; yy += 4) {
    ctx.fillStyle = '#84808c';
    ctx.fillRect(x, yy, 64, P);
    const off = ((yy - top) / 4) % 2 ? 0 : 4;
    for (let xx = x + off; xx < x + 64; xx += 8) ctx.fillRect(xx, yy, P, 4);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(x + 56, top + 16, 8, 48);
  // Roof and steeple
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i < 2 ? '#7c3c3c' : '#5c2c2c';
    ctx.fillRect(x - 2 + i, top + 16 - i * 0.6, 68 - i * 2, 1);
  }
  bevelBox(ctx, x + 24, top, 16, 16, '#aca8b4', 1);
  ctx.fillStyle = '#5c2c2c';
  for (let i = 0; i < 6; i++) ctx.fillRect(x + 24 + i * 1.2, top - i * 1.2, 16 - i * 2.4, 1.2);
  ctx.fillStyle = '#f0e8c0';
  ctx.fillRect(x + 31, top - 18, 2, 11);
  ctx.fillRect(x + 28, top - 15, 8, 2);
  glow(ctx, x + 32, top - 13, 5, '#ffe890', 0.4);
  // Stained glass
  for (const wx of [x + 7, x + 49]) {
    ctx.fillStyle = '#3c3c48';
    ctx.fillRect(wx - 1, top + 25, 10, 15);
    const glass = ['#e83838', '#3878e8', '#f8c838', '#38b858'];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = glass[i];
      ctx.fillRect(wx + (i % 2) * 4, top + 26 + Math.floor(i / 2) * 6.5, 4, 6.5);
    }
    ctx.fillStyle = '#3c3c48';
    ctx.fillRect(wx + 3.75, top + 26, P, 13);
  }
  // Door
  bevelBox(ctx, x + 24, top + 42, 16, 22, '#6c4428', 1);
  ctx.fillStyle = '#3c2414';
  ctx.fillRect(x + 31.75, top + 42, P, 22);
  ctx.fillStyle = '#e8c860';
  ctx.fillRect(x + 29, top + 53, 1, 1);
  ctx.fillRect(x + 34, top + 53, 1, 1);
  drawText(ctx, 'CHURCH', x + 32, top + 19, '#3c3c48', 1, 'center');
}

function drawTiles(ctx, g, camX) {
  const area = g.area;
  const frame = Math.floor(g.time * 6) % 4;
  const c0 = Math.floor(camX / TILE) - 1;
  const c1 = c0 + Math.ceil(g.W / TILE) + 2;
  for (let c = c0; c <= c1; c++) {
    if (area.kind !== 'boss' && (c < 0 || c >= area.cols)) continue;
    for (let r = 0; r < ROWS; r++) {
      const t = tileAt(area, c, r);
      if (t === T.AIR) continue;
      // Street tiles look like the city on top and the sewers below.
      const kind = area.kind === 'boss' ? 'boss' : r < LANE_ROWS ? 'city' : 'tunnel';
      const above = tileAt(area, c, r - 1);
      const top = r > 0 && r !== LANE_ROWS && !isSolid(above) && above !== T.SLUDGE;
      ctx.drawImage(tileSprite(kind, t, top, frame, hash(c, r) % 4), c * TILE, r * TILE, TILE, TILE);
    }
  }
  if (area.kind === 'street') {
    // A dark seam where the city's ground meets the sewer roof.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(c0 * TILE, LANE_H, (c1 - c0 + 1) * TILE, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(c0 * TILE, LANE_H + 1, (c1 - c0 + 1) * TILE, 1);
  }
}

/** Purple rings where the player left and arrived through a portal. */
function drawPortalFx(ctx, g) {
  for (const f of g.portalFx) {
    const k = f.t / 0.5;
    glow(ctx, f.x, f.y, 26 * (1 - k * 0.5), '#9878f8', 1 - k);
    for (let ring = 0; ring < 2; ring++) {
      const rx = 4 + k * 14 + ring * 4;
      const ry = 10 + k * 6 + ring * 3;
      ctx.fillStyle = ring ? '#6844fc' : '#e0d8ff';
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * Math.PI * 2 + g.time * (ring ? -6 : 6);
        ctx.fillRect(q(f.x + Math.cos(a) * rx), q(f.y + Math.sin(a) * ry), 1, 1);
      }
    }
  }
}

// ---------- Things ----------

const PICKUP_COLORS = { M: '#2860d8', N: '#d83020', T: '#e87818', S: '#c02060', C: '#20a8b8', P: '#7050f0' };

/** A shiny weapon capsule, 12 world px across. */
function capsule(color) {
  return cachedCanvas(`cap:${color}`, 24, 24, (c, px) => {
    const base = rgb(color);
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 24; x++) {
        const d = Math.hypot(x - 11.5, y - 11.5);
        if (d > 11.5) continue;
        if (d > 10.5) {
          px(x, y, 1, 1, css(mix(base, [16, 8, 24], 0.75)));
          continue;
        }
        const lit = Math.hypot(x - 8, y - 7) / 16;
        px(x, y, 1, 1, css(lit < 0.5 ? mix(base, [255, 248, 232], 0.5 - lit) : mix(base, [28, 16, 48], (lit - 0.5) * 0.9)));
      }
    }
    px(6, 5, 3, 2, 'rgba(255,255,255,0.9)');
    px(5, 7, 2, 2, 'rgba(255,255,255,0.7)');
  });
}

function drawPickups(ctx, g, truthLayer) {
  const bob = q(Math.sin(g.time * 4) * 1.5);
  if (!truthLayer && g.area.kind === 'street' && !g.glasses.taken) {
    const { x, y } = g.area.glasses;
    bevelBox(ctx, x - 8, y - 9, 16, 9, '#b8884c', 1);
    ctx.fillStyle = '#8c6030';
    ctx.fillRect(x - 0.5, y - 9, 1, 9);
    ctx.fillStyle = '#d8b070';
    ctx.fillRect(x - 6, y - 5, 4, 1);
    glow(ctx, x, y - 13 + bob, 9, '#ffffff', 0.35 + Math.sin(g.time * 5) * 0.15);
    drawSprite(ctx, icon('shades', '#202028'), x - 4.5, y - 14 + bob);
  }
  for (const k of g.pickups) {
    if (k.taken || k.hidden !== truthLayer) continue;
    if (k.hidden && !g.glasses.on) continue;
    const x = q(k.x);
    const y = q(k.y - 7 + bob);
    if (k.hidden) glow(ctx, x, y, 12, '#58d854', 0.6);
    if (k.kind === '+') {
      drawSprite(ctx, icon('heart', '#e83838'), x - 3.5, y - 3);
      if (Math.floor(g.time * 3) % 3 === 0) glow(ctx, x - 1.5, y - 1.5, 3, '#ffffff');
    } else if (k.kind === 'H') {
      drawSprite(ctx, icon('hat', '#f8c820'), x - 4, y - 2);
    } else {
      if (k.kind === 'P') glow(ctx, x, y, 12, '#9878f8', 0.6 + Math.sin(g.time * 8) * 0.3);
      ctx.drawImage(capsule(PICKUP_COLORS[k.kind] || C.red), x - 6, y - 6, 12, 12);
      drawTextOutlined(ctx, k.kind, x - 1.5, y - 2.5, '#ffffff', 1, 'left', '#200810');
    }
  }
}

/** Four-frame walk cycle. */
function poseOf(a) {
  if (!a.onGround) return 'jump';
  if (Math.abs(a.vx) > 1) return ['walk1', 'stand', 'walk2', 'stand'][Math.floor(a.anim * 10) % 4];
  return 'stand';
}

function drawChild(ctx, g, a, carried) {
  const pose = carried ? 'jump' : poseOf(a);
  const wiggle = carried ? q(Math.sin(g.time * 18) * 1) : 0;
  drawSprite(ctx, childSprite(a.look, pose, a.face < 0), q(a.x - 6) + wiggle, q(a.y - 15));
}

function drawActor(ctx, g, a, truthLayer) {
  if (a.type === 'boss') return drawBoss(ctx, g, a);
  if (a.type === 'cultist') return drawCultist(ctx, g, a);
  if (a.type === 'child') {
    if (!a.carriedBy) drawChild(ctx, g, a, false);
    return;
  }
  let kind;
  if (a.type === 'civilian') kind = 'civilian';
  else if (!a.disguised) kind = 'lizard';
  else if (a.revealed || truthLayer) kind = 'disguised';
  else {
    // The mask slips for a moment while they stare at you.
    const slip = a.glance > 0 && a.glance < 0.35 && Math.floor(a.anim * 12) % 3 === 0;
    kind = slip ? 'disguised' : 'civilian';
  }
  const flip = a.face < 0;
  let spr = personSprite(kind, a.look, poseOf(a), flip);
  const x = q(a.x - 6);
  const y = q(a.y - 22);
  if (kind === 'lizard') {
    // Tail
    const tx = flip ? x + 10 : x - 3;
    const dir = flip ? 1 : -1;
    const sway = Math.sin(a.anim * 8) * 0.5;
    ctx.fillStyle = '#103c18';
    ctx.fillRect(tx - 0.5, y + 14.5 + sway, 5, 3);
    ctx.fillStyle = '#1c7c34';
    ctx.fillRect(tx, y + 15 + sway, 4, 2);
    ctx.fillRect(tx + dir * 2, y + 17 + sway, 2.5, 1.5);
    ctx.fillStyle = '#58c860';
    ctx.fillRect(tx, y + 15 + sway, 4, P);
  }
  if (a.flash > 0) spr = flashSprite(spr);
  drawSprite(ctx, spr, x, y);
  if (a.child) {
    // Holding a struggling child over its head.
    drawChild(ctx, g, a.child, true);
    if (Math.floor(g.time * 4) % 2) drawTextOutlined(ctx, 'HELP!', a.x, a.y - 44, '#fc7460', 1, 'center');
  }
  if (a.carrier && (a.revealed || truthLayer)) {
    // The portal device, glowing in its hand.
    const dx = flip ? x - 1 : x + 10;
    glow(ctx, dx + 2, y + 12, 7, '#9878f8', 0.7 + Math.sin(g.time * 10) * 0.3);
    bevelBox(ctx, dx, y + 10, 4, 4, '#6844fc', 0.5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(dx + 1, y + 11, 1.5, 1.5);
  }
  if (truthLayer && !a.revealed) {
    // Corner brackets mark the ones still pretending.
    ctx.fillStyle = a.carrier ? '#b8a0ff' : '#88ff70';
    ctx.fillRect(x - 2, y - 2, 3, 1);
    ctx.fillRect(x - 2, y - 2, 1, 3);
    ctx.fillRect(x + 11, y - 2, 3, 1);
    ctx.fillRect(x + 13, y - 2, 1, 3);
  }
  if (a.type === 'gunner' && (a.revealed || truthLayer)) {
    // Ray gun
    const gx = flip ? x - 4 : x + 9;
    bevelBox(ctx, gx, y + 10.5, 7, 2.5, '#9c9cb0', 0.5);
    ctx.fillStyle = '#5c5c70';
    ctx.fillRect(flip ? gx + 4 : gx + 1, y + 13, 2, 2);
    glow(ctx, flip ? gx : gx + 7, y + 11.75, 3, '#f878f8', 0.8);
  }
}

/** The idol of Moloch on its pedestal: stone while the ceremony goes on. */
function drawBoss(ctx, g, b) {
  const floor = ARENA_FLOOR * TILE;
  const px = (ARENA_COLS / 2) * TILE;
  // Pedestal, cracked once the idol has stepped off.
  bevelBox(ctx, px - 28, floor - PEDESTAL_H, 56, PEDESTAL_H, '#5c4a3c', 1);
  ctx.fillStyle = '#3c2c20';
  for (let i = 0; i < 5; i++) ctx.fillRect(px - 22 + i * 10, floor - PEDESTAL_H + 3, 4, 4);
  if (b.state === 'awake' || b.dead) {
    ctx.fillStyle = '#1c140c';
    ctx.fillRect(px - 6, floor - PEDESTAL_H, 1, 4);
    ctx.fillRect(px - 5, floor - PEDESTAL_H + 4, 1, 3);
    ctx.fillRect(px + 9, floor - PEDESTAL_H, 1, 5);
  }
  if (b.dead && Math.floor(g.time * 20) % 2) return;
  const flicker = b.state === 'waking' && Math.floor(g.time * (6 + (2.2 - b.timer) * 8)) % 2 === 0;
  const awake = b.state === 'awake' || flicker;
  let spr = molochSprite(awake, b.face > 0);
  if (b.flash > 0) spr = flashSprite(spr);
  const x = q(b.x - 24);
  const y = q(b.y - 66);
  drawSprite(ctx, spr, x, y);
  if (awake) {
    // Burning eyes and a roaring furnace.
    const pulse = 0.7 + Math.sin(g.time * 12) * 0.3;
    glow(ctx, x + 16.5, y + 19.5, 6, '#ff3018', pulse);
    glow(ctx, x + 31.5, y + 19.5, 6, '#ff3018', pulse);
    glow(ctx, b.x, y + 46.5, 18, '#ff8020', 0.6 + Math.sin(g.time * 9) * 0.25);
    for (let i = 0; i < 3; i++) {
      const fx = b.x - 8 + ((g.time * 37 + i * 13) % 16);
      const fy = y + 50 - ((g.time * 30 + i * 9) % 12);
      ctx.fillStyle = i % 2 ? '#ffe060' : '#ff6020';
      ctx.fillRect(q(fx), q(fy), 1.5, 1.5);
    }
  } else if (b.state === 'waking') {
    glow(ctx, b.x, y + 30, 30, '#ff3018', 0.25);
  }
}

function drawCultist(ctx, g, a) {
  const chant = a.chanting;
  const pose = !a.onGround || !chant && Math.abs(a.vx) > 1 ? ['walk1', 'stand', 'walk2', 'stand'][Math.floor(a.anim * 10) % 4] : 'stand';
  let spr = cultistSprite(a.role === 'priest', pose, a.face < 0);
  if (a.flash > 0) spr = flashSprite(spr);
  const bob = chant ? q(Math.sin(a.anim * 4) * 1) : 0;
  const x = q(a.x - 6);
  const y = q(a.y - 22) + bob;
  drawSprite(ctx, spr, x, y);
  if (chant) {
    // Arms raised to the idol.
    const lift = q(Math.sin(a.anim * 4) * 1.5);
    for (const hx of [x - 1, x + 11]) {
      ctx.fillStyle = '#1c5c2c';
      ctx.fillRect(hx, y + 1 + lift, 2, 3);
      ctx.fillStyle = '#5cd870';
      ctx.fillRect(hx, y + 1 + lift, 2, 1);
    }
  } else if (a.role === 'priest') {
    glow(ctx, a.x + a.face * 7, a.y - 15, 4, '#ff8020', 0.7);
  }
}

function drawPlayer(ctx, g) {
  const p = g.player;
  if (!p) return;
  if (p.inv > 0 && g.mode === 'play' && Math.floor(g.time * 20) % 2) return;
  const flip = p.face < 0;
  const tackling = p.tackle > 0;
  if (tackling) {
    // Speed lines behind a shoulder charge.
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.7 - i * 0.12})`;
      ctx.fillRect(q(p.x - p.face * (10 + i * 5) - 3), q(p.y - 14 + ((i * 5) % 12)), 6 - i, P * 2);
    }
  }
  // Contra-style poses: both hands on the rifle, a somersault in the air.
  const pose = heroPose(p);
  const legs = Math.abs(p.vx) > 1 && !tackling ? ['walk1', 'stand', 'walk2', 'stand'][Math.floor(p.anim * 10) % 4] : 'stand';
  if (pose === 'ball') {
    const frame = Math.floor(g.time * 14) % 4;
    drawSprite(ctx, playerSprite('ball', 'stand', false, flip, flip ? 3 - frame : frame), q(p.x - 7), q(p.y - 18));
  } else {
    drawSprite(ctx, playerSprite(pose, legs, g.glasses.on, flip), q(p.x - 10), q(p.y - 28));
    if (g.armor) {
      // A white stripe on the hard hat.
      const top = pose === 'crouch' ? p.y - 16 : p.y - 22;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(q(p.x - 2), q(top + 0.5), 3, P);
    }
  }
  const m = heroMuzzle(p);
  const { x: ax, y: ay } = p.aim;
  if (p.planted) {
    // Feet planted: a dotted guide shows where the shots will go.
    for (let i = 0; i < 6; i++) {
      const d = 6 + i * 7 + ((g.time * 20) % 7);
      ctx.fillStyle = `rgba(248,216,0,${0.75 - i * 0.11})`;
      ctx.fillRect(q(m.x + ax * d), q(m.y + ay * d), 1, 1);
    }
    ctx.fillStyle = 'rgba(248,216,0,0.8)';
    ctx.fillRect(q(p.x - 6), q(p.y), 3, P * 2);
    ctx.fillRect(q(p.x + 3), q(p.y), 3, P * 2);
  }
  if (p.firing > 0 && !tackling) {
    const fx = m.x + ax * 2;
    const fy = m.y + ay * 2;
    glow(ctx, fx, fy, 9, '#ffc040');
    ctx.fillStyle = '#fffbe0';
    ctx.fillRect(q(fx - 1.5), q(fy - 0.5), 3, 1);
    ctx.fillRect(q(fx - 0.5), q(fy - 1.5), 1, 3);
  }
}

function drawBullets(ctx, g) {
  for (const b of g.bullets) {
    const x = q(b.x);
    const y = q(b.y);
    if (b.kind === 'pellet') {
      glow(ctx, x, y, 3, '#ffc040', 0.8);
      ctx.fillStyle = '#fff8c0';
      ctx.fillRect(x - 0.5, y - 0.5, 1.5, 1.5);
    } else if (b.kind === 'bullet') {
      const len = Math.hypot(b.vx, b.vy);
      const dx = b.vx / len;
      const dy = b.vy / len;
      glow(ctx, x, y, 3.5, '#ffe060', 0.6);
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i < 2 ? '#fffbe0' : '#ffb030';
        ctx.fillRect(q(x - dx * i * 0.7), q(y - dy * i * 0.7), 1, 1);
      }
    } else if (b.kind === 'nail') {
      const len = Math.hypot(b.vx, b.vy);
      const dx = b.vx / len;
      const dy = b.vy / len;
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i === 0 ? '#ffffff' : '#a0a0b8';
        ctx.fillRect(q(x - dx * i * 0.75), q(y - dy * i * 0.75), 1, 1);
      }
    } else if (b.kind === 'flame') {
      const t = b.life / 0.32;
      glow(ctx, x, y, 3 + (1 - t) * 4, t > 0.5 ? '#ffb030' : '#ff5010', 0.9);
      ctx.fillStyle = t > 0.6 ? '#fffbd0' : t > 0.3 ? '#ffc040' : '#e84010';
      ctx.fillRect(x - 1, y - 1, 2, 2);
    } else {
      glow(ctx, x, y, 5, '#ffffff', 0.7);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 2, y - 1, 4, 2);
      ctx.fillStyle = '#ffe060';
      ctx.fillRect(x - 1, y - 0.5, 2, 1);
    }
  }
}

function drawShots(ctx, g) {
  const pulse = Math.sin(g.time * 20) * 0.5 + 0.5;
  for (const s of g.shots) {
    const x = q(s.x);
    const y = q(s.y);
    const r = s.r;
    if (s.fire) {
      glow(ctx, x, y, r * 3, '#ff7020', 0.7 + pulse * 0.3);
      ctx.fillStyle = '#e84010';
      ctx.fillRect(x - r, y - r + 1, r * 2, r * 2 - 2);
      ctx.fillRect(x - r + 1, y - r, r * 2 - 2, r * 2);
      ctx.fillStyle = '#ffc040';
      ctx.fillRect(x - r + 1, y - r + 1, r * 2 - 2, r * 2 - 2);
      ctx.fillStyle = '#fffbe0';
      ctx.fillRect(x - 1, y - 1, 1.5, 1.5);
      continue;
    }
    glow(ctx, x, y, r * 2.6, '#ff40e0', 0.65 + pulse * 0.3);
    ctx.fillStyle = '#d020c0';
    ctx.fillRect(x - r, y - r + 1, r * 2, r * 2 - 2);
    ctx.fillRect(x - r + 1, y - r, r * 2 - 2, r * 2);
    ctx.fillStyle = '#ff90f0';
    ctx.fillRect(x - r + 1, y - r + 0.5, r * 2 - 2, r - 0.5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 1, y - 1, 1.5, 1.5);
  }
}

function drawParticles(ctx, g) {
  for (const p of g.particles) {
    ctx.globalAlpha = Math.min(1, p.life * 3);
    ctx.fillStyle = p.color;
    ctx.fillRect(q(p.x), q(p.y), p.size, p.size);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(q(p.x), q(p.y), p.size / 2, p.size / 2);
  }
  ctx.globalAlpha = 1;
}

// ---------- HUD and screens ----------

function drawHud(ctx, g) {
  const W = g.screenW;
  panel(ctx, 2, 2, 52, 10);
  for (let i = 0; i < 4; i++) {
    drawSprite(ctx, i < g.hearts ? icon('heart', '#e83838') : icon('heartEmpty', '#c8c8d8'), 4 + i * 9, 4);
  }
  if (g.armor) drawSprite(ctx, icon('hat', '#f8c820'), 42, 5);

  const gl = g.glasses;
  if (gl.have) {
    panel(ctx, 2, 13, 52, 8);
    drawSprite(ctx, icon('shades', gl.on ? '#78f060' : '#e8e8f0'), 4, 15);
    meter(ctx, 15, 15, 32, 3.5, gl.meter, gl.locked ? '#e83030' : gl.on ? '#58d854' : '#e8e8f0');
    if (gl.contacts) drawTextOutlined(ctx, 'C', 49.5, 14.5, '#40f0f0');
  } else if (g.area.kind === 'street' && Math.floor(g.time * 2) % 2) {
    drawTextOutlined(ctx, 'FIND THE SHADES', 4, 15, '#f8d800');
  }
  const pt = g.portal;
  if (pt.have && g.area.kind === 'street') {
    panel(ctx, 2, 22, 52, 8);
    const ready = pt.cd <= 0;
    if (ready) glow(ctx, 8.5, 26, 5, '#9878f8', 0.6);
    bevelBox(ctx, 4, 23.5, 9, 5, ready ? '#7858f0' : '#3c3c48', 0.5);
    ctx.fillStyle = '#0c0818';
    ctx.fillRect(6, 25, 5, 2);
    drawText(ctx, ready ? 'PORTAL' : 'CHARGING', 15, 24, ready ? '#d0c4ff' : '#7c7c8c');
  }

  const part = { street: 1, boss: 2 }[g.areaKey];
  drawTextOutlined(ctx, `STAGE ${g.stageNum}-${part}`, W / 2, 4, '#ffffff', 1, 'center');
  panel(ctx, W - 82, 2, 53, 16);
  drawTextOutlined(ctx, String(g.score).padStart(7, '0'), W - 32, 4, '#ffffff', 1, 'right');
  drawTextOutlined(ctx, WEAPON_INFO[g.weapon].name, W - 32, 11, '#f8d800', 1, 'right');
  if (g.player?.planted) drawTextOutlined(ctx, 'LOCKED', W - 32, 21, '#f8d800', 1, 'right');

  // Pause button
  panel(ctx, W - 26, 2, 23, 21);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(W - 19.5, 6.5, 3.5, 12);
  ctx.fillRect(W - 13, 6.5, 3.5, 12);
  g.pauseRect = { x: W - 40, y: 0, w: 40, h: 32 };

  const b = g.boss;
  if (b && !b.dead && b.state !== 'awake') {
    const left = g.cultistsLeft();
    if (left > 0) drawTextOutlined(ctx, `ATTENDEES LEFT: ${left}`, W / 2, 13, '#ff8060', 1, 'center');
  } else if (b && !b.dead) {
    drawTextOutlined(ctx, b.name, W / 2, 13, '#ffb040', 1, 'center');
    panel(ctx, W / 2 - 52, 20, 104, 6, 0.8);
    meter(ctx, W / 2 - 50, 21, 100, 4, Math.max(0, b.hp) / b.maxHp, '#e83030');
  }
}

function drawBanner(ctx, g) {
  const { title, sub, t } = g.banner;
  if (t < 0.3 && Math.floor(t * 20) % 2) return;
  const W = g.screenW;
  const h = sub ? 30 : 20;
  for (let i = 0; i < 12; i++) {
    const a = 0.6 * Math.sin(((i + 0.5) / 12) * Math.PI);
    ctx.fillStyle = `rgba(6,4,20,${a})`;
    ctx.fillRect(0, 52 + (h * i) / 12, W, h / 12 + P);
  }
  ctx.fillStyle = 'rgba(248,216,0,0.6)';
  ctx.fillRect(W * 0.2, 52, W * 0.6, P);
  ctx.fillRect(W * 0.2, 52 + h - P, W * 0.6, P);
  drawTextOutlined(ctx, title, W / 2, 56, '#ffffff', 2, 'center');
  if (sub) drawTextOutlined(ctx, sub, W / 2, 72, '#f8d800', 1, 'center');
}

function drawMenu(ctx, g, top) {
  const m = g.menu;
  if (!m) return;
  const W = g.screenW;
  // Big, thumb-sized buttons.
  const bw = 220;
  const bh = 32;
  m.items.forEach((item, i) => {
    const label = typeof item.label === 'function' ? item.label() : item.label;
    const x = Math.round(W / 2 - bw / 2);
    const y = top + i * (bh + 8);
    const sel = i === m.sel;
    if (sel) glow(ctx, W / 2, y + bh / 2, 80, '#f8d800', 0.18 + Math.sin(g.time * 5) * 0.06);
    bands(ctx, x, y, bw, bh, sel ? [[0, '#3c3478'], [1, '#14102c']] : [[0, '#2c2c40'], [1, '#0c0c18']], 6);
    ctx.fillStyle = sel ? '#f8d800' : '#7c7c90';
    ctx.fillRect(x, y, bw, P * 2);
    ctx.fillRect(x, y + bh - P * 2, bw, P * 2);
    ctx.fillRect(x, y, P * 2, bh);
    ctx.fillRect(x + bw - P * 2, y, P * 2, bh);
    drawTextOutlined(ctx, label, W / 2, y + 11, sel ? '#f8d800' : '#ffffff', 2, 'center');
    if (sel) drawTextOutlined(ctx, '>', x + 10 + Math.sin(g.time * 8) * 2, y + 11, '#f8d800', 2);
    g.menuRects.push({ x, y, w: bw, h: bh, index: i });
  });
}

function dim(ctx, g) {
  ctx.fillStyle = 'rgba(4,2,14,0.68)';
  ctx.fillRect(0, 0, g.screenW, H);
}

function drawPaused(ctx, g) {
  dim(ctx, g);
  drawTextOutlined(ctx, 'PAUSED', g.screenW / 2, 64, '#ffffff', 3, 'center');
  drawMenu(ctx, g, 100);
}

function drawGameOver(ctx, g) {
  dim(ctx, g);
  drawTextOutlined(ctx, 'GAME OVER', g.screenW / 2, 36, '#e83030', 3, 'center');
  drawTextOutlined(ctx, `STAGE ${g.stageNum}   SCORE ${g.score}`, g.screenW / 2, 62, '#ffffff', 1, 'center');
  drawTextOutlined(ctx, `BEST: STAGE ${g.save.bestStage}   SCORE ${g.save.bestScore}`, g.screenW / 2, 72, '#bcbcc8', 1, 'center');
  drawTextOutlined(ctx, 'THEY LIVE. WE SLEEP.', g.screenW / 2, 84, '#78f060', 1, 'center');
  drawMenu(ctx, g, 104);
}

function drawClear(ctx, g) {
  dim(ctx, g);
  drawTextOutlined(ctx, `STAGE ${g.stageNum} CLEAR!`, g.screenW / 2, 30, '#f8d800', 2, 'center');
  const s = g.stageStats;
  const rows = [
    ['LIZARDS EXPOSED', s.lizards],
    ['INNOCENTS HIT', s.innocents],
    ['CHILDREN SAVED', s.saved],
    ['CHILDREN TAKEN', s.lost],
    ['STAGE BONUS', g.clearInfo.bonus],
    ['SCORE', g.score],
  ];
  panel(ctx, g.screenW / 2 - 66, 50, 132, 64, 0.5);
  rows.forEach(([label, value], i) => {
    drawTextOutlined(ctx, label, g.screenW / 2 - 60, 54 + i * 10, '#ffffff');
    drawTextOutlined(ctx, String(value), g.screenW / 2 + 60, 54 + i * 10, '#ffffff', 1, 'right');
  });
  drawMenu(ctx, g, 128);
}

function drawTitle(ctx, g, usingTouch) {
  const W = g.screenW;
  const cam = g.time * 12;
  // The two worlds, one above the other, like in the game.
  drawCitySky(ctx, W, cam, g.time);
  drawTunnelBack(ctx, W, cam, g.time, LANE_H + 16);
  for (let x = -(cam % 16); x < W; x += 16) {
    ctx.drawImage(tileSprite('city', 1, true, 0, hash(Math.floor((x + cam) / 16)) % 4), q(x), LANE_H - 20, 16, 16);
    ctx.drawImage(tileSprite('city', 1, false, 0, 1), q(x), LANE_H - 4, 16, 16);
    ctx.drawImage(tileSprite('tunnel', 1, false, 0, 2), q(x), LANE_H + 4, 16, 12);
  }
  ctx.fillStyle = 'rgba(4,2,14,0.5)';
  ctx.fillRect(0, 0, W, H);

  // A billboard that flickers between the ad and the truth.
  const truth = Math.floor(g.time / 1.6) % 2 === 1 && Math.random() > 0.08;
  ctx.save();
  ctx.translate(Math.round(W / 2 - 48), 12);
  drawBillboard(ctx, { c: 0, r: 0, w: 6, h: 3, ad: 'CONSUME?', truth: 'OBEY' }, truth, g.time);
  ctx.restore();

  glow(ctx, W / 2, 92, 90, '#e83030', 0.25);
  drawTextOutlined(ctx, 'THEY LIVE', W / 2 + 2, 82, '#7c0018', 5, 'center', '#000000');
  drawTextOutlined(ctx, 'THEY LIVE', W / 2, 80, '#f0f0f8', 5, 'center', '#300010');
  drawTextOutlined(ctx, 'PUT ON THE SHADES. SEE THE TRUTH.', W / 2, 116, '#f8d800', 1, 'center');
  drawTextOutlined(ctx, 'THE LOOT IS BELOW. FIND THE PORTAL.', W / 2, 126, '#c8b8fc', 1, 'center');

  if (g.save.bestStage > 0) {
    drawTextOutlined(ctx, `BEST: STAGE ${g.save.bestStage}   SCORE ${g.save.bestScore}`, W / 2, H - 30, '#ffffff', 1, 'center');
  }
  if (!usingTouch) drawTextOutlined(ctx, 'ARROWS MOVE  Z JUMP  X FIRE  F TACKLE  SHIFT LOCK AIM  G SHADES  V PORTAL  P PAUSE', W / 2, H - 16, '#bcbcc8', 1, 'center');
}
