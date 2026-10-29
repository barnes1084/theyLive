// Keyboard and touch input, merged into one set of buttons:
// left, right, up, down, jump, fire, tackle, glasses, portal, lock, pause,
// plus a few that only touch gestures produce (glassesOn, glassesOff, drop).
// `held` is what is down right now; `pressed` is what went down this frame.
//
// Touch uses swipes instead of on-screen buttons, so nothing covers the game:
//   left half:  swipe right/left = keep walking that way, swipe up = jump,
//               swipe down = drop through scaffolding, tap = stop,
//               hold = plant your feet, hold and drag = aim
//   right half: hold = fire, swipe right/left = tackle that way,
//               swipe up = sunglasses on, swipe down = sunglasses off
//   the portal device keeps a button.

const KEYS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  KeyZ: 'jump', KeyJ: 'jump', Space: 'jump',
  KeyX: 'fire', KeyK: 'fire',
  KeyC: 'glasses', KeyL: 'glasses', KeyG: 'glasses',
  KeyV: 'portal', KeyQ: 'portal', KeyE: 'portal',
  ShiftLeft: 'lock', ShiftRight: 'lock', KeyR: 'lock',
  KeyF: 'tackle', KeyH: 'tackle',
  Escape: 'pause', KeyP: 'pause',
  Enter: 'start',
};

export const input = {
  held: {},
  pressed: {},
  latch: {}, // presses too quick to still be down at the next step
  keys: {},
  touch: { left: false, right: false, up: false, down: false, jump: false, fire: false, lock: false },
  usingTouch: false,
  // Touch gesture state, also read by the renderer for feedback.
  walkDir: 0,
  holding: null, // { x, y, aimX, aimY } in screen pixels while the left thumb holds
  tackleDir: 0,
  jumpUntil: 0, // a swipe up holds jump this long, for a full-height jump

  isDown(name) {
    if (name === 'jump' && performance.now() < this.jumpUntil) return true;
    return !!(this.keys[name] || this.touch[name]);
  },

  /** Recomputes held/pressed; call once per game step. */
  update() {
    const names = ['left', 'right', 'up', 'down', 'jump', 'fire', 'tackle', 'glasses', 'glassesOn', 'glassesOff', 'drop', 'portal', 'lock', 'pause', 'start'];
    for (const n of names) {
      const down = this.isDown(n);
      this.pressed[n] = (down && !this.held[n]) || !!this.latch[n];
      this.held[n] = down;
    }
    this.latch = {};
  },
};

/**
 * onTap(x, y) gets taps in screen pixels before they reach the touch
 * controls, and returns true to consume them (menus, the pause button).
 */
export function setupInput(touchLayer, onTap) {
  addEventListener('keydown', (e) => {
    const name = KEYS[e.code];
    if (!name) return;
    e.preventDefault();
    if (!e.repeat) input.latch[name] = true;
    input.keys[name] = true;
  });
  addEventListener('keyup', (e) => {
    const name = KEYS[e.code];
    if (name) input.keys[name] = false;
  });
  addEventListener('blur', () => {
    input.keys = {};
    releaseAll();
  });

  const portalButton = touchLayer.querySelector('#btn-portal');
  const pointers = new Map(); // pointerId -> gesture
  const HOLD_MS = 220; // still this long = a hold
  const TAP_MS = 260; // released this fast without moving = a tap
  const swipeDist = () => Math.max(26, innerHeight * 0.07);
  const STILL = 12; // px of wobble allowed in a tap or hold

  function showTouch() {
    if (input.usingTouch) return;
    input.usingTouch = true;
    document.body.classList.add('touch');
  }

  function releaseAll() {
    pointers.clear();
    for (const k of Object.keys(input.touch)) input.touch[k] = false;
    input.walkDir = 0;
    input.holding = null;
    portalButton?.classList.remove('down');
  }

  /** Recomputes the touch flags from walking, holding and the right thumb. */
  function refresh() {
    const t = input.touch;
    const h = input.holding;
    t.lock = !!h;
    t.left = t.right = t.up = false;
    t.down = false;
    if (h) {
      // Aiming: eight directions from the hold point.
      const dx = h.aimX - h.x;
      const dy = h.aimY - h.y;
      if (Math.hypot(dx, dy) > STILL) {
        const octant = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
        t.right = octant === 0 || octant === 1 || octant === 7;
        t.down = octant === 1 || octant === 2 || octant === 3;
        t.left = octant === 3 || octant === 4 || octant === 5;
        t.up = octant === 5 || octant === 6 || octant === 7;
      }
    } else {
      t.right = input.walkDir > 0;
      t.left = input.walkDir < 0;
    }
    let fire = false;
    let jump = false;
    for (const p of pointers.values()) {
      if (p.side === 'right' && !p.swiped) fire = true;
      if (p.side === 'left' && p.swipe === 'up') jump = true;
      if (p.side === 'left' && p.swipe === 'down') t.down = true;
    }
    t.fire = fire;
    t.jump = jump;
  }

  function onPortalButton(x, y) {
    if (!portalButton || getComputedStyle(portalButton).display === 'none') return false;
    const r = portalButton.getBoundingClientRect();
    return Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)) < (r.width / 2) * 1.3;
  }

  touchLayer.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && !input.usingTouch) {
      onTap(e.clientX, e.clientY);
      return;
    }
    showTouch();
    e.preventDefault();
    if (onTap(e.clientX, e.clientY)) {
      pointers.set(e.pointerId, { side: 'none' });
      return;
    }
    touchLayer.setPointerCapture?.(e.pointerId);
    if (onPortalButton(e.clientX, e.clientY)) {
      input.latch.portal = true;
      portalButton.classList.add('down');
      pointers.set(e.pointerId, { side: 'portal' });
      return;
    }
    const p = { side: e.clientX < innerWidth / 2 ? 'left' : 'right', sx: e.clientX, sy: e.clientY, t0: performance.now(), moved: 0, swipe: null, swiped: false };
    pointers.set(e.pointerId, p);
    if (p.side === 'left') {
      p.holdTimer = setTimeout(() => {
        if (pointers.get(e.pointerId) === p && !p.swipe && p.moved < STILL) {
          p.hold = true;
          input.holding = { x: p.sx, y: p.sy, aimX: p.sx, aimY: p.sy };
          refresh();
        }
      }, HOLD_MS);
    }
    refresh();
  });

  touchLayer.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p || !p.sx) return;
    const dx = e.clientX - p.sx;
    const dy = e.clientY - p.sy;
    p.moved = Math.max(p.moved, Math.hypot(dx, dy));
    if (p.side === 'left') {
      if (p.hold) {
        input.holding.aimX = e.clientX;
        input.holding.aimY = e.clientY;
      } else if (!p.swipe && Math.hypot(dx, dy) > swipeDist()) {
        if (Math.abs(dx) > Math.abs(dy)) {
          p.swipe = 'side';
          input.walkDir = Math.sign(dx);
        } else if (dy < 0) {
          p.swipe = 'up';
          input.latch.jump = true;
          input.jumpUntil = performance.now() + 300;
        } else {
          p.swipe = 'down';
          input.latch.drop = true;
        }
      }
    } else if (p.side === 'right' && !p.swiped && Math.hypot(dx, dy) > swipeDist() && performance.now() - p.t0 < 400) {
      p.swiped = true;
      if (Math.abs(dx) > Math.abs(dy)) {
        input.tackleDir = Math.sign(dx);
        input.latch.tackle = true;
      } else if (dy < 0) input.latch.glassesOn = true;
      else input.latch.glassesOff = true;
    }
    refresh();
  });

  const end = (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    pointers.delete(e.pointerId);
    clearTimeout(p.holdTimer);
    if (p.side === 'portal') portalButton.classList.remove('down');
    if (p.side === 'left') {
      if (p.hold) input.holding = null;
      else if (!p.swipe && p.moved < STILL && performance.now() - p.t0 < TAP_MS) input.walkDir = 0;
    }
    refresh();
  };
  touchLayer.addEventListener('pointerup', end);
  touchLayer.addEventListener('pointercancel', end);

  return { releaseAll };
}
