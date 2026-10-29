// Draws the game onto the low-resolution screen canvas (VIEW_H pixels tall,
// scaled up by CSS). With the sunglasses on, the world turns black and white
// and the lizards are drawn on top in color.

import { TILE, ROWS, LANE_ROWS, ARENA_COLS, T, tileAt, isSolid } from './stage.js';
import { personSprite, playerSprite, bossSprite, tileSprite, icon, drawText, drawTextOutlined, COLORS as C } from './sprites.js';
import { hash } from './rng.js';
import { WEAPON_INFO, VIEW_H } from './game.js';

const H = VIEW_H;

export function render(ctx, g, usingTouch) {
  const W = g.W;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  g.menuRects = [];

  if (g.mode === 'title') {
    drawTitle(ctx, g, usingTouch);
    drawMenu(ctx, g, 150);
    return;
  }

  const shaking = g.shake > 0;
  const sx = shaking ? Math.round((Math.random() - 0.5) * 4) : 0;
  const sy = shaking ? Math.round((Math.random() - 0.5) * 3) : 0;
  const camX = Math.round(g.cam.x);
  const truth = g.glasses.on && g.mode !== 'title';

  drawBackground(ctx, g, camX);
  ctx.save();
  ctx.translate(-camX + sx, sy);
  drawDecor(ctx, g, truth);
  drawTiles(ctx, g, camX);
  drawPickups(ctx, g, false);
  for (const a of g.actors) if (!(truth && isLizard(a))) drawActor(ctx, g, a, false);
  drawPlayer(ctx, g);
  drawBullets(ctx, g);
  if (!truth) drawShots(ctx, g);
  drawParticles(ctx, g);
  ctx.restore();

  if (truth) {
    grayscale(ctx, W, H);
    ctx.save();
    ctx.translate(-camX + sx, sy);
    for (const a of g.actors) if (isLizard(a)) drawActor(ctx, g, a, true);
    drawPickups(ctx, g, true);
    drawShots(ctx, g);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(-camX, 0);
  drawPortalFx(ctx, g);
  for (const t of g.texts) drawTextOutlined(ctx, t.text, t.x, t.y, t.color, 1, 'center');
  ctx.restore();

  drawHud(ctx, g);
  if (g.banner) drawBanner(ctx, g);
  if (g.fade > 0) {
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, g.fade)})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (g.mode === 'paused') drawPaused(ctx, g);
  else if (g.mode === 'gameover') drawGameOver(ctx, g);
  else if (g.mode === 'clear') drawClear(ctx, g);
}

function isLizard(a) {
  return a.type === 'grunt' || a.type === 'gunner' || a.type === 'boss';
}

/** Turns the frame into four shades of gray, like the film's glasses. */
function grayscale(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
    const v = l < 45 ? 0 : l < 105 ? 80 : l < 175 ? 168 : 252;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}

// ---------- Backgrounds ----------

const LANE_H = LANE_ROWS * TILE;

function drawBackground(ctx, g, camX) {
  if (g.area.kind === 'street') {
    drawCitySky(ctx, g.W, camX, g.time);
    drawTunnelBack(ctx, g.W, camX, g.time, LANE_H);
  } else drawLairBack(ctx, g, camX);
}

/** The city behind the top lane, in screen rows 0..LANE_H. */
function drawCitySky(ctx, W, camX, time) {
  ctx.fillStyle = '#3cbcfc';
  ctx.fillRect(0, 0, W, LANE_H);
  ctx.fillStyle = '#a4e4fc';
  ctx.fillRect(0, 76, W, LANE_H - 76);
  // Clouds
  ctx.fillStyle = C.white;
  for (let k = Math.floor((camX * 0.1) / 90) - 1; k < (camX * 0.1 + W) / 90 + 1; k++) {
    const x = Math.round(k * 90 - camX * 0.1 + (hash(k, 3) % 40));
    const y = 22 + (hash(k, 4) % 22);
    ctx.fillRect(x, y, 24, 4);
    ctx.fillRect(x + 4, y - 3, 14, 3);
  }
  // Far skyline
  const far = camX * 0.25;
  for (let k = Math.floor(far / 22) - 1; k < (far + W) / 22 + 1; k++) {
    const h = 24 + (hash(k, 11) % 45);
    const x = Math.round(k * 22 - far);
    ctx.fillStyle = '#5c94fc';
    ctx.fillRect(x, 100 - h, 20, h + 44);
    ctx.fillStyle = '#8cb8fc';
    for (let wy = 105 - h; wy < 96; wy += 7) ctx.fillRect(x + 4, wy, 12, 2);
  }
  // Near buildings
  const near = camX * 0.5;
  const colors = ['#a83c1c', '#7c7c7c', '#ac7c00', '#6c4c2c', '#8c3c5c'];
  for (let k = Math.floor(near / 60) - 1; k < (near + W) / 60 + 1; k++) {
    const h = 40 + (hash(k, 21) % 50);
    const x = Math.round(k * 60 - near);
    const top = 124 - h;
    ctx.fillStyle = colors[hash(k, 22) % colors.length];
    ctx.fillRect(x, top, 56, LANE_H - top);
    ctx.fillStyle = C.black;
    ctx.fillRect(x, top, 56, 2);
    for (let wy = top + 6; wy < 124; wy += 10) {
      for (let wx = x + 5; wx < x + 50; wx += 9) {
        ctx.fillStyle = hash(k, wx - x, wy - top) % 4 === 0 ? '#fce0a8' : '#202030';
        ctx.fillRect(wx, wy, 5, 6);
      }
    }
  }
}

/** The sewers behind the bottom lane, from screen row y0 down. */
function drawTunnelBack(ctx, W, camX, time, y0) {
  const h = H - y0;
  ctx.fillStyle = '#0c0c1c';
  ctx.fillRect(0, y0, W, h);
  const off = camX * 0.5;
  ctx.fillStyle = '#16162c';
  for (let y = 0; y < h; y += 12) {
    ctx.fillRect(0, y0 + y, W, 1);
    const shift = (y / 12) % 2 ? 12 : 0;
    for (let x = -((off + shift) % 24); x < W; x += 24) ctx.fillRect(Math.round(x), y0 + y, 1, 12);
  }
  // Pipes
  const po = camX * 0.75;
  for (const [y, color] of [[y0 + 38, '#3c3c3c'], [y0 + 50, '#2c4c2c']]) {
    ctx.fillStyle = color;
    ctx.fillRect(0, y, W, 5);
    ctx.fillStyle = '#5c5c5c';
    ctx.fillRect(0, y, W, 1);
    for (let x = -(po % 64); x < W; x += 64) ctx.fillRect(Math.round(x), y - 1, 4, 7);
  }
  // Dim green lamps
  for (let k = Math.floor(po / 128) - 1; k < (po + W) / 128 + 1; k++) {
    const x = Math.round(k * 128 - po + 40);
    const on = (Math.floor(time * 3) + k) % 7 !== 0;
    ctx.fillStyle = on ? C.lime : C.darkGreen;
    ctx.fillRect(x, y0 + 62, 4, 3);
    if (on) {
      ctx.fillStyle = 'rgba(88,216,84,0.12)';
      ctx.fillRect(x - 10, y0 + 65, 24, 36);
    }
  }
}

function drawLairBack(ctx, g, camX) {
  const W = g.W;
  ctx.fillStyle = '#140a24';
  ctx.fillRect(0, 0, W, H);
  // The broadcast screen everyone has been watching.
  const cx = Math.round((ARENA_COLS / 2) * TILE - camX);
  const top = 30;
  ctx.fillStyle = '#3c3c3c';
  ctx.fillRect(cx - 80, top, 160, 100);
  ctx.fillStyle = '#081008';
  ctx.fillRect(cx - 76, top + 4, 152, 92);
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? '#1c3c1c' : '#0c200c';
    ctx.fillRect(cx - 76 + Math.floor(Math.random() * 150), top + 4 + Math.floor(Math.random() * 90), 2, 1);
  }
  ctx.fillStyle = C.white;
  ctx.fillRect(cx - 24, top + 24, 48, 18);
  ctx.fillRect(cx - 30, top + 29, 60, 8);
  ctx.fillStyle = C.green;
  ctx.fillRect(cx - 8, top + 24, 16, 18);
  ctx.fillStyle = C.black;
  ctx.fillRect(cx - 1, top + 25, 2, 16);
  if (Math.floor(g.time * 2) % 2) drawText(ctx, 'OBEY', cx, top + 60, C.white, 3, 'center');
  // Pillars
  ctx.fillStyle = '#241848';
  for (const x of [4, 13, 27, 36]) ctx.fillRect(Math.round(x * TILE - camX), 0, 10, H);
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
    ctx.fillStyle = '#3c2878';
    ctx.fillRect(x, y - 64, 56, 64);
    ctx.fillStyle = '#6844fc';
    ctx.fillRect(x + 4, y - 60, 48, 60);
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 12, y - 48, 32, 48);
    drawText(ctx, '>>>', x + 28, y - 56, Math.floor(g.time * 4) % 2 ? C.lime : C.green, 1, 'center');
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
  ctx.fillStyle = C.darkGray;
  ctx.fillRect(x + 16, y + h, 3, LANE_H - y - h);
  ctx.fillRect(x + w - 19, y + h, 3, LANE_H - y - h);
  ctx.fillRect(x, y, w, h);
  const bg = ['#d82800', '#0058f8', '#f87800', '#6844fc', '#00a844'][hash(b.c, 9) % 5];
  ctx.fillStyle = truth ? C.white : bg;
  ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
  const text = truth ? b.truth : b.ad;
  const color = truth ? C.black : C.white;
  let scale = 2;
  let lines = fitLines(text, 10);
  if (lines.length > 2 || lines.some((l) => l.length > 11)) {
    scale = 1;
    lines = fitLines(text, 21);
  }
  const lh = 7 * scale;
  const top = y + h / 2 - (lines.length * lh - 2 * scale) / 2;
  lines.forEach((l, i) => drawText(ctx, l, x + w / 2, top + i * lh, color, scale, 'center'));
  if (!truth) {
    // A little sparkle so the ads look extra appealing.
    ctx.fillStyle = C.yellow;
    if (Math.floor(time * 3 + b.c) % 4 === 0) ctx.fillRect(x + 8, y + 7, 2, 2);
  }
}

function drawChurch(ctx, cx, groundY) {
  const x = Math.round(cx - 30);
  const top = groundY - 62;
  ctx.fillStyle = '#9c9c9c';
  ctx.fillRect(x, top + 14, 60, 48);
  ctx.fillRect(x + 22, top, 16, 14);
  ctx.fillStyle = C.white;
  ctx.fillRect(x + 29, top - 10, 2, 10);
  ctx.fillRect(x + 26, top - 7, 8, 2);
  ctx.fillStyle = '#6c4c2c';
  ctx.fillRect(x + 22, top + 40, 16, 22);
  ctx.fillStyle = '#5c94fc';
  ctx.fillRect(x + 6, top + 24, 8, 12);
  ctx.fillRect(x + 46, top + 24, 8, 12);
  drawText(ctx, 'CHURCH', x + 30, top + 17, C.darkGray, 1, 'center');
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
      ctx.drawImage(tileSprite(kind, t, top, frame), c * TILE, r * TILE);
    }
  }
  if (area.kind === 'street') {
    // A dark seam where the city's ground meets the sewer roof.
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(c0 * TILE, LANE_H, (c1 - c0 + 1) * TILE, 2);
  }
}

/** Purple rings where the player left and arrived through a portal. */
function drawPortalFx(ctx, g) {
  for (const f of g.portalFx) {
    const k = f.t / 0.5;
    const rx = Math.round(4 + k * 14);
    const ry = Math.round(10 + k * 6);
    ctx.fillStyle = k < 0.5 ? '#c8b8fc' : '#6844fc';
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + g.time * 6;
      ctx.fillRect(Math.round(f.x + Math.cos(a) * rx), Math.round(f.y + Math.sin(a) * ry), 2, 2);
    }
  }
}

// ---------- Things ----------

function drawPickups(ctx, g, truthLayer) {
  const bob = Math.round(Math.sin(g.time * 4) * 1.5);
  if (!truthLayer && g.area.kind === 'street' && !g.glasses.taken) {
    const { x, y } = g.area.glasses;
    ctx.fillStyle = C.tan;
    ctx.fillRect(x - 7, y - 8, 14, 8);
    ctx.fillStyle = C.brown;
    ctx.fillRect(x - 7, y - 8, 14, 1);
    ctx.fillRect(x - 1, y - 8, 2, 8);
    ctx.drawImage(icon('shades', C.black), x - 5, y - 13 + bob);
    if (Math.floor(g.time * 4) % 2) {
      ctx.fillStyle = C.white;
      ctx.fillRect(x + 4, y - 16 + bob, 1, 3);
      ctx.fillRect(x + 3, y - 15 + bob, 3, 1);
    }
  }
  for (const k of g.pickups) {
    if (k.taken || k.hidden !== truthLayer) continue;
    if (k.hidden && !g.glasses.on) continue;
    const x = Math.round(k.x - 5);
    const y = Math.round(k.y - 12 + bob);
    if (k.hidden) {
      ctx.fillStyle = 'rgba(88,216,84,0.35)';
      ctx.fillRect(x - 2, y - 2, 14, 14);
    }
    ctx.fillStyle = C.black;
    ctx.fillRect(x - 1, y - 1, 12, 12);
    if (k.kind === '+') {
      ctx.fillStyle = C.white;
      ctx.fillRect(x, y, 10, 10);
      ctx.drawImage(icon('heart', C.red), x + 1, y + 2);
    } else if (k.kind === 'H') {
      ctx.fillStyle = C.white;
      ctx.fillRect(x, y, 10, 10);
      ctx.drawImage(icon('hat', C.yellow), x + 1, y + 3);
    } else {
      ctx.fillStyle = k.kind === 'C' ? '#00a8a8' : k.kind === 'P' ? (Math.floor(g.time * 6) % 2 ? '#6844fc' : '#9878f8') : C.red;
      ctx.fillRect(x, y, 10, 10);
      drawText(ctx, k.kind, x + 4, y + 3, C.white);
    }
  }
}

function poseOf(a) {
  if (!a.onGround) return 'jump';
  if (Math.abs(a.vx) > 1) return Math.floor(a.anim * 8) % 2 ? 'walk1' : 'walk2';
  return 'stand';
}

function drawActor(ctx, g, a, truthLayer) {
  if (a.type === 'boss') return drawBoss(ctx, g, a);
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
  const sprite = personSprite(kind, a.look, poseOf(a), flip);
  const x = Math.round(a.x - 6);
  const y = Math.round(a.y - 22);
  if (kind === 'lizard') {
    // Tail
    ctx.fillStyle = C.darkGreen;
    const tx = flip ? x + 10 : x - 2;
    ctx.fillRect(tx, y + 16, 4, 2);
    ctx.fillRect(flip ? tx + 3 : tx - 1, y + 18, 2, 2);
  }
  if (a.flash > 0) ctx.filter = 'brightness(4)';
  ctx.drawImage(sprite, x, y);
  ctx.filter = 'none';
  if (a.carrier && (a.revealed || truthLayer)) {
    // The portal device, glowing in its hand.
    ctx.fillStyle = Math.floor(g.time * 8) % 2 ? '#9878f8' : '#6844fc';
    ctx.fillRect(flip ? x - 1 : x + 10, y + 10, 4, 4);
    ctx.fillStyle = C.white;
    ctx.fillRect(flip ? x : x + 11, y + 11, 2, 2);
  }
  if (truthLayer && !a.revealed) {
    // Corner brackets mark the ones still pretending.
    ctx.fillStyle = a.carrier ? '#9878f8' : C.lime;
    ctx.fillRect(x - 2, y - 2, 3, 1);
    ctx.fillRect(x - 2, y - 2, 1, 3);
    ctx.fillRect(x + 11, y - 2, 3, 1);
    ctx.fillRect(x + 13, y - 2, 1, 3);
  }
  if (a.type === 'gunner' && (a.revealed || truthLayer)) {
    // Ray gun
    ctx.fillStyle = C.lightGray;
    const gx = flip ? x - 3 : x + 9;
    ctx.fillRect(gx, y + 11, 6, 2);
    ctx.fillStyle = '#f878f8';
    ctx.fillRect(flip ? gx : gx + 5, y + 11, 1, 2);
  }
}

function drawBoss(ctx, g, b) {
  const x = Math.round(b.x - 18);
  const y = Math.round(b.y - 66);
  // Hover pod
  ctx.fillStyle = C.darkGray;
  ctx.fillRect(x - 6, y + 62, 48, 8);
  ctx.fillStyle = C.gray;
  ctx.fillRect(x - 6, y + 62, 48, 2);
  ctx.fillStyle = Math.floor(g.time * 10) % 2 ? C.lime : C.yellow;
  ctx.fillRect(x - 2, y + 70, 6, 3);
  ctx.fillRect(x + 32, y + 70, 6, 3);
  // Antenna
  ctx.fillStyle = C.lightGray;
  ctx.fillRect(x + 40, y + 30, 2, 32);
  ctx.fillStyle = Math.floor(g.time * 3) % 2 ? C.red : C.darkRed;
  ctx.fillRect(x + 39, y + 27, 4, 4);
  if (b.dead && Math.floor(g.time * 20) % 2) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(3, 3);
  ctx.drawImage(bossSprite(b.flash > 0), 0, 0);
  ctx.restore();
}

function drawPlayer(ctx, g) {
  const p = g.player;
  if (!p) return;
  if (p.inv > 0 && g.mode === 'play' && Math.floor(g.time * 20) % 2) return;
  const flip = p.face < 0;
  const pose = p.crouch ? 'crouch' : poseOf({ onGround: p.onGround, vx: p.vx, anim: p.anim });
  const sprite = playerSprite(pose, g.glasses.on, flip);
  const x = Math.round(p.x - 6);
  const y = Math.round(p.y - sprite.height);
  ctx.drawImage(sprite, x, y);
  if (g.armor) {
    ctx.fillStyle = C.white;
    ctx.fillRect(x + (flip ? 5 : 4), y, 3, 1);
  }
  // Arm and shotgun along the aim direction.
  const sx = p.x;
  const sy = p.crouch ? p.y - 8 : p.y - 13;
  for (let i = 0; i <= 10; i++) {
    const px = Math.round(sx + p.aim.x * i);
    const py = Math.round(sy + p.aim.y * i);
    ctx.fillStyle = i < 3 ? C.orange : i < 6 ? C.brown : C.darkGray;
    ctx.fillRect(px, py, 1, 2);
  }
  if (p.firing > 0) {
    ctx.fillStyle = C.yellow;
    ctx.fillRect(Math.round(sx + p.aim.x * 12) - 1, Math.round(sy + p.aim.y * 12) - 1, 3, 3);
  }
}

function drawBullets(ctx, g) {
  for (const b of g.bullets) {
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    if (b.kind === 'pellet') {
      ctx.fillStyle = C.yellow;
      ctx.fillRect(x - 1, y - 1, 2, 2);
    } else if (b.kind === 'nail') {
      ctx.fillStyle = C.lightGray;
      ctx.fillRect(x - 1, y, 3, 1);
    } else if (b.kind === 'flame') {
      ctx.fillStyle = b.life > 0.2 ? C.yellow : b.life > 0.1 ? C.orange : C.red;
      ctx.fillRect(x - 1, y - 1, 3, 3);
    } else {
      ctx.fillStyle = C.white;
      ctx.fillRect(x - 2, y - 1, 4, 3);
      ctx.fillStyle = C.yellow;
      ctx.fillRect(x - 1, y, 2, 1);
    }
  }
}

function drawShots(ctx, g) {
  const pulse = Math.floor(g.time * 12) % 2;
  for (const s of g.shots) {
    const x = Math.round(s.x);
    const y = Math.round(s.y);
    const r = s.r;
    ctx.fillStyle = pulse ? '#f878f8' : '#d800cc';
    ctx.fillRect(x - r, y - r + 1, r * 2, r * 2 - 2);
    ctx.fillRect(x - r + 1, y - r, r * 2 - 2, r * 2);
    ctx.fillStyle = C.white;
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }
}

function drawParticles(ctx, g) {
  for (const q of g.particles) {
    ctx.fillStyle = q.color;
    ctx.fillRect(Math.round(q.x), Math.round(q.y), q.size, q.size);
  }
}

// ---------- HUD and screens ----------

function drawHud(ctx, g) {
  const W = g.W;
  for (let i = 0; i < 4; i++) {
    ctx.drawImage(i < g.hearts ? icon('heart', C.red) : icon('heartEmpty', C.white), 4 + i * 9, 4);
  }
  if (g.armor) ctx.drawImage(icon('hat', C.yellow), 42, 5);

  const gl = g.glasses;
  if (gl.have) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(3, 12, 48, 7);
    ctx.drawImage(icon('shades', gl.on ? C.lime : C.white), 4, 14);
    ctx.fillStyle = C.darkGray;
    ctx.fillRect(15, 14, 32, 3);
    ctx.fillStyle = gl.locked ? C.red : gl.on ? C.lime : C.white;
    ctx.fillRect(15, 14, Math.round(32 * gl.meter), 3);
    if (gl.contacts) drawText(ctx, 'C', 49, 13, '#00e8e8');
  } else if (g.area.kind === 'street' && Math.floor(g.time * 2) % 2) {
    drawTextOutlined(ctx, 'FIND THE SHADES', 4, 14, C.yellow);
  }
  const pt = g.portal;
  if (pt.have && g.area.kind === 'street') {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(3, 21, 48, 7);
    const ready = pt.cd <= 0;
    ctx.fillStyle = ready ? '#9878f8' : C.darkGray;
    ctx.fillRect(4, 22, 9, 5);
    ctx.fillStyle = C.black;
    ctx.fillRect(6, 23, 5, 3);
    drawText(ctx, ready ? 'PORTAL' : 'CHARGING', 15, 22, ready ? '#c8b8fc' : C.gray);
  }

  const part = { street: 1, boss: 2 }[g.areaKey];
  drawTextOutlined(ctx, `STAGE ${g.stageNum}-${part}`, W / 2, 4, C.white, 1, 'center');
  drawTextOutlined(ctx, String(g.score).padStart(7, '0'), W - 20, 4, C.white, 1, 'right');
  drawTextOutlined(ctx, WEAPON_INFO[g.weapon].name, W - 20, 11, C.yellow, 1, 'right');

  // Pause button
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(W - 16, 2, 13, 11);
  ctx.fillStyle = C.white;
  ctx.fillRect(W - 12, 4, 2, 7);
  ctx.fillRect(W - 8, 4, 2, 7);
  g.pauseRect = { x: W - 24, y: 0, w: 24, h: 18 };

  const b = g.boss;
  if (b && !b.dead) {
    drawTextOutlined(ctx, b.name, W / 2, 13, C.lime, 1, 'center');
    ctx.fillStyle = C.black;
    ctx.fillRect(W / 2 - 51, 20, 102, 5);
    ctx.fillStyle = C.red;
    ctx.fillRect(W / 2 - 50, 21, Math.round((100 * Math.max(0, b.hp)) / b.maxHp), 3);
  }
}

function drawBanner(ctx, g) {
  const { title, sub, t } = g.banner;
  if (t < 0.3 && Math.floor(t * 20) % 2) return;
  const W = g.W;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 52, W, sub ? 30 : 20);
  drawTextOutlined(ctx, title, W / 2, 56, C.white, 2, 'center');
  if (sub) drawText(ctx, sub, W / 2, 72, C.yellow, 1, 'center');
}

function drawMenu(ctx, g, top) {
  const m = g.menu;
  if (!m) return;
  const W = g.W;
  const bw = 112;
  const bh = 14;
  m.items.forEach((item, i) => {
    const label = typeof item.label === 'function' ? item.label() : item.label;
    const x = Math.round(W / 2 - bw / 2);
    const y = top + i * (bh + 4);
    const sel = i === m.sel;
    ctx.fillStyle = C.black;
    ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = sel ? C.yellow : C.gray;
    ctx.fillRect(x, y, bw, 1);
    ctx.fillRect(x, y + bh - 1, bw, 1);
    ctx.fillRect(x, y, 1, bh);
    ctx.fillRect(x + bw - 1, y, 1, bh);
    drawText(ctx, label, W / 2, y + 5, sel ? C.yellow : C.white, 1, 'center');
    if (sel) drawText(ctx, '>', x + 5, y + 5, C.yellow);
    g.menuRects.push({ x, y, w: bw, h: bh, index: i });
  });
}

function dim(ctx, g) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, g.W, H);
}

function drawPaused(ctx, g) {
  dim(ctx, g);
  drawTextOutlined(ctx, 'PAUSED', g.W / 2, 70, C.white, 3, 'center');
  drawMenu(ctx, g, 110);
}

function drawGameOver(ctx, g) {
  dim(ctx, g);
  drawTextOutlined(ctx, 'GAME OVER', g.W / 2, 56, C.red, 3, 'center');
  drawText(ctx, `STAGE ${g.stageNum}   SCORE ${g.score}`, g.W / 2, 82, C.white, 1, 'center');
  drawText(ctx, `BEST: STAGE ${g.save.bestStage}   SCORE ${g.save.bestScore}`, g.W / 2, 92, C.lightGray, 1, 'center');
  drawText(ctx, 'THEY LIVE. WE SLEEP.', g.W / 2, 104, C.lime, 1, 'center');
  drawMenu(ctx, g, 122);
}

function drawClear(ctx, g) {
  dim(ctx, g);
  drawTextOutlined(ctx, `STAGE ${g.stageNum} CLEAR!`, g.W / 2, 58, C.yellow, 2, 'center');
  const s = g.stageStats;
  const rows = [
    ['LIZARDS EXPOSED', s.lizards],
    ['INNOCENTS HIT', s.innocents],
    ['STAGE BONUS', g.clearInfo.bonus],
    ['SCORE', g.score],
  ];
  rows.forEach(([label, value], i) => {
    drawText(ctx, label, g.W / 2 - 60, 82 + i * 10, C.white);
    drawText(ctx, String(value), g.W / 2 + 60, 82 + i * 10, C.white, 1, 'right');
  });
  drawMenu(ctx, g, 132);
}

function drawTitle(ctx, g, usingTouch) {
  const W = g.W;
  const cam = g.time * 12;
  // The two worlds, one above the other, like in the game.
  drawCitySky(ctx, W, cam, g.time);
  drawTunnelBack(ctx, W, cam, g.time, LANE_H + 16);
  ctx.fillStyle = '#5c4020';
  ctx.fillRect(0, LANE_H - 20, W, 36);
  ctx.fillStyle = C.lightGray;
  ctx.fillRect(0, LANE_H - 20, W, 5);
  ctx.fillStyle = '#2c2c48';
  ctx.fillRect(0, LANE_H + 8, W, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);

  // A billboard that flickers between the ad and the truth.
  const truth = Math.floor(g.time / 1.6) % 2 === 1 && Math.random() > 0.08;
  ctx.save();
  ctx.translate(Math.round(W / 2 - 48), 12);
  drawBillboard(ctx, { c: 0, r: 0, w: 6, h: 3, ad: 'CONSUME?', truth: 'OBEY' }, truth, g.time);
  ctx.restore();

  drawTextOutlined(ctx, 'THEY LIVE', W / 2 + 2, 82, C.darkRed, 5, 'center');
  drawTextOutlined(ctx, 'THEY LIVE', W / 2, 80, C.white, 5, 'center');
  drawText(ctx, 'PUT ON THE SHADES. SEE THE TRUTH.', W / 2, 116, C.yellow, 1, 'center');
  drawText(ctx, 'THE LOOT IS BELOW. FIND THE PORTAL.', W / 2, 126, '#c8b8fc', 1, 'center');

  if (g.save.bestStage > 0) {
    drawText(ctx, `BEST: STAGE ${g.save.bestStage}   SCORE ${g.save.bestScore}`, W / 2, H - 30, C.white, 1, 'center');
  }
  if (!usingTouch) drawText(ctx, 'ARROWS MOVE  Z JUMP  X FIRE  G SHADES  V PORTAL  P PAUSE', W / 2, H - 16, C.lightGray, 1, 'center');
}
