// The hero's pose and where his rifle's muzzle is, shared by the game rules
// (where shots start) and the renderer (where the rifle is drawn).

/** Shoulder height above the feet, and rifle length, in world pixels. */
export const SHOULDER = 16.5;
export const CROUCH_SHOULDER = 10.5;
export const RIFLE = 12.5;

/** 'ball' in the air (somersault), 'crouch' when ducking or tackling, else 'stand'. */
export function heroPose(p) {
  if (!p.onGround && !(p.tackle > 0)) return 'ball';
  if (p.crouch || p.tackle > 0) return 'crouch';
  return 'stand';
}

/** The shoulder the rifle pivots on. */
export function heroShoulder(p) {
  const pose = heroPose(p);
  if (pose === 'ball') return { x: p.x, y: p.y - 11 };
  return { x: p.x + p.face * 0.5, y: p.y - (pose === 'crouch' ? CROUCH_SHOULDER : SHOULDER) };
}

/** Muzzle position in world pixels for the hero's current pose. */
export function heroMuzzle(p) {
  const s = heroShoulder(p);
  const len = heroPose(p) === 'ball' ? 8 : RIFLE;
  return { x: s.x + p.aim.x * len, y: s.y + p.aim.y * len };
}
