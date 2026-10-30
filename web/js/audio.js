// Sound effects and metal music, synthesized with Web Audio (no files).

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
  mg() {
    tone({ from: 520, to: 140, dur: 0.06, vol: 0.09 });
    noise({ dur: 0.05, vol: 0.14, from: 3000, to: 900 });
  },
  tackle() {
    noise({ dur: 0.25, vol: 0.25, filter: 'bandpass', from: 600, to: 2400 });
    tone({ type: 'triangle', from: 90, to: 50, dur: 0.2, vol: 0.3 });
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
  portal() {
    tone({ type: 'sine', from: 1600, to: 120, dur: 0.35, vol: 0.18 });
    tone({ type: 'square', from: 300, to: 1200, dur: 0.3, vol: 0.05, at: 0.05 });
    noise({ dur: 0.3, vol: 0.12, filter: 'bandpass', from: 2500, to: 500 });
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
// Metal: distorted power chords through an amp and cabinet, a bass that
// follows the riff, a lead guitar, and a drum kit, all synthesized.
//
// Guitar and lead lines are sixteenth notes. A note like E2 is a palm-muted
// chug; E2! rings open until the next note. '-' holds the note before it and
// '.' is a rest. Drum rows are sixteenth-note strings: k kick, s snare,
// h closed hat, o open hat, r ride, c crash. Each part loops on its own.

const SONGS = {
  title: {
    bpm: 132,
    guitar: `E2! - - - - - . E2 E2 . G2! - - - A2! - | A#2! - - - A2! - - - G2! - - - F#2! - - - |
             E2! - - - - - . E2 E2 . G2! - - - A2! - | C3! - - - B2! - - - A#2! - A2! - G2! - F#2! -`,
    lead: `. . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . |
           B4 - - - - - - - - - A4 - G4 - A4 - | A#4 - - - - - - - A4 - - - - - - -`,
    drums: {
      k: 'k.....k.k.......k.....k.k.....k.',
      s: '....s.......s.......s.......s.ss',
      h: 'c.h.h.h.h.h.h.h.o.h.h.h.h.h.h.h.',
    },
  },
  city: {
    bpm: 168,
    guitar: `E2 . E2 E2 E2 . E2 E2 G2! - - - F#2! - - - | E2 . E2 E2 E2 . E2 E2 A#2! - A2! - G2! - F#2! - |
             E2 . E2 E2 E2 . E2 E2 G2! - - - F#2! - - - | E2 E2 E2 E2 E2 E2 E2 E2 D2! - - - D#2! - - -`,
    lead: `. . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . |
           . . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . |
           E4 - - - G4 - - - A4 - A#4 - A4 - G4 - | E4 - - - - - - - D4 - E4 - - - - - |
           E4 - - - G4 - - - A4 - A#4 - A4 - G4 - | B4 - - - - - - - A#4 - - - - - - -`,
    drums: {
      k: 'k.k.k.k.k.k.k.k.',
      s: '..s...s...s...s.',
      h: 'c.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.' +
         'h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.o.o.o.o.',
    },
  },
  tunnel: {
    bpm: 84,
    guitar: `D2! - - - - - - - D2 . D2 . F2! - - - | D#2! - - - - - - - D2 . . . C2! - - - |
             D2! - - - - - - - D2 . D2 . F2! - - - | G#2! - - - G2! - - - F2! - D#2! - D2! - - -`,
    lead: `. . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . |
           A4 - - - - - - - G#4 - - - - - - - | D5 - - - C5 - - - A#4 - - - A4 - - -`,
    drums: {
      k: 'k.........k.....k.........k...k.',
      s: '........s...............s.......',
      h: 'c.r.r.r.r.r.r.r.r.r.r.r.r.r.r.r.',
    },
  },
  boss: {
    bpm: 184,
    guitar: `E2 E2 F2 E2 E2 F#2 E2 E2 G2 E2 F2 E2 A#2! - A2! - | E2 E2 F2 E2 E2 F#2 E2 E2 C3! - B2! - A#2! - A2! - |
             E2 E2 F2 E2 E2 F#2 E2 E2 G2 E2 F2 E2 A#2! - A2! - | D3! - C#3! - C3! - B2! - A#2! - A2! - G#2! - G2! -`,
    lead: `E5 - - - - - - - D#5 - - - - - - - | F5 - - - E5 - - - D#5 - - - D5 - - - |
           E5 - - - - - - - G5 - - - F#5 - - - | A#5 - - - A5 - - - G#5 - - - G5 - - -`,
    drums: {
      k: 'kkkkkkkkkkkkkkkk',
      s: '....s.......s...',
      h: 'c.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.' +
         'h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.c.h.h.h.h.h.h.h.c.h.h.h.c.h.c.h.',
    },
  },
};

const NOTE_INDEX = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

function noteFreq(name) {
  const m = /^([A-G]#?)(\d)$/.exec(name);
  if (!m) return 0;
  const midi = (Number(m[2]) + 1) * 12 + NOTE_INDEX[m[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** A line becomes one entry per sixteenth: null, or { freq, open, steps }. */
function parse(line) {
  const tokens = line.replace(/\|/g, ' ').trim().split(/\s+/);
  return tokens.map((tok, i) => {
    if (tok === '.' || tok === '-') return null;
    let steps = 1;
    while (tokens[i + steps] === '-') steps++;
    const open = tok.endsWith('!');
    return { freq: noteFreq(open ? tok.slice(0, -1) : tok), open, steps };
  });
}

for (const song of Object.values(SONGS)) {
  song.guitarNotes = parse(song.guitar);
  song.leadNotes = parse(song.lead);
}

let distortionCurve = null;

/** A soft-clipping curve: a hot signal in, a saturated, crunchy one out. */
function curve() {
  if (distortionCurve) return distortionCurve;
  const n = 2048;
  distortionCurve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    distortionCurve[i] = Math.tanh(x * 3) / Math.tanh(3);
  }
  return distortionCurve;
}

function filter(type, freq, q = 0.7, gain = 0) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  f.gain.value = gain;
  return f;
}

/**
 * An amp and speaker cabinet: drive, clipping, then filters that cut the
 * fizz and scoop the mids. Returns its input and output nodes.
 */
function amp(out, drive, tone, vol) {
  const input = ctx.createGain();
  input.gain.value = drive;
  const shaper = ctx.createWaveShaper();
  shaper.curve = curve();
  shaper.oversample = '4x';
  const chain = [
    shaper,
    filter('highpass', 85),
    filter('peaking', 110, 1, 4),
    filter('peaking', 750, 0.9, -5),
    filter('peaking', 2200, 1.2, 3),
    filter('lowpass', tone, 0.8),
    filter('lowpass', tone * 1.6, 0.6),
  ];
  const level = ctx.createGain();
  level.gain.value = vol;
  let node = input;
  for (const n of chain) node = node.connect(n);
  node.connect(level).connect(out);
  return { input, level };
}

/** The nodes a song plays through; dropped (after a fade) when it stops. */
function makeRig() {
  const out = ctx.createGain();
  out.gain.value = 1;
  out.connect(musicBus);
  const rhythm = amp(out, 9, 3600, 0.16).input;
  const lead = amp(out, 6, 4200, 0.09);
  // A slap of delay so the lead sits behind the riff.
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.27;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.3;
  const wet = ctx.createGain();
  wet.gain.value = 0.35;
  lead.level.connect(delay).connect(feedback).connect(delay);
  delay.connect(wet).connect(out);
  const bass = ctx.createGain();
  bass.gain.value = 0.5;
  bass.connect(filter('lowpass', 900)).connect(out);
  const drums = ctx.createGain();
  drums.gain.value = 0.9;
  drums.connect(out);
  return { out, rhythm, lead: lead.input, bass, drums };
}

/** One oscillator with an attack-hold-release envelope into `dest`. */
function voice(dest, type, freq, t, dur, vol, detune = 0) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.004);
  g.gain.setValueAtTime(vol, t + Math.max(0.005, dur - 0.03));
  g.gain.linearRampToValueAtTime(0, t + dur);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.01);
  return osc;
}

/** Root, fifth and octave, double-tracked; muted notes are dark and short. */
function powerChord(rig, note, t, len) {
  const dur = note.open ? note.steps * len : len * 0.8;
  const tone = filter('lowpass', note.open ? 5200 : 900, note.open ? 0.7 : 1.4);
  tone.connect(rig.rhythm);
  for (const ratio of [1, 1.4983, 2]) {
    for (const d of [-9, 9]) voice(tone, 'sawtooth', note.freq * ratio, t, dur, 0.13, d);
  }
  voice(rig.bass, 'sawtooth', note.freq / 2, t, dur, 0.5);
  voice(rig.bass, 'sine', note.freq / 2, t, dur, 0.6);
}

/** A singing lead note with a little vibrato once it has rung a while. */
function leadNote(rig, note, t, len) {
  const dur = note.steps * len;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5.5;
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(0, t);
  depth.gain.linearRampToValueAtTime(0, t + 0.15);
  depth.gain.linearRampToValueAtTime(note.freq * 0.012, t + 0.4);
  lfo.connect(depth);
  for (const d of [-5, 6]) {
    const osc = voice(rig.lead, 'sawtooth', note.freq, t, dur, 0.2, d);
    depth.connect(osc.frequency);
  }
  lfo.start(t);
  lfo.stop(t + dur + 0.02);
}

function hit(dest, { dur, vol, type = 'bandpass', from, to = from, q = 0.8 }, t) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const f = filter(type, from, q);
  if (to !== from) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

function thump(dest, from, to, dur, vol, t) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

const DRUMS = {
  k(d, t) {
    thump(d, 160, 42, 0.16, 0.9, t);
    hit(d, { dur: 0.012, vol: 0.35, type: 'highpass', from: 3000 }, t);
  },
  s(d, t) {
    thump(d, 230, 170, 0.08, 0.45, t);
    hit(d, { dur: 0.2, vol: 0.55, from: 2200, to: 1500, q: 0.6 }, t);
  },
  h: (d, t) => hit(d, { dur: 0.035, vol: 0.12, type: 'highpass', from: 8000 }, t),
  o: (d, t) => hit(d, { dur: 0.22, vol: 0.12, type: 'highpass', from: 7000 }, t),
  r: (d, t) => hit(d, { dur: 0.3, vol: 0.08, from: 6000, q: 2 }, t),
  c: (d, t) => hit(d, { dur: 1.3, vol: 0.22, type: 'highpass', from: 4500 }, t),
};

let current = null;
let rig = null;
let step = 0;
let nextTime = 0;
let timer = null;

function scheduleStep(song, i, t) {
  const len = 60 / song.bpm / 4;
  const g = song.guitarNotes[i % song.guitarNotes.length];
  if (g) powerChord(rig, g, t, len);
  const l = song.leadNotes[i % song.leadNotes.length];
  if (l) leadNote(rig, l, t, len);
  for (const row of Object.values(song.drums)) {
    const d = row[i % row.length];
    if (DRUMS[d]) DRUMS[d](rig.drums, t);
  }
}

function tick() {
  if (!ctx || !current || ctx.state !== 'running') return;
  if (!rig) rig = makeRig();
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
  if (rig && ctx) {
    // Fade the old song out; its ringing notes go with it.
    const old = rig.out;
    old.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
    setTimeout(() => old.disconnect(), 400);
  }
  rig = null;
  if (!timer) timer = setInterval(tick, 30);
}
