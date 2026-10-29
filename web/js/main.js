// Boots the game: canvas sizing, the fixed-step loop, taps and audio.
import { createGame, loadSave, VIEW_H } from './game.js';
import { render, RES } from './render.js';
import { input, setupInput } from './input.js';
import { unlockAudio, setSound, setMusic } from './audio.js';

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');

const save = loadSave();
setSound(save.sound);
setMusic(save.music);
const game = createGame(save);
game.onSettingsChanged = () => {
  setSound(save.sound);
  setMusic(save.music);
  resize();
};

// How much closer the camera is in the default CLOSE view.
const CLOSE_ZOOM = 1.2;

/**
 * The screen (HUD and menus) is always VIEW_H units tall; its width follows
 * the screen's shape. The world is drawn `zoom` times bigger, so the camera
 * sees VIEW_H / zoom of it.
 */
function resize() {
  const zoom = save.view === 'full' ? 1 : CLOSE_ZOOM;
  const screenW = Math.max(400, Math.min(700, Math.round((VIEW_H * innerWidth) / innerHeight)));
  canvas.width = screenW * RES;
  canvas.height = VIEW_H * RES;
  game.screenW = screenW;
  game.zoom = zoom;
  game.viewH = VIEW_H / zoom;
  game.W = screenW / zoom;
  game.updateCamera(0, true);
  const scale = Math.min(innerWidth / screenW, innerHeight / VIEW_H);
  canvas.style.width = `${screenW * scale}px`;
  canvas.style.height = `${VIEW_H * scale}px`;
}
addEventListener('resize', resize);
resize();

function onTap(clientX, clientY) {
  unlockAudio();
  const r = canvas.getBoundingClientRect();
  const x = ((clientX - r.left) / r.width) * game.screenW;
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
  document.body.classList.toggle('no-portal', !game.portal.have || game.areaKey !== 'street');
  render(ctx, game, input.usingTouch || coarse, input);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// For automated checks.
window.__game = game;
