// Draws the app icon (a construction worker in shades) as pixel art, smoothed
// and shaded the same way as the game's 16-bit sprites, and writes the PNGs
// for Android and the web. Run: node tools/icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { scale2x, shadeGrid } from '../web/js/sprites.js';

const ART = [
  '................',
  '......yyyy......',
  '....yyyyyyyy....',
  '...yyyyyyyyyy...',
  '...yyyyyyyyyy...',
  '..YYYYYYYYYYYY..',
  '...hssssssssh...',
  '...EEEEssEEEE...',
  '...EGEEssEGEE...',
  '...sEEssssEEs...',
  '...ssssssssss...',
  '....ssmmmmss....',
  '.....ssssss.....',
  '..sssswwwwssss..',
  '.sssswwwwwwssss.',
  '.ssswwwwwwwwsss.',
];
const PALETTE = {
  y: '#f8d800',
  Y: '#f8b800',
  h: '#e8c058',
  s: '#f0a868',
  E: '#101018',
  G: '#58d854',
  m: '#a80020',
  w: '#f4f4ee',
};
const SHADED = shadeGrid(scale2x(ART), PALETTE);

/** Background: a dark vertical gradient. */
function background(t) {
  return [Math.round(36 - 24 * t), Math.round(20 - 12 * t), Math.round(60 - 36 * t)];
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Icon PNG of size x size; `pad` is the border in art pixels. */
function iconPng(size, pad) {
  const grid = SHADED.w + pad * 4;
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const gx = Math.floor((x * grid) / size) - pad * 2;
      const gy = Math.floor((y * grid) / size) - pad * 2;
      const inside = gx >= 0 && gx < SHADED.w && gy >= 0 && gy < SHADED.h;
      const [r, g, b] = (inside && SHADED.px[gy * SHADED.w + gx]) || background(y / size);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const write = (file, buf) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  console.log('wrote', path.relative(root, file));
};
const mipmaps = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [density, size] of Object.entries(mipmaps)) {
  write(path.join(root, `android/app/src/main/res/mipmap-${density}/ic_launcher.png`), iconPng(size, 2));
}
write(path.join(root, 'web/icons/icon-192.png'), iconPng(192, 2));
write(path.join(root, 'web/icons/icon-512.png'), iconPng(512, 2));
