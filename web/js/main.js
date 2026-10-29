// Boots the game: canvas sizing, the fixed-step loop, taps and audio.
import { createGame, loadSave, VIEW_H } from './game.js';
import { render } from './render.js';
import { input, setupInput } from './input.js';
import { unlockAudio, setSound, setMusic } from './audio.js';
import { ARENA_COLS, TILE } from './stage.js';

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

const save = loadSave();
setSound(save.sound);
setMusic(save.music);
const game = createGame(save);
game.onSettingsChanged = () => {
  setSound(save.sound);
  setMusic(save.music);
};

/** The view is always VIEW_H pixels tall; its width follows the screen. */
function resize() {
  const W = Math.max(400, Math.min(700, Math.round((VIEW_H * innerWidth) / innerHeight)));
  canvas.width = W;
  canvas.height = VIEW_H;
  game.W = W;
  if (game.areaKey === 'boss' && game.area) game.cam.x = (ARENA_COLS * TILE - W) / 2;
  const scale = Math.min(innerWidth / W, innerHeight / VIEW_H);
  canvas.style.width = `${W * scale}px`;
  canvas.style.height = `${VIEW_H * scale}px`;
}
addEventListener('resize', resize);
resize();

function onTap(clientX, clientY) {
  unlockAudio();
  const r = canvas.getBoundingClientRect();
  const x = ((clientX - r.left) / r.width) * game.W;
  const y = ((clientY - r.top) / r.height) * VIEW_H;
  const inside = (b) => b && x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
  if (game.menu) {
    const hit = (game.menuRects || []).find(inside);
    if (hit) game.activate(hit.index);
    return true;
  }
  if (game.mode === 'play' && inside(game.pauseRect)) {
    game.pause();
    return true;
  }
  return false;
}

const controls = setupInput(document.getElementById('touch'), onTap);
addEventListener('keydown', unlockAudio);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.pause();
    controls.releaseAll();
  }
});

game.showTitle();

const coarse = matchMedia('(pointer: coarse)').matches;

let last = performance.now();
let acc = 0;
function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  while (acc >= game.STEP) {
    input.update();
    game.step(input);
    acc -= game.STEP;
  }
  const playing = game.mode === 'play' || game.mode === 'transition';
  document.body.classList.toggle('playing', playing);
  document.body.classList.toggle('no-shades', !game.glasses.have);
  document.body.classList.toggle('shades-on', game.glasses.on);
  document.body.classList.toggle('no-portal', !game.portal.have || game.areaKey !== 'street');
  render(ctx, game, input.usingTouch || coarse);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// For automated checks.
window.__game = game;
