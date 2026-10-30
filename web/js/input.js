// Keyboard and touch input, merged into one set of buttons:
// left, right, up, down, jump, fire, tackle, glasses, portal, lock, pause.
// `held` is what is down right now; `pressed` is what went down this frame.

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
  touch: { left: false, right: false, up: false, down: false, jump: false, fire: false, tackle: false, glasses: false, portal: false },
  usingTouch: false,
  // The touch lock button is a toggle: thumbs are busy, so it stays on until tapped again.
  lockToggle: false,

  isDown(name) {
    if (name === 'lock' && this.lockToggle) return true;
    return !!(this.keys[name] || this.touch[name]);
  },

  /** Recomputes held/pressed; call once per game step. */
  update() {
    const names = ['left', 'right', 'up', 'down', 'jump', 'fire', 'tackle', 'glasses', 'portal', 'lock', 'pause', 'start'];
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

  const stick = touchLayer.querySelector('#stick');
  const knob = touchLayer.querySelector('#knob');
  const buttons = [...touchLayer.querySelectorAll('.btn')];
  const pointers = new Map(); // pointerId -> { kind: 'stick' | 'button' | 'tap', name, ox, oy }

  function showTouch() {
    if (input.usingTouch) return;
    input.usingTouch = true;
    document.body.classList.add('touch');
  }

  function releaseAll() {
    pointers.clear();
    for (const k of Object.keys(input.touch)) input.touch[k] = false;
    knob.style.transform = '';
    stick.classList.remove('active');
    stick.style.left = stick.style.top = '';
    buttons.forEach((b) => b.classList.remove('down'));
  }

  function setStick(dx, dy) {
    const size = stick.offsetWidth / 2;
    const len = Math.hypot(dx, dy);
    const max = size * 0.6;
    const k = len > max ? max / len : 1;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    const t = input.touch;
    t.left = t.right = t.up = t.down = false;
    if (len < size * 0.22) return;
    // Eight directions, like a d-pad.
    const octant = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
    t.right = octant === 0 || octant === 1 || octant === 7;
    t.down = octant === 1 || octant === 2 || octant === 3;
    t.left = octant === 3 || octant === 4 || octant === 5;
    t.up = octant === 5 || octant === 6 || octant === 7;
  }

  /** The button under (x, y), with some slack so thumbs can be sloppy. */
  function buttonAt(x, y) {
    let best = null;
    let bestDist = Infinity;
    for (const b of buttons) {
      const r = b.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const d = Math.hypot(x - cx, y - cy) / (r.width / 2);
      if (d < 1.35 && d < bestDist) {
        best = b;
        bestDist = d;
      }
    }
    return best;
  }

  function refreshButtons() {
    const active = new Set();
    for (const p of pointers.values()) if (p.kind === 'button' && p.name) active.add(p.name);
    for (const b of buttons) {
      const name = b.dataset.button;
      if (name === 'lock') {
        if (active.has(name) && !b.classList.contains('down')) input.lockToggle = !input.lockToggle;
        b.classList.toggle('down', active.has(name));
        continue;
      }
      if (active.has(name) && !input.touch[name]) input.latch[name] = true;
      input.touch[name] = active.has(name);
      b.classList.toggle('down', active.has(name));
    }
  }

  touchLayer.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && !input.usingTouch) {
      onTap(e.clientX, e.clientY);
      return;
    }
    showTouch();
    e.preventDefault();
    if (onTap(e.clientX, e.clientY)) {
      pointers.set(e.pointerId, { kind: 'tap' });
      return;
    }
    touchLayer.setPointerCapture?.(e.pointerId);
    if (e.clientX < innerWidth * 0.45) {
      // The stick appears under the thumb.
      const half = stick.offsetWidth / 2;
      const ox = Math.max(half, Math.min(e.clientX, innerWidth * 0.45 - half));
      const oy = Math.max(half, Math.min(e.clientY, innerHeight - half));
      stick.style.left = `${ox - half}px`;
      stick.style.top = `${oy - half}px`;
      stick.classList.add('active');
      pointers.set(e.pointerId, { kind: 'stick', ox, oy });
      setStick(e.clientX - ox, e.clientY - oy);
    } else {
      const b = buttonAt(e.clientX, e.clientY);
      pointers.set(e.pointerId, { kind: 'button', name: b?.dataset.button });
      refreshButtons();
    }
  });

  touchLayer.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    if (p.kind === 'stick') setStick(e.clientX - p.ox, e.clientY - p.oy);
    else if (p.kind === 'button') {
      // Slide between fire and jump without lifting the thumb. The glasses
      // and portal buttons only work on a fresh press.
      const b = buttonAt(e.clientX, e.clientY);
      const name = b?.dataset.button;
      const slides = (n) => n === 'fire' || n === 'jump' || n === undefined;
      if (name !== p.name && slides(name) && slides(p.name)) {
        p.name = name;
        refreshButtons();
      }
    }
  });

  const end = (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    pointers.delete(e.pointerId);
    if (p.kind === 'stick') {
      setStick(0, 0);
      knob.style.transform = '';
      stick.classList.remove('active');
      stick.style.left = stick.style.top = '';
    } else refreshButtons();
  };
  touchLayer.addEventListener('pointerup', end);
  touchLayer.addEventListener('pointercancel', end);

  return { releaseAll };
}
