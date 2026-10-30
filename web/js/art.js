// Vector art: characters built from jointed, shaded shapes, the Moloch
// idol, and the level tiles. Everything is drawn with canvas paths in world
// pixels, so it stays sharp at any screen resolution.

// ---------- Colors ----------

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Lighter (t > 0) or darker (t < 0) version of a hex color, as CSS. */
export function tone(hex, t) {
  const c = rgb(hex);
  const to = t >= 0 ? [255, 250, 240] : [12, 8, 20];
  const k = Math.abs(t);
  return `rgb(${c.map((v, i) => Math.round(v + (to[i] - v) * k)).join(',')})`;
}

export function alpha(hex, a) {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Vertical gradient from a lighter to a darker version of a color. */
function vgrad(ctx, y0, y1, hex, light = 0.25, dark = -0.25) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, tone(hex, light));
  g.addColorStop(1, tone(hex, dark));
  return g;
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const OUTLINE = 'rgba(16,10,24,0.85)';

/** A capsule from a to b: dark outline, color, then a soft highlight. */
function capsule(ctx, ax, ay, bx, by, w, color) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = w + 0.9;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = w * 0.35;
  ctx.beginPath();
  ctx.moveTo(ax - w * 0.18, ay - w * 0.15);
  ctx.lineTo(bx - w * 0.18, by - w * 0.15);
  ctx.stroke();
}

/** Fills the current path with a fill and a dark outline. */
function fillOutlined(ctx, fill, width = 0.8) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

/** A two-bone limb from a joint at (x, y): angles from straight down, forward positive. */
function limb(ctx, x, y, a1, l1, a2, l2, w1, w2, color, end) {
  const kx = x + Math.sin(a1) * l1;
  const ky = y + Math.cos(a1) * l1;
  const ex = kx + Math.sin(a1 + a2) * l2;
  const ey = ky + Math.cos(a1 + a2) * l2;
  capsule(ctx, x, y, kx, ky, w1, color);
  capsule(ctx, kx, ky, ex, ey, w2, color);
  if (end) end(ex, ey, a1 + a2);
  return { kx, ky, ex, ey };
}

/** Two-bone reach from (sx, sy) toward (tx, ty), elbow bending downward. */
function reach(ctx, sx, sy, tx, ty, l1, l2, w1, w2, color) {
  const dx = tx - sx;
  const dy = ty - sy;
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01);
  const base = Math.atan2(dy, dx);
  const cos = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const off = Math.acos(Math.max(-1, Math.min(1, cos)));
  const a = base + off;
  const ex = sx + Math.cos(a) * l1;
  const ey = sy + Math.sin(a) * l1;
  const hx = sx + Math.cos(base) * d;
  const hy = sy + Math.sin(base) * d;
  capsule(ctx, sx, sy, ex, ey, w1, color);
  capsule(ctx, ex, ey, hx, hy, w2, color);
  return { hx, hy };
}

function hand(ctx, x, y, color, r = 1.05) {
  circle(ctx, x, y, r);
  fillOutlined(ctx, color, 0.6);
}

function shoe(ctx, x, y, a, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-a * 0.3);
  roundRect(ctx, -1.3, -1, 3.6, 2, 0.9);
  fillOutlined(ctx, color, 0.6);
  ctx.restore();
}

// ---------- Heads ----------

function humanHead(ctx, s, cx, cy) {
  const r = 2.9;
  // Hair behind
  if (s.longHair) {
    roundRect(ctx, cx - 3.4, cy - 2.6, 4.2, 6.6, 1.6);
    fillOutlined(ctx, s.hair, 0.6);
  }
  circle(ctx, cx, cy, r);
  const g = ctx.createRadialGradient(cx + 0.9, cy - 1, 0.5, cx, cy, r);
  g.addColorStop(0, tone(s.skin, 0.25));
  g.addColorStop(1, tone(s.skin, -0.15));
  fillOutlined(ctx, g);
  // Nose, ear, eye, mouth
  ctx.fillStyle = tone(s.skin, -0.12);
  circle(ctx, cx + r - 0.15, cy + 0.3, 0.55);
  ctx.fill();
  circle(ctx, cx - 0.9, cy + 0.2, 0.6);
  ctx.fill();
  if (s.shades) {
    roundRect(ctx, cx + 0.3, cy - 1.05, 2.8, 1.2, 0.4);
    ctx.fillStyle = '#0c0c14';
    ctx.fill();
    ctx.fillStyle = 'rgba(160,200,255,0.6)';
    ctx.fillRect(cx + 0.9, cy - 0.85, 0.7, 0.3);
  } else {
    ctx.fillStyle = '#1c1420';
    circle(ctx, cx + 1.45, cy - 0.45, 0.42);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    circle(ctx, cx + 1.55, cy - 0.6, 0.14);
    ctx.fill();
  }
  ctx.strokeStyle = tone(s.skin, -0.45);
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(cx + 1.0, cy + 1.6);
  ctx.lineTo(cx + 2.1, cy + 1.45);
  ctx.stroke();
  // Hair or headwear on top
  if (s.hat === 'hardhat') {
    ctx.beginPath();
    ctx.ellipse(cx + 0.1, cy - 1.2, 3.4, 2.6, 0, Math.PI, 0);
    ctx.closePath();
    fillOutlined(ctx, vgrad(ctx, cy - 4, cy - 1, '#f8c818', 0.35, -0.2));
    roundRect(ctx, cx - 3.6, cy - 1.6, 8.2, 1.1, 0.5);
    fillOutlined(ctx, '#e8b010', 0.6);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(cx + 1.2, cy - 2.9, 1.2, 0.5, -0.4, 0, Math.PI * 2);
    ctx.fill();
    if (s.armor) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 0.4, cy - 3.6, 0.8, 2.2);
    }
  } else if (s.hat === 'cap') {
    ctx.beginPath();
    ctx.ellipse(cx, cy - 1.2, 3.1, 2.2, 0, Math.PI, 0);
    ctx.closePath();
    fillOutlined(ctx, vgrad(ctx, cy - 3.5, cy - 1, s.capColor, 0.2, -0.3));
    roundRect(ctx, cx, cy - 1.6, 4.4, 0.9, 0.4);
    fillOutlined(ctx, tone(s.capColor, -0.3), 0.5);
    ctx.fillStyle = '#f0c840';
    circle(ctx, cx + 0.8, cy - 2.4, 0.45);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.ellipse(cx - 0.4, cy - 1.0, 3.2, 2.3, -0.15, Math.PI * 0.95, Math.PI * 2.05);
    ctx.closePath();
    fillOutlined(ctx, vgrad(ctx, cy - 3.5, cy, s.hair, 0.2, -0.25), 0.6);
  }
  if (s.mullet) {
    ctx.beginPath();
    ctx.moveTo(cx - 2.8, cy - 0.6);
    ctx.quadraticCurveTo(cx - 4.2, cy + 2.4, cx - 2.9, cy + 4.4);
    ctx.lineTo(cx - 1.2, cy + 3.1);
    ctx.quadraticCurveTo(cx - 1.9, cy + 1.2, cx - 1.4, cy - 0.4);
    ctx.closePath();
    fillOutlined(ctx, vgrad(ctx, cy - 1, cy + 4.5, s.hair, 0.25, -0.25), 0.6);
  }
}

function lizardHead(ctx, s, cx, cy) {
  const skin = s.scales || '#3caa50';
  // Skull and long snout
  ctx.beginPath();
  ctx.moveTo(cx - 2.6, cy + 1.6);
  ctx.quadraticCurveTo(cx - 3.2, cy - 2.8, cx + 0.4, cy - 3.1);
  ctx.quadraticCurveTo(cx + 3.6, cy - 2.8, cx + 5.4, cy - 0.6);
  ctx.quadraticCurveTo(cx + 5.8, cy + 0.6, cx + 4.6, cy + 1.2);
  ctx.lineTo(cx + 0.6, cy + 2.6);
  ctx.quadraticCurveTo(cx - 1.6, cy + 3.1, cx - 2.6, cy + 1.6);
  ctx.closePath();
  const g = ctx.createLinearGradient(cx, cy - 3, cx, cy + 3);
  g.addColorStop(0, tone(skin, 0.25));
  g.addColorStop(1, tone(skin, -0.3));
  fillOutlined(ctx, g);
  // Jaw line and mouth
  ctx.strokeStyle = tone(skin, -0.55);
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(cx + 5.0, cy + 0.6);
  ctx.quadraticCurveTo(cx + 2.4, cy + 1.6, cx - 0.4, cy + 1.2);
  ctx.stroke();
  ctx.fillStyle = '#a01828';
  ctx.beginPath();
  ctx.moveTo(cx + 4.8, cy + 0.7);
  ctx.lineTo(cx + 2.0, cy + 1.5);
  ctx.lineTo(cx + 3.6, cy + 1.6);
  ctx.closePath();
  ctx.fill();
  // Scales
  ctx.fillStyle = tone(skin, -0.25);
  for (const [dx, dy] of [[-1.4, -1.6], [0.2, -2.2], [-0.6, -0.2], [1.6, -1.4], [-1.8, 0.8]]) {
    circle(ctx, cx + dx, cy + dy, 0.4);
    ctx.fill();
  }
  // Eye: yellow with a slit
  ctx.fillStyle = '#ffe030';
  ctx.beginPath();
  ctx.ellipse(cx + 1.5, cy - 1.3, 0.95, 0.75, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#100808';
  ctx.fillRect(cx + 1.35, cy - 2.0, 0.32, 1.4);
  ctx.fillStyle = '#100808';
  circle(ctx, cx + 4.6, cy - 0.7, 0.25);
  ctx.fill();
}

// ---------- Bodies ----------

/**
 * A person or lizard, origin at the feet, facing right (flip with face).
 * spec: colors and features. pose: { t, speed, air, crouch, aim, armsUp,
 * holdUp, gun: 'rifle' | 'ray' | null }.
 */
export function drawFigure(ctx, x, y, face, spec, pose) {
  const s = spec;
  ctx.save();
  ctx.translate(x, y);
  if (s.scale) ctx.scale(s.scale, s.scale);
  ctx.scale(face, 1);
  const t = pose.t || 0;
  const moving = Math.min(1, (pose.speed || 0) / 40);
  const phase = t * 11;
  const swing = Math.sin(phase) * 0.6 * moving;
  const lift = Math.max(0, Math.cos(phase)) * 0.9 * moving;
  const lift2 = Math.max(0, -Math.cos(phase)) * 0.9 * moving;
  const crouch = pose.crouch;
  const hipY = crouch ? -6.2 : -10.2;
  const bob = moving ? Math.abs(Math.sin(phase)) * 0.5 : 0;
  ctx.translate(0, -bob);

  // Soft shadow
  ctx.save();
  ctx.translate(0, bob);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 0.2, 4.6, 1.0, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const legW = s.bulky ? 2.7 : 2.4;
  const armW = s.bulky ? 2.4 : 1.9;
  const pants = s.pants;
  const shoes = s.shoes || '#2c2028';
  const legs = (front) => {
    if (s.robe) return;
    let a1;
    let a2;
    if (pose.air) {
      a1 = front ? 1.3 : 0.9;
      a2 = -2.0;
    } else if (crouch) {
      a1 = front ? 1.35 : -0.25;
      a2 = front ? -1.9 : 0.6;
    } else {
      a1 = front ? swing : -swing;
      a2 = -(front ? lift : lift2);
    }
    limb(ctx, front ? 0.5 : -0.5, hipY, a1, 5.3, a2, 5.2, legW, legW * 0.88, front ? pants : tone(pants, -0.2), (ex, ey, a) => shoe(ctx, ex, ey, a, front ? shoes : tone(shoes, -0.2)));
  };

  const shoulderY = crouch ? -10.5 : -16.5;
  const backShoulder = { x: -1.3, y: shoulderY + 0.4 };
  const frontShoulder = { x: 0.6, y: shoulderY };
  const aimA = pose.aim ? Math.atan2(pose.aim.y, Math.abs(pose.aim.x) < 0.01 ? 0.0001 : Math.abs(pose.aim.x)) : 0;
  const armColor = s.sleeves ? s.shirt : s.skin;

  // Tail (lizards)
  if (s.tail) {
    const sway = Math.sin(t * 5) * 1.2;
    ctx.beginPath();
    ctx.moveTo(-1.2, hipY - 0.6);
    ctx.quadraticCurveTo(-6, hipY + 2 + sway, -9.5, hipY + 5.5 - sway);
    ctx.quadraticCurveTo(-5.5, hipY + 3.4 + sway, -1, hipY + 1.6);
    ctx.closePath();
    fillOutlined(ctx, vgrad(ctx, hipY - 1, hipY + 6, s.scales, 0.15, -0.35));
  }

  // Back arm
  if (pose.gun === 'rifle') {
    // Hands go to the rifle; drawn after the body below.
  } else if (pose.armsUp) {
    const r = Math.sin(t * 4) * 0.2;
    limb(ctx, backShoulder.x, backShoulder.y, Math.PI - 0.5 + r, 3.8, -0.4, 3.6, armW, armW * 0.85, tone(armColor, -0.2), (ex, ey) => hand(ctx, ex, ey, tone(s.hands || s.skin, -0.2)));
  } else if (!pose.holdUp) {
    limb(ctx, backShoulder.x, backShoulder.y, swing * 0.9, 3.9, -0.35, 3.7, armW, armW * 0.85, tone(armColor, -0.2), (ex, ey) => hand(ctx, ex, ey, tone(s.hands || s.skin, -0.2)));
  }

  legs(false);
  legs(true);

  // Torso
  const sw = s.bulky ? 4.2 : 3.5;
  const ww = s.bulky ? 2.8 : 2.6;
  if (s.robe) {
    // A robe from the shoulders to the feet, swaying at the hem.
    const hem = Math.sin(t * 6) * 0.8 * (moving + 0.3);
    ctx.beginPath();
    ctx.moveTo(-sw, shoulderY + 0.4);
    ctx.lineTo(sw - 0.4, shoulderY);
    ctx.quadraticCurveTo(sw + 1.6, -5, sw + 2.2 + hem, -0.2);
    ctx.lineTo(-sw - 2.2 + hem, -0.2);
    ctx.quadraticCurveTo(-sw - 1.6, -5, -sw, shoulderY + 0.4);
    ctx.closePath();
    fillOutlined(ctx, vgrad(ctx, shoulderY, 0, s.robe, 0.2, -0.4));
    ctx.strokeStyle = tone(s.robe, -0.45);
    ctx.lineWidth = 0.4;
    for (const fx of [-1.5, 1.2]) {
      ctx.beginPath();
      ctx.moveTo(fx, shoulderY + 3);
      ctx.lineTo(fx * 1.5 + hem * 0.5, -0.6);
      ctx.stroke();
    }
    ctx.fillStyle = '#f0c840';
    circle(ctx, 0.6, shoulderY + 2.6, 0.75);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(-sw, shoulderY);
    ctx.quadraticCurveTo(0, shoulderY - 0.9, sw, shoulderY);
    ctx.lineTo(ww, hipY + 0.6);
    ctx.lineTo(-ww, hipY + 0.6);
    ctx.closePath();
    if (s.tank) {
      fillOutlined(ctx, vgrad(ctx, shoulderY, hipY, s.skin, 0.2, -0.15));
      // Tank top over the chest
      ctx.beginPath();
      ctx.moveTo(-2.2, shoulderY - 0.1);
      ctx.lineTo(-1.3, shoulderY + 2.2);
      ctx.quadraticCurveTo(0.4, shoulderY + 3.2, 1.9, shoulderY + 2.1);
      ctx.lineTo(2.6, shoulderY - 0.1);
      ctx.lineTo(sw - 0.6, shoulderY + 2.4);
      ctx.lineTo(ww, hipY + 0.6);
      ctx.lineTo(-ww, hipY + 0.6);
      ctx.lineTo(-sw + 0.6, shoulderY + 2.4);
      ctx.closePath();
      fillOutlined(ctx, vgrad(ctx, shoulderY, hipY, s.shirt, 0.1, -0.2), 0.6);
    } else {
      fillOutlined(ctx, vgrad(ctx, shoulderY, hipY, s.shirt, 0.2, -0.25));
      if (s.tie) {
        ctx.fillStyle = s.tie;
        ctx.beginPath();
        ctx.moveTo(0.3, shoulderY + 0.2);
        ctx.lineTo(1.1, shoulderY + 0.2);
        ctx.lineTo(1.0, shoulderY + 4.6);
        ctx.lineTo(0.4, shoulderY + 4.6);
        ctx.closePath();
        ctx.fill();
      }
      if (s.badge) {
        ctx.fillStyle = s.badge;
        circle(ctx, 1.4, shoulderY + 2.0, 0.55);
        ctx.fill();
      }
    }
    // Belt
    roundRect(ctx, -ww - 0.1, hipY - 0.2, ww * 2 + 0.2, 1.2, 0.3);
    fillOutlined(ctx, s.belt || '#3c2818', 0.4);
    if (s.buckle) {
      ctx.fillStyle = s.buckle;
      ctx.fillRect(0, hipY, 1.2, 0.8);
    }
  }

  // Neck and head
  const headX = 0.4;
  const headY = shoulderY - 3.2;
  if (s.head === 'lizard') lizardHead(ctx, s, headX, headY);
  else humanHead(ctx, s, headX, headY);
  if (s.robe && s.hood) {
    // Hood over the head
    ctx.beginPath();
    ctx.moveTo(-3.4, headY + 2.8);
    ctx.quadraticCurveTo(-4.4, headY - 3.6, 0.2, headY - 4.6);
    ctx.quadraticCurveTo(3.6, headY - 4.0, 3.8, headY - 1.4);
    ctx.lineTo(1.4, headY - 2.2);
    ctx.quadraticCurveTo(-1.6, headY - 1.4, -1.8, headY + 2.6);
    ctx.closePath();
    fillOutlined(ctx, vgrad(ctx, headY - 4.6, headY + 3, s.robe, 0.25, -0.35));
  }

  // Front arm and weapons
  if (pose.gun === 'rifle') {
    drawRifleArms(ctx, backShoulder, frontShoulder, aimA, armColor, s, armW);
  } else if (pose.armsUp) {
    const r = Math.sin(t * 4 + 1) * 0.2;
    limb(ctx, frontShoulder.x, frontShoulder.y, Math.PI - 0.3 + r, 3.8, 0.4, 3.6, armW, armW * 0.85, armColor, (ex, ey) => hand(ctx, ex, ey, s.hands || s.skin));
  } else if (pose.holdUp) {
    for (const sh of [backShoulder, frontShoulder]) {
      limb(ctx, sh.x, sh.y, Math.PI - 0.25, 3.8, 0.1, 3.6, armW, armW * 0.85, armColor, (ex, ey) => hand(ctx, ex, ey, s.hands || s.skin));
    }
  } else if (pose.gun === 'ray') {
    const a = Math.PI / 2 - aimA;
    limb(ctx, frontShoulder.x, frontShoulder.y, a, 3.8, 0, 3.4, armW, armW * 0.85, armColor, (ex, ey, ang) => {
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(Math.PI / 2 - ang);
      roundRect(ctx, -0.6, -1.0, 4.6, 1.6, 0.6);
      fillOutlined(ctx, vgrad(ctx, -1, 0.6, '#a8a8c0', 0.3, -0.3), 0.5);
      ctx.fillStyle = '#ff60e0';
      circle(ctx, 4.2, -0.2, 0.6);
      ctx.fill();
      ctx.restore();
      hand(ctx, ex, ey, s.hands || s.skin);
    });
  } else {
    limb(ctx, frontShoulder.x, frontShoulder.y, -swing * 0.9, 3.9, -0.35, 3.7, armW, armW * 0.85, armColor, (ex, ey) => hand(ctx, ex, ey, s.hands || s.skin));
  }
  ctx.restore();
}

/** Both hands on a rifle pointing along aimA (radians, 0 = forward). */
function drawRifleArms(ctx, back, front, aimA, armColor, s, armW) {
  const c = Math.cos(aimA);
  const sn = Math.sin(aimA);
  const at = (d, side = 0) => ({ x: front.x + c * d - sn * side, y: front.y + sn * d + c * side });
  const grip = at(3.4, 1.2);
  const fore = at(7.2, 0.9);
  // Back arm reaches the grip, behind the rifle.
  const b = reach(ctx, back.x, back.y, grip.x, grip.y, 4.0, 3.8, armW, armW * 0.85, tone(armColor, -0.15));
  hand(ctx, b.hx, b.hy, tone(s.skin, -0.15));
  // The rifle
  ctx.save();
  ctx.translate(front.x, front.y);
  ctx.rotate(aimA);
  roundRect(ctx, -1.4, -0.9, 4.6, 2.0, 0.6); // stock
  fillOutlined(ctx, vgrad(ctx, -0.9, 1.1, '#6c4428', 0.25, -0.3), 0.5);
  roundRect(ctx, 2.6, -1.1, 6.2, 2.1, 0.4); // body
  fillOutlined(ctx, vgrad(ctx, -1.1, 1.0, '#4c4c5c', 0.35, -0.3), 0.5);
  roundRect(ctx, 4.0, 0.6, 1.4, 2.4, 0.3); // magazine
  fillOutlined(ctx, '#2c2c38', 0.4);
  roundRect(ctx, 8.4, -0.55, 4.2, 1.0, 0.3); // barrel
  fillOutlined(ctx, vgrad(ctx, -0.6, 0.5, '#6c6c7c', 0.35, -0.3), 0.4);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(2.9, -0.9, 5.5, 0.35);
  ctx.restore();
  // Front arm on the foregrip, over the rifle.
  const f = reach(ctx, front.x, front.y, fore.x, fore.y, 4.2, 4.0, armW, armW * 0.85, armColor);
  hand(ctx, f.hx, f.hy, s.skin);
}

/** The hero curled into a somersault, spinning. */
export function drawHeroBall(ctx, x, y, face, spec, t) {
  ctx.save();
  ctx.translate(x, y - 11);
  ctx.rotate(t * 14 * face);
  ctx.fillStyle = 'rgba(0,0,0,0.0)';
  drawFigure(ctx, 0, 6.5, 1, { ...spec, scale: 0.85 }, { air: true, crouch: true, gun: null, t: 0 });
  ctx.restore();
}

// ---------- Moloch ----------

/** The bronze bull idol, origin at its feet. awake: bronze and fire; else stone. */
export function drawMoloch(ctx, x, y, face, awake, t, flash) {
  const metal = awake ? '#b57a3c' : '#86827a';
  const dark = awake ? '#5c3416' : '#4c4a44';
  const horn = awake ? '#efe2c0' : '#c4c0b6';
  const mat = (y0, y1) => {
    const g = ctx.createLinearGradient(-20, y0, 20, y1);
    g.addColorStop(0, tone(metal, 0.35));
    g.addColorStop(0.45, metal);
    g.addColorStop(1, dark);
    return g;
  };
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(face, 1);
  if (flash) ctx.filter = 'brightness(3)';
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 20, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Legs
  for (const lx of [-8, 8]) {
    roundRect(ctx, lx - 4.5, -22, 9, 22, 3);
    fillOutlined(ctx, mat(-22, 0), 1);
    roundRect(ctx, lx - 5.5, -4, 11, 4, 1.5);
    fillOutlined(ctx, dark, 0.8);
  }
  // Body
  ctx.beginPath();
  ctx.moveTo(-17, -48);
  ctx.quadraticCurveTo(0, -54, 17, -48);
  ctx.quadraticCurveTo(20, -30, 13, -18);
  ctx.lineTo(-13, -18);
  ctx.quadraticCurveTo(-20, -30, -17, -48);
  ctx.closePath();
  fillOutlined(ctx, mat(-54, -18), 1.2);
  // Furnace in the belly
  roundRect(ctx, -8, -40, 16, 15, 4);
  if (awake) {
    const f = ctx.createRadialGradient(0, -32, 1, 0, -32, 11);
    f.addColorStop(0, '#fff6c0');
    f.addColorStop(0.35, '#ffb030');
    f.addColorStop(0.8, '#e84010');
    f.addColorStop(1, '#601008');
    fillOutlined(ctx, f, 1.2);
    for (let i = 0; i < 4; i++) {
      const fx = -5 + i * 3.4;
      const h = 4 + Math.sin(t * 13 + i * 1.7) * 2.5;
      ctx.fillStyle = i % 2 ? 'rgba(255,240,160,0.9)' : 'rgba(255,140,40,0.8)';
      ctx.beginPath();
      ctx.moveTo(fx - 1.4, -26);
      ctx.quadraticCurveTo(fx, -26 - h * 2, fx + 1.4, -26);
      ctx.fill();
    }
  } else fillOutlined(ctx, '#24221e', 1.2);
  ctx.strokeStyle = tone(dark, -0.3);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (const gx of [-3, 3]) {
    ctx.moveTo(gx, -40);
    ctx.lineTo(gx, -25);
  }
  ctx.stroke();
  // Arms held out, palms up, the way the idol is always shown.
  for (const side of [-1, 1]) {
    capsule(ctx, side * 15, -46, side * 19, -34, 7, metal);
    capsule(ctx, side * 19, -34, side * 25, -30, 6, tone(metal, -0.1));
    ctx.beginPath();
    ctx.ellipse(side * 27, -31, 3.4, 1.8, 0, 0, Math.PI * 2);
    fillOutlined(ctx, mat(-33, -29), 0.8);
  }
  // Bull head
  ctx.beginPath();
  ctx.moveTo(-9, -52);
  ctx.quadraticCurveTo(-11, -64, 0, -66);
  ctx.quadraticCurveTo(11, -64, 9, -52);
  ctx.quadraticCurveTo(7, -45, 0, -44);
  ctx.quadraticCurveTo(-7, -45, -9, -52);
  ctx.closePath();
  fillOutlined(ctx, mat(-66, -44), 1);
  ctx.beginPath();
  ctx.ellipse(0, -47.5, 6, 3.6, 0, 0, Math.PI * 2);
  fillOutlined(ctx, tone(metal, -0.15), 0.8);
  ctx.fillStyle = awake ? '#1c0804' : '#2c2a26';
  for (const nx of [-2.2, 2.2]) {
    ctx.beginPath();
    ctx.ellipse(nx, -47.5, 1.0, 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Horns
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 7, -61);
    ctx.quadraticCurveTo(side * 18, -62, side * 19, -74);
    ctx.quadraticCurveTo(side * 14, -66, side * 7.5, -57);
    ctx.closePath();
    const hg = ctx.createLinearGradient(side * 7, -58, side * 19, -74);
    hg.addColorStop(0, tone(horn, -0.2));
    hg.addColorStop(1, tone(horn, 0.3));
    fillOutlined(ctx, hg, 0.9);
  }
  // Eyes
  for (const ex of [-4.2, 4.2]) {
    ctx.beginPath();
    ctx.ellipse(ex, -57, 1.8, 1.1, ex > 0 ? -0.3 : 0.3, 0, Math.PI * 2);
    ctx.fillStyle = awake ? '#ff3a18' : '#3c3a36';
    ctx.fill();
    if (awake) {
      ctx.fillStyle = '#fff0b0';
      circle(ctx, ex, -57, 0.5);
      ctx.fill();
    }
  }
  // Highlights
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-14, -46);
  ctx.quadraticCurveTo(-15, -36, -11, -24);
  ctx.stroke();
  ctx.restore();
}

// ---------- Tiles ----------

/** Small deterministic noise. */
function noise(...v) {
  let h = 2166136261;
  for (const n of v) h = Math.imul(h ^ n, 16777619);
  h ^= h >>> 13;
  return ((Math.imul(h, 0x5bd1e995) >>> 0) % 1000) / 1000;
}

/**
 * Draws one 16 x 16 tile in tile units.
 * kind: 'city' | 'tunnel' | 'boss'. tile: 1 solid, 2 one-way, 3 crate, 4 sludge.
 */
export function drawTile(ctx, kind, tile, top, v, frame) {
  if (tile === 1) {
    if (kind === 'city') {
      ctx.fillStyle = vgrad(ctx, 0, 16, '#6b4a2e', 0.05, -0.25);
      ctx.fillRect(0, 0, 16, 16);
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = noise(v, i, 3) < 0.5 ? 'rgba(40,24,10,0.35)' : 'rgba(160,120,80,0.3)';
        ctx.beginPath();
        ctx.ellipse(noise(v, i, 1) * 16, noise(v, i, 2) * 16, 0.4 + noise(v, i, 4) * 0.8, 0.3 + noise(v, i, 5) * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (top) {
        ctx.fillStyle = vgrad(ctx, 0, 5.5, '#b8b8c2', 0.3, -0.15);
        ctx.fillRect(0, 0, 16, 5.5);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillRect(0, 0, 16, 0.5);
        ctx.fillStyle = 'rgba(40,40,56,0.55)';
        ctx.fillRect(0, 4.6, 16, 0.9);
        ctx.fillRect(15.6, 0.5, 0.4, 4.1);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(0, 5.5, 16, 1.2);
      }
    } else if (kind === 'tunnel') {
      ctx.fillStyle = '#12121e';
      ctx.fillRect(0, 0, 16, 16);
      const tones = ['#3a3a58', '#34344e', '#404062'];
      for (const [x, y, w, h] of [[0, 0, 8, 8], [8, 0, 8, 8], [-4, 8, 8, 8], [4, 8, 8, 8], [12, 8, 8, 8]]) {
        const c = tones[Math.floor(noise(v, x, y) * 3)];
        roundRect(ctx, x + 0.3, y + 0.3, w - 0.6, h - 0.6, 1.2);
        ctx.fillStyle = vgrad(ctx, y, y + h, c, 0.25, -0.35);
        ctx.fill();
      }
      if (top) {
        ctx.fillStyle = vgrad(ctx, 0, 3, '#3c8c3c', 0.3, -0.3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(16, 0);
        for (let x = 16; x >= 0; x -= 2) ctx.lineTo(x, 2 + noise(v, x) * 3);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#1c0c08';
      ctx.fillRect(0, 0, 16, 16);
      roundRect(ctx, 0.4, 0.4, 7.4, 7.6, 1);
      ctx.fillStyle = vgrad(ctx, 0, 8, v % 2 ? '#4c2c24' : '#44281f', 0.2, -0.3);
      ctx.fill();
      roundRect(ctx, 8.2, 0.4, 7.4, 7.6, 1);
      ctx.fillStyle = vgrad(ctx, 0, 8, v % 2 ? '#44281f' : '#4c2c24', 0.2, -0.3);
      ctx.fill();
      roundRect(ctx, 0.4, 8.4, 15.2, 7.2, 1);
      ctx.fillStyle = vgrad(ctx, 8, 16, '#3c241c', 0.2, -0.3);
      ctx.fill();
      if (top) {
        ctx.fillStyle = vgrad(ctx, 0, 1.8, '#d8943c', 0.4, -0.2);
        ctx.fillRect(0, 0, 16, 1.8);
      }
    }
  } else if (tile === 2) {
    if (kind === 'city') {
      ctx.fillStyle = vgrad(ctx, 0, 2.6, '#e8701c', 0.35, -0.25);
      ctx.fillRect(0, 0, 16, 2.6);
      ctx.strokeStyle = '#a84c14';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (let x = 0; x < 16; x += 8) {
        ctx.moveTo(x, 2.6);
        ctx.lineTo(x + 4, 7);
        ctx.lineTo(x + 8, 2.6);
      }
      ctx.moveTo(0, 7);
      ctx.lineTo(16, 7);
      ctx.stroke();
      ctx.fillStyle = '#ffd0a0';
      for (let x = 2; x < 16; x += 4) {
        ctx.beginPath();
        ctx.arc(x, 1.3, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = vgrad(ctx, 0, 3, '#7c7c8c', 0.35, -0.3);
      ctx.fillRect(0, 0, 16, 3);
      ctx.fillStyle = '#1c1c24';
      for (let x = 1; x < 16; x += 2.5) ctx.fillRect(x, 0.9, 1.2, 1.2);
      ctx.fillStyle = '#4c4c58';
      ctx.fillRect(3, 3, 1, 5);
      ctx.fillRect(12, 3, 1, 5);
    }
  } else if (tile === 3) {
    roundRect(ctx, 0.3, 0.3, 15.4, 15.4, 0.8);
    ctx.fillStyle = vgrad(ctx, 0, 16, '#b8823c', 0.2, -0.3);
    ctx.fill();
    ctx.strokeStyle = '#6c441c';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.beginPath();
    for (const y of [5.3, 10.6]) {
      ctx.moveTo(0.5, y);
      ctx.lineTo(15.5, y);
    }
    ctx.moveTo(1.5, 1.5);
    ctx.lineTo(14.5, 14.5);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(80,48,16,0.35)';
    ctx.lineWidth = 0.25;
    for (let i = 0; i < 6; i++) {
      const y = 1 + noise(v, i) * 14;
      ctx.beginPath();
      ctx.moveTo(1, y);
      ctx.quadraticCurveTo(8, y + noise(v, i, 1) * 2 - 1, 15, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#d8d8e0';
    for (const [x, y] of [[2, 2], [14, 2], [2, 14], [14, 14]]) {
      ctx.beginPath();
      ctx.arc(x, y, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (tile === 4) {
    const cement = kind === 'city';
    const g = ctx.createLinearGradient(0, 0, 0, 16);
    g.addColorStop(0, cement ? '#b4b4bc' : '#58e048');
    g.addColorStop(0.3, cement ? '#8c8c94' : '#1c9c2c');
    g.addColorStop(1, cement ? '#5c5c64' : '#0c4010');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
    ctx.strokeStyle = cement ? 'rgba(255,255,255,0.6)' : '#b8ff90';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let x = 0; x <= 16; x += 0.5) {
      const y = 2 + Math.sin((x + frame * 3) * 0.6) * 0.9;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (!cement) {
      for (let i = 0; i < 3; i++) {
        const by = 15 - ((frame * 2 + i * 5) % 13);
        ctx.fillStyle = 'rgba(200,255,160,0.6)';
        ctx.beginPath();
        ctx.arc(3 + noise(i, 9) * 10, by, 0.6 + noise(i, 8) * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// ---------- Small things ----------

export function drawHeart(ctx, x, y, size, color, empty = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 10, size / 10);
  ctx.beginPath();
  ctx.moveTo(5, 9);
  ctx.bezierCurveTo(-1, 5, 0, 0, 2.6, 0.4);
  ctx.bezierCurveTo(4, 0.6, 5, 2, 5, 2.6);
  ctx.bezierCurveTo(5, 2, 6, 0.6, 7.4, 0.4);
  ctx.bezierCurveTo(10, 0, 11, 5, 5, 9);
  ctx.closePath();
  if (empty) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, 9);
    g.addColorStop(0, tone(color, 0.35));
    g.addColorStop(1, tone(color, -0.25));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(3, 2.4, 1.1, 0.7, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawHardHat(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 10, size / 10);
  ctx.beginPath();
  ctx.ellipse(5, 6, 4, 4, 0, Math.PI, 0);
  ctx.closePath();
  fillOutlined(ctx, vgrad(ctx, 2, 6, '#f8c818', 0.35, -0.2), 0.8);
  roundRect(ctx, 0, 5.4, 10, 1.6, 0.7);
  fillOutlined(ctx, '#e0a810', 0.6);
  ctx.restore();
}

export function drawShades(ctx, x, y, w, color = '#101018') {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 10, w / 10);
  ctx.fillStyle = color;
  roundRect(ctx, 0, 0, 4.4, 2.6, 1);
  ctx.fill();
  roundRect(ctx, 5.6, 0, 4.4, 2.6, 1);
  ctx.fill();
  ctx.fillRect(4, 0.4, 2, 0.6);
  ctx.fillStyle = 'rgba(180,210,255,0.6)';
  ctx.fillRect(0.8, 0.5, 1.4, 0.5);
  ctx.fillRect(6.4, 0.5, 1.4, 0.5);
  ctx.restore();
}
