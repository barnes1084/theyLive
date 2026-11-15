// Every number worth tweaking, with its range and default. The game reads
// `tune` live, so a change in the settings menu applies at once; values are
// kept in localStorage. Multipliers (×) scale the game's built-in values,
// which still grow harder from stage to stage.

export const TUNING = [
  { group: 'GAME' },
  { key: 'gameSpeed', label: 'Game speed', min: 0.5, max: 1.5, step: 0.05, def: 1, unit: '×' },
  { key: 'startStage', label: 'Starting stage', min: 1, max: 20, step: 1, def: 1 },
  { key: 'shake', label: 'Screen shake', min: 0, max: 2, step: 0.1, def: 1, unit: '×' },
  { key: 'sfxVolume', label: 'Sound effects volume', min: 0, max: 1, step: 0.05, def: 1, pct: true },
  { key: 'musicVolume', label: 'Music volume', min: 0, max: 1, step: 0.05, def: 1, pct: true },

  { group: 'HERO' },
  { key: 'maxHearts', label: 'Hearts', min: 1, max: 10, step: 1, def: 4 },
  { key: 'hitDamage', label: 'Hearts lost per hit', min: 0, max: 4, step: 1, def: 1, note: '0 = invincible' },
  { key: 'pitDamage', label: 'Hearts lost falling in a pit', min: 0, max: 4, step: 1, def: 1 },
  { key: 'innocentDamage', label: 'Hearts lost shooting an innocent', min: 0, max: 4, step: 1, def: 1 },
  { key: 'invTime', label: 'Invincible after a hit', min: 0, max: 5, step: 0.1, def: 1.6, unit: 's' },
  { key: 'startHardHat', label: 'Start each stage with a hard hat', type: 'bool', def: false },
  { key: 'runSpeed', label: 'Run speed', min: 1, max: 2, step: 0.05, def: 1, unit: '×' },
  { key: 'jumpPower', label: 'Jump power', min: 1, max: 1.5, step: 0.05, def: 1, unit: '×' },
  { key: 'gravity', label: 'Gravity', min: 0.6, max: 1, step: 0.05, def: 1, unit: '×', note: 'lower = floatier' },
  { key: 'tackleSpeed', label: 'Tackle speed', min: 100, max: 400, step: 5, def: 185 },
  { key: 'tackleTime', label: 'Tackle length', min: 0.1, max: 1, step: 0.02, def: 0.28, unit: 's' },
  { key: 'tackleCooldown', label: 'Tackle cooldown', min: 0, max: 3, step: 0.05, def: 0.7, unit: 's' },
  { key: 'tackleDamage', label: 'Tackle damage', min: 1, max: 20, step: 1, def: 3 },

  { group: 'WEAPONS' },
  {
    key: 'startWeapon',
    label: 'Starting weapon',
    type: 'choice',
    def: 'G',
    options: { G: 'Spread gun', M: 'Machine gun', N: 'Nail gun', T: 'Torch', S: 'Slugs' },
  },
  { key: 'keepWeapon', label: 'Keep weapon after game over', type: 'bool', def: false },
  { key: 'bulletSpeed', label: 'Bullet speed', min: 0.5, max: 2, step: 0.05, def: 1, unit: '×' },
  { key: 'bulletRange', label: 'Bullet range', min: 0.5, max: 3, step: 0.1, def: 1, unit: '×' },
  { key: 'spreadDelay', label: 'Spread gun: time between shots', min: 0.05, max: 1, step: 0.01, def: 0.36, unit: 's' },
  { key: 'spreadDamage', label: 'Spread gun: damage per pellet', min: 0.25, max: 10, step: 0.25, def: 1 },
  { key: 'spreadPellets', label: 'Spread gun: pellets', min: 1, max: 11, step: 1, def: 5 },
  { key: 'spreadAngle', label: 'Spread gun: spread', min: 0.04, max: 0.4, step: 0.01, def: 0.16, unit: 'rad' },
  { key: 'mgDelay', label: 'Machine gun: time between shots', min: 0.03, max: 0.5, step: 0.005, def: 0.075, unit: 's' },
  { key: 'mgDamage', label: 'Machine gun: damage', min: 0.25, max: 10, step: 0.25, def: 1 },
  { key: 'mgSweep', label: 'Machine gun: scatter', min: 0, max: 0.6, step: 0.01, def: 0.22, unit: 'rad' },
  { key: 'nailDelay', label: 'Nail gun: time between shots', min: 0.03, max: 0.5, step: 0.01, def: 0.1, unit: 's' },
  { key: 'nailDamage', label: 'Nail gun: damage', min: 0.25, max: 10, step: 0.25, def: 1 },
  { key: 'torchDelay', label: 'Torch: time between puffs', min: 0.02, max: 0.3, step: 0.01, def: 0.05, unit: 's' },
  { key: 'torchDamage', label: 'Torch: damage', min: 0.05, max: 5, step: 0.05, def: 0.45 },
  { key: 'slugDelay', label: 'Slugs: time between shots', min: 0.1, max: 1.5, step: 0.02, def: 0.42, unit: 's' },
  { key: 'slugDamage', label: 'Slugs: damage', min: 1, max: 20, step: 0.5, def: 5 },
  { key: 'slugPierce', label: 'Slugs: enemies pierced', min: 0, max: 10, step: 1, def: 2 },
  { key: 'dropChance', label: 'Sewer lizard drop chance', min: 0, max: 1, step: 0.01, def: 0.09, pct: true },

  { group: 'SHADES & PORTAL' },
  { key: 'shadesTime', label: 'Shades last', min: 1, max: 120, step: 1, def: 6, unit: 's' },
  { key: 'contactsTime', label: 'Shades last with contacts', min: 1, max: 120, step: 1, def: 12, unit: 's' },
  { key: 'shadesRecharge', label: 'Shades full recharge', min: 0.5, max: 20, step: 0.5, def: 4, unit: 's' },
  { key: 'startShades', label: 'Start each stage with the shades', type: 'bool', def: false },
  { key: 'startPortal', label: 'Start each stage with the portal', type: 'bool', def: false },
  { key: 'portalCooldown', label: 'Portal cooldown', min: 0, max: 5, step: 0.1, def: 1.2, unit: 's' },

  { group: 'LIZARDS' },
  { key: 'enemyHp', label: 'Lizard health', min: 0.25, max: 5, step: 0.25, def: 1, unit: '×' },
  { key: 'enemySpeed', label: 'Lizard speed', min: 0.3, max: 2.5, step: 0.05, def: 1, unit: '×' },
  { key: 'enemyFireRate', label: 'Lizard fire rate', min: 0.25, max: 4, step: 0.05, def: 1, unit: '×' },
  { key: 'enemyShotSpeed', label: 'Lizard shot speed', min: 0.4, max: 2.5, step: 0.05, def: 1, unit: '×' },
  { key: 'waveRate', label: 'Sewer ambushes', min: 0.25, max: 4, step: 0.05, def: 1, unit: '×' },
  { key: 'revealDistance', label: 'Disguise drops within', min: 0, max: 200, step: 5, def: 70, unit: 'px' },
  { key: 'revealTime', label: 'Disguise drops after', min: 0.05, max: 3, step: 0.05, def: 0.45, unit: 's' },
  { key: 'snatchRate', label: 'Child snatchers', min: 0, max: 3, step: 0.1, def: 1, unit: '×', note: '0 = none' },
  { key: 'snatchEscape', label: 'Snatcher escapes after running', min: 4, max: 60, step: 1, def: 18, unit: 'tiles' },

  { group: 'MOLOCH' },
  { key: 'bossHp', label: 'Idol health', min: 0.1, max: 5, step: 0.05, def: 1, unit: '×' },
  { key: 'bossSpeed', label: 'Idol speed', min: 0.3, max: 3, step: 0.05, def: 1, unit: '×' },
  { key: 'bossAttackRate', label: 'Idol attack rate', min: 0.3, max: 3, step: 0.05, def: 1, unit: '×' },
  { key: 'cultists', label: 'Cultists at the ceremony', min: 0, max: 12, step: 1, def: 0, auto: true, note: '0 = auto' },

  { group: 'SCORE' },
  { key: 'lizardPoints', label: 'Points per lizard', min: 0, max: 1000, step: 10, def: 100 },
  { key: 'savedPoints', label: 'Points for saving a child', min: 0, max: 5000, step: 50, def: 500 },
  { key: 'lostPoints', label: 'Penalty for losing a child', min: 0, max: 5000, step: 50, def: 1000 },
  { key: 'innocentPoints', label: 'Penalty for shooting an innocent', min: 0, max: 5000, step: 50, def: 500 },
  { key: 'bossPoints', label: 'Points for destroying the idol', min: 0, max: 20000, step: 500, def: 5000 },
];

const KEY = 'theylive-tuning';

export const tune = {};

export function resetTuning() {
  for (const t of TUNING) if (t.key) tune[t.key] = t.def;
}

export function loadTuning() {
  resetTuning();
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    // Unreadable: keep the defaults.
  }
  for (const t of TUNING) {
    if (!t.key || !(t.key in saved)) continue;
    const v = saved[t.key];
    if (t.type === 'bool') tune[t.key] = !!v;
    else if (t.type === 'choice') tune[t.key] = v in t.options ? v : t.def;
    else if (typeof v === 'number' && Number.isFinite(v)) tune[t.key] = Math.min(t.max, Math.max(t.min, v));
  }
  return saved;
}

export function saveTuning() {
  try {
    localStorage.setItem(KEY, JSON.stringify(tune));
  } catch {
    // Storage can be unavailable (private mode); settings just aren't kept.
  }
}

/** True if any value differs from its default. */
export function isTuned() {
  return TUNING.some((t) => t.key && tune[t.key] !== t.def);
}

loadTuning();
