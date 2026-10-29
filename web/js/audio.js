// Chiptune sound effects and music, synthesized with Web Audio (no files).

let ctx = null;
let master, sfxBus, musicBus, noiseBuffer;
let soundOn = true;
let musicOn = true;

function init() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = soundOn ? 1 : 0;
  sfxBus.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = musicOn ? 0.55 : 0;
  musicBus.connect(master);
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return true;
}

/** Call from a user gesture; browsers keep audio muted until then. */
export function unlockAudio() {
  if (!init()) return;
  if (ctx.state === 'suspended') ctx.resume();
}

export function setSound(on) {
  soundOn = on;
  if (sfxBus) sfxBus.gain.value = on ? 1 : 0;
}

export function setMusic(on) {
  musicOn = on;
  if (musicBus) musicBus.gain.value = on ? 0.55 : 0;
}

// ---------- Building blocks ----------

function tone({ type = 'square', from, to = from, dur, vol = 0.15, at = 0, bus = sfxBus }) {
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(bus);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise({ dur, vol = 0.2, filter = 'lowpass', from = 4000, to = from, at = 0, bus = sfxBus }) {
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(from, t);
  if (to !== from) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(gain).connect(bus);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

const SFX = {
  shotgun() {
    noise({ dur: 0.22, vol: 0.45, from: 3500, to: 250 });
    tone({ from: 140, to: 40, dur: 0.15, vol: 0.2 });
  },
  nail: () => tone({ from: 1100, to: 600, dur: 0.05, vol: 0.08 }),
  torch: () => noise({ dur: 0.08, vol: 0.12, filter: 'bandpass', from: 900 }),
  slug() {
    tone({ from: 320, to: 60, dur: 0.18, vol: 0.2 });
    noise({ dur: 0.15, vol: 0.3, from: 2000, to: 300 });
  },
  jump: () => tone({ from: 240, to: 560, dur: 0.12, vol: 0.08 }),
  land: () => noise({ dur: 0.05, vol: 0.08, from: 600 }),
  hurt() {
    tone({ type: 'sawtooth', from: 420, to: 90, dur: 0.3, vol: 0.18 });
    noise({ dur: 0.2, vol: 0.2, from: 1500, to: 200 });
  },
  hit: () => tone({ from: 220, to: 160, dur: 0.05, vol: 0.1 }),
  die() {
    noise({ dur: 0.25, vol: 0.3, from: 2500, to: 200 });
    tone({ from: 300, to: 50, dur: 0.25, vol: 0.12 });
  },
  innocent() {
    [523, 440, 349].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.2, vol: 0.2, at: i * 0.15 }));
  },
  pickup() {
    [660, 880, 1320].forEach((f, i) => tone({ from: f, dur: 0.08, vol: 0.1, at: i * 0.06 }));
  },
  found() {
    [392, 523, 659, 784, 1047].forEach((f, i) => tone({ from: f, dur: 0.14, vol: 0.12, at: i * 0.09 }));
  },
  glassesOn() {
    tone({ type: 'sine', from: 180, to: 1400, dur: 0.3, vol: 0.18 });
    tone({ type: 'square', from: 90, to: 700, dur: 0.3, vol: 0.05 });
  },
  glassesOff: () => tone({ type: 'sine', from: 1400, to: 180, dur: 0.25, vol: 0.15 }),
  headache() {
    tone({ type: 'sawtooth', from: 70, to: 60, dur: 0.5, vol: 0.15 });
    tone({ type: 'square', from: 1800, to: 1700, dur: 0.4, vol: 0.03 });
  },
  plasma: () => tone({ type: 'sawtooth', from: 900, to: 300, dur: 0.12, vol: 0.06 }),
  reveal() {
    noise({ dur: 0.35, vol: 0.18, filter: 'highpass', from: 3000 });
    tone({ type: 'sawtooth', from: 200, to: 120, dur: 0.3, vol: 0.08 });
  },
  explode() {
    noise({ dur: 0.7, vol: 0.5, from: 1800, to: 80 });
    tone({ from: 90, to: 30, dur: 0.6, vol: 0.2 });
  },
  clear() {
    [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone({ from: f, dur: 0.16, vol: 0.12, at: i * 0.12 }));
  },
  gameover() {
    [392, 370, 349, 330, 262].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.35, vol: 0.2, at: i * 0.28 }));
  },
  descend: () => tone({ type: 'triangle', from: 600, to: 80, dur: 0.6, vol: 0.2 }),
};

export function sfx(name) {
  if (!ctx || !soundOn || ctx.state !== 'running') return;
  SFX[name]?.();
}

// ---------- Music ----------
// Songs are four bars of sixteenth notes per channel. '.' is a rest.

const SONGS = {
  city: {
    bpm: 140,
    bass: `A2 . A3 . A2 . A3 . A2 . A3 . G2 . G3 . | F2 . F3 . F2 . F3 . F2 . F3 . G2 . G3 . |
           A2 . A3 . A2 . A3 . C3 . C4 . B2 . B3 . | E2 . E3 . E2 . E3 . E2 . E3 . G#2 . G#3 .`,
    lead: `A4 . . C5 . . E5 . D5 . C5 . B4 . G4 . | A4 . . . . . . . F4 . G4 . A4 . C5 . |
           E5 . . D5 . . C5 . D5 . E5 . G5 . E5 . | B4 . . . G#4 . . . E4 . . . . . . .`,
    drums: 'k.h.s.h.k.h.s.hh',
  },
  tunnel: {
    bpm: 118,
    bass: `D2 . . D2 . . D2 . . . D3 . C3 . A2 . | A#1 . . A#1 . . A#1 . . . A#2 . A2 . F2 . |
           C2 . . C2 . . C2 . . . C3 . D3 . C3 . | A1 . . A1 . . A1 . C#2 . E2 . A2 . C#3 .`,
    lead: `D5 . . . . . F5 . E5 . . . D5 . . . | A#4 . . . . . . . A4 . . . F4 . . . |
           G4 . . . . . A4 . A#4 . . . C5 . . . | A4 . . . . . . . C#5 . . . E5 . . .`,
    drums: 'k...h.s.k.k.h.s.',
  },
  boss: {
    bpm: 160,
    bass: `E2 E3 E2 E3 E2 E3 E2 E3 D2 D3 D2 D3 D2 D3 D2 D3 | C2 C3 C2 C3 C2 C3 C2 C3 B1 B2 B1 B2 B1 B2 B1 B2 |
           E2 E3 E2 E3 E2 E3 E2 E3 D2 D3 D2 D3 D2 D3 D2 D3 | C2 C3 C2 C3 D2 D3 D2 D3 D#2 D#3 D#2 D#3 B1 B2 B1 B2`,
    lead: `E5 . E5 . G5 . E5 . F#5 . . . D5 . . . | C5 . C5 . E5 . C5 . B4 . . . D#5 . . . |
           E5 . G5 . B5 . A5 . G5 . F#5 . G5 . A5 . | G5 . . . F#5 . . . D#5 . . . B4 . . .`,
    drums: 'k.hsk.hsk.hsk.ss',
  },
};

const NOTE_INDEX = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

function noteFreq(token) {
  const m = /^([A-G]#?)(\d)$/.exec(token);
  if (!m) return 0;
  const midi = (Number(m[2]) + 1) * 12 + NOTE_INDEX[m[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function parse(channel) {
  return channel
    .replace(/\|/g, ' ')
    .trim()
    .split(/\s+/)
    .map(noteFreq);
}

for (const song of Object.values(SONGS)) {
  song.bassNotes = parse(song.bass);
  song.leadNotes = parse(song.lead);
}

let current = null;
let step = 0;
let nextTime = 0;
let timer = null;

function scheduleStep(song, i, t) {
  const len = 60 / song.bpm / 4;
  const at = t - ctx.currentTime;
  const bass = song.bassNotes[i % song.bassNotes.length];
  if (bass) tone({ type: 'triangle', from: bass, dur: len * 1.8, vol: 0.32, at, bus: musicBus });
  const lead = song.leadNotes[i % song.leadNotes.length];
  if (lead) tone({ type: 'square', from: lead, dur: len * 2.5, vol: 0.06, at, bus: musicBus });
  const d = song.drums[i % 16];
  if (d === 'k') tone({ type: 'sine', from: 150, to: 40, dur: 0.12, vol: 0.4, at, bus: musicBus });
  else if (d === 's') noise({ dur: 0.1, vol: 0.18, filter: 'bandpass', from: 1800, at, bus: musicBus });
  else if (d === 'h') noise({ dur: 0.03, vol: 0.06, filter: 'highpass', from: 7000, at, bus: musicBus });
}

function tick() {
  if (!ctx || !current || ctx.state !== 'running') return;
  const song = SONGS[current];
  const len = 60 / song.bpm / 4;
  if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
  while (nextTime < ctx.currentTime + 0.15) {
    scheduleStep(song, step, nextTime);
    step++;
    nextTime += len;
  }
}

/** Starts a song by name, or stops the music with null. */
export function playMusic(name) {
  if (name === current) return;
  current = name;
  step = 0;
  nextTime = 0;
  if (!timer) timer = setInterval(tick, 30);
}
