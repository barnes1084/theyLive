// Draws the app icon (the hero in his shades, with the rifle) with the game's
// own vector art in headless Chromium, and writes the PNGs for Android and
// the web. Run: node tools/icons.mjs (needs Playwright).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// require() so a global Playwright install (NODE_PATH) works too.
const { chromium } = createRequire(import.meta.url)('playwright');

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const web = path.join(root, 'web');
const TYPES = { '.js': 'text/javascript', '.html': 'text/html', '.woff2': 'font/woff2' };

const PAGE = `<!doctype html><canvas id="c"></canvas><script type="module">
import { drawFigure } from './js/art.js';
import { heroSpec } from './js/render.js';
window.draw = (size) => {
  const c = document.getElementById('c');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const bg = ctx.createRadialGradient(size * 0.5, size * 0.38, 0, size * 0.5, size * 0.5, size * 0.72);
  bg.addColorStop(0, '#c83a1c');
  bg.addColorStop(0.55, '#5a1022');
  bg.addColorStop(1, '#14060c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  // Knees up: the figure is about 30 units tall.
  const k = size / 27;
  ctx.save();
  ctx.translate(size * 0.42, size * 1.02);
  ctx.scale(k, k);
  drawFigure(ctx, 0, 0, 1, heroSpec(true), { t: 0, speed: 0, aim: { x: 1, y: 0 }, gun: 'rifle' });
  ctx.restore();
  return c.toDataURL('image/png').split(',')[1];
};
window.ready = true;
</script>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.route('http://icons.local/**', (route) => {
  const rel = new URL(route.request().url()).pathname;
  if (rel === '/') return route.fulfill({ body: PAGE, contentType: 'text/html' });
  const file = path.join(web, rel);
  route.fulfill({ body: fs.readFileSync(file), contentType: TYPES[path.extname(file)] || 'application/octet-stream' });
});
await page.goto('http://icons.local/');
await page.waitForFunction(() => window.ready);

async function write(file, size) {
  const b64 = await page.evaluate((s) => window.draw(s), size);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  console.log('wrote', path.relative(root, file));
}

const mipmaps = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [density, size] of Object.entries(mipmaps)) {
  await write(path.join(root, `android/app/src/main/res/mipmap-${density}/ic_launcher.png`), size);
}
await write(path.join(web, 'icons/icon-192.png'), 192);
await write(path.join(web, 'icons/icon-512.png'), 512);
await browser.close();
