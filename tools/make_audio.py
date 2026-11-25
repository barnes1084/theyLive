"""Renders the game's music and sound effects to WAV files.

Music: original heavy-metal loops played by a synthesized band (two
distorted rhythm guitars panned left and right, a lead guitar, bass, and
drums with double kick):
- title.wav: a mid-tempo menacing riff in E Phrygian
- city.wav: a driving gallop for the streets
- tunnel.wav: a darker, faster thrash riff for the sewers
- boss.wav: a slow, crushing half-time riff for the temple

Sound effects: guns (spread gun, machine gun, nail gun, torch, slugs),
plasma shots, jumps, hits, the portal, the shades, the idol's roar and
stomps, and the jingles for clearing a stage and game over.

Run: python3 tools/make_audio.py   (writes assets/audio/*.wav; needs numpy and scipy)
"""
import os
import wave

import numpy as np
from scipy import signal

SR = 32000
rng = np.random.default_rng(7)
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'audio')
os.makedirs(out, exist_ok=True)


# ---------- Building blocks ----------

def t_axis(sec):
    return np.arange(int(SR * sec)) / SR


def env(n, attack, decay, sustain=0.0, release=None):
    x = np.arange(n) / SR
    e = np.minimum(1, x / max(attack, 1e-4))
    d = sustain + (1 - sustain) * np.exp(-np.maximum(0, x - attack) / max(decay, 1e-4) * 4)
    e = e * d
    if release:
        tail = int(release * SR)
        if tail < n:
            e[-tail:] *= np.linspace(1, 0, tail)
    return e


def lowpass(x, f, order=2):
    b, a = signal.butter(order, min(0.99, f / (SR / 2)), 'low')
    return signal.lfilter(b, a, x)


def highpass(x, f, order=2):
    b, a = signal.butter(order, min(0.99, f / (SR / 2)), 'high')
    return signal.lfilter(b, a, x)


def bandpass(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), min(0.99, hi / (SR / 2))], 'band')
    return signal.lfilter(b, a, x)


def sweep_lowpass(x, f0, f1):
    """A one-pole lowpass whose cutoff glides from f0 to f1."""
    n = len(x)
    f = f0 * (f1 / f0) ** (np.arange(n) / max(1, n - 1))
    a = 1 - np.exp(-2 * np.pi * f / SR)
    y = np.empty(n)
    s = 0.0
    for i in range(n):
        s += a[i] * (x[i] - s)
        y[i] = s
    return y


def noise(sec):
    return rng.uniform(-1, 1, int(SR * sec))


def osc(sec, f, kind='saw', slide=1.0, detune=0.0):
    x = t_axis(sec)
    freq = f * slide ** (x / max(sec, 1e-4)) * (1 + detune)
    ph = 2 * np.pi * np.cumsum(freq) / SR
    if kind == 'sine':
        return np.sin(ph)
    if kind == 'tri':
        return 2 / np.pi * np.arcsin(np.sin(ph))
    if kind == 'square':
        return np.sign(np.sin(ph))
    return 2 * ((ph / (2 * np.pi)) % 1) - 1


def place(buf, x, at):
    i = int(at * SR)
    if i >= len(buf):
        return
    end = min(len(buf), i + len(x))
    buf[i:end] += x[: end - i]


def save(name, x, peak=0.9):
    """Writes mono or stereo (2 x n) audio, normalised to peak."""
    x = np.asarray(x, dtype=float)
    m = np.max(np.abs(x)) or 1.0
    x = x / m * peak
    stereo = x.ndim == 2
    data = (np.clip(x.T if stereo else x, -1, 1) * 32767).astype('<i2').tobytes()
    with wave.open(os.path.join(out, f'{name}.wav'), 'wb') as w:
        w.setnchannels(2 if stereo else 1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data)


midi = lambda m: 440.0 * 2 ** ((m - 69) / 12)


# ---------- The band ----------

def amp(x, drive=14.0):
    """Guitar amp: pre-emphasis, hard asymmetric clipping, then a 4x12 cabinet."""
    x = highpass(x, 90)
    x = np.tanh(x * drive + 0.15) - np.tanh(0.15)
    x = np.tanh(x * 2.5)
    # 4x12 cabinet: steep rolloff above ~4 kHz, a low-mid body and a small
    # presence bump; this is what turns raw clipping into a guitar tone.
    x = lowpass(x, 3800, 4)
    x = lowpass(x, 6000, 2)
    x = x + 0.6 * bandpass(x, 90, 220) + 0.2 * bandpass(x, 1800, 2800)
    return x * 0.5


def power_chord(root, sec, mute=False, detune=0.0):
    """Root, fifth and octave through the amp. Palm-muted chugs are short,
    darker and punchier."""
    n = int(SR * sec)
    raw = sum(osc(sec, midi(root + i), 'saw', detune=detune + d) for i, d in ((0, 0.0), (7, 0.0015), (12, -0.001)))
    raw = raw * (env(n, 0.002, 0.08, 0.15, 0.02) if mute else env(n, 0.003, 0.9, 0.7, 0.04))
    g = amp(raw, 16 if mute else 12)
    if mute:
        g = lowpass(g, 1600, 2)
    return g


def lead_note(note, sec):
    """A singing lead: slight bend up into the note and vibrato, through the amp."""
    n = int(SR * sec)
    x = t_axis(sec)
    f = midi(note) * (1 - 0.02 * np.exp(-x * 30)) * (1 + 0.006 * np.sin(2 * np.pi * 5.5 * x) * np.minimum(1, x * 4))
    ph = 2 * np.pi * np.cumsum(f) / SR
    raw = (2 * ((ph / (2 * np.pi)) % 1) - 1) * 0.7 + 0.3 * np.sin(ph * 2)
    raw *= env(n, 0.005, sec * 2, 0.85, 0.03)
    return amp(raw, 9) * 0.9


def bass_note(note, sec):
    n = int(SR * sec)
    raw = osc(sec, midi(note), 'saw') * 0.6 + osc(sec, midi(note), 'square') * 0.4
    raw *= env(n, 0.003, 0.4, 0.6, 0.02)
    return np.tanh(lowpass(raw, 900, 2) * 2.0)


def kick():
    sec = 0.18
    n = int(SR * sec)
    body = osc(sec, 120, 'sine', slide=0.33) * env(n, 0.001, 0.12)
    click = highpass(noise(0.01), 2000) * 0.6
    k = body.copy()
    k[: len(click)] += click * np.linspace(1, 0, len(click))
    return np.tanh(k * 1.8)


def snare():
    sec = 0.22
    n = int(SR * sec)
    tone = osc(sec, 190, 'tri', slide=0.8) * env(n, 0.001, 0.06) * 0.6
    rattle = bandpass(noise(sec), 1500, 9000) * env(n, 0.001, 0.12)
    return np.tanh((tone + rattle) * 1.6)


def hat(open_=False):
    sec = 0.25 if open_ else 0.05
    return highpass(noise(sec), 7000, 4) * env(int(SR * sec), 0.001, 0.15 if open_ else 0.02) * 0.5


def crash():
    sec = 1.6
    return highpass(noise(sec), 4000, 2) * env(int(SR * sec), 0.002, 1.2) * 0.6


def bell(note, sec):
    """Glockenspiel: bright sine partials with a fast decay."""
    n = int(SR * sec)
    f = midi(note + 24)
    x = osc(sec, f, 'sine') + 0.4 * osc(sec, f * 2.76, 'sine') * env(n, 0.001, 0.1) + 0.2 * osc(sec, f * 5.4, 'sine') * env(n, 0.001, 0.05)
    return x * env(n, 0.001, sec * 0.7)


def sleigh():
    return highpass(noise(0.12), 6500, 2) * env(int(SR * 0.12), 0.002, 0.07) * 0.5


def render_song(name, bpm, bars, melody, riff, drums, bells=None, sleigh_bells=False, tail_fold=True, lead_gain=1.0):
    """Lays out one loop of a song.
    melody: [(midi or 0, beats)], played by the lead guitar from beat 0.
    riff(bar) -> [(beat in bar, root, beats, muted)], the rhythm guitars and bass.
    drums(bar) -> [(beat in bar, 'k'/'s'/'h'/'o'/'c')]."""
    beat = 60.0 / bpm
    total = bars * 4 * beat
    n = int(SR * (total + 2))
    left = np.zeros(n)
    right = np.zeros(n)
    centre = np.zeros(n)
    kit = {'k': kick(), 's': snare(), 'h': hat(), 'o': hat(True), 'c': crash()}
    for bar in range(bars):
        for b, root, length, muted in riff(bar):
            at = (bar * 4 + b) * beat
            sec = length * beat * (0.9 if muted else 0.98)
            # Double-tracked: two slightly different takes hard left and right.
            place(left, power_chord(root, sec, muted, detune=0.0008), at)
            place(right, power_chord(root, sec, muted, detune=-0.0008), at + 0.006)
            place(centre, bass_note(root - 12, sec) * 0.8, at)
        for b, piece in drums(bar):
            place(centre, kit[piece] * {'k': 1.1, 's': 0.9, 'c': 0.5}.get(piece, 0.45), (bar * 4 + b) * beat)
    pos = 0.0
    for note, length in melody:
        if note:
            place(centre, lead_note(note, length * beat) * 0.45 * lead_gain, pos * beat)
            if bells:
                place(left, bell(note, min(1.2, length * beat + 0.4)) * 0.12, pos * beat)
                place(right, bell(note, min(1.2, length * beat + 0.4)) * 0.12, pos * beat)
        pos += length
    if sleigh_bells:
        k = 0
        while k * beat / 2 < total:
            place(left, sleigh() * (0.5 if k % 2 == 0 else 0.25), k * beat / 2)
            place(right, sleigh() * (0.25 if k % 2 == 0 else 0.5), k * beat / 2 + 0.01)
            k += 1
    mix_l = left * 0.32 + centre
    mix_r = right * 0.32 + centre
    L = int(SR * total)
    if tail_fold:
        # Fold the ring-out past the end back onto the start so the loop is seamless.
        for ch in (mix_l, mix_r):
            ch[: n - L] += ch[L:]
    stereo = np.vstack([mix_l[:L], mix_r[:L]])
    # Master: normalise, then a gentle soft knee on the loudest peaks only.
    stereo = stereo / (np.percentile(np.abs(stereo), 99.9) or 1.0) * 0.8
    stereo = np.where(np.abs(stereo) > 0.7, np.sign(stereo) * (0.7 + 0.3 * np.tanh((np.abs(stereo) - 0.7) / 0.3)), stereo)
    # A short crossfade across the loop point so it never clicks.
    fade = int(SR * 0.01)
    ramp = np.linspace(0, 1, fade)
    for ch in stereo:
        ch[-fade:] *= ramp[::-1]
        ch[:fade] *= ramp
    save(name, stereo, 0.85)
    print(f'{name}.wav  {total:.1f} s')


def gallop_drums(bar):
    """Fast double-kick 16ths, snare on 2 and 4, crash at the top of every 4 bars."""
    hits = [(i * 0.25, 'k') for i in range(16)]
    hits += [(1, 's'), (3, 's')]
    hits += [(i * 0.5, 'h') for i in range(8)]
    if bar % 4 == 0:
        hits.append((0, 'c'))
    return hits


def half_time_drums(bar):
    """Heavy: kick on the beat, snare on 3, crash every 2 bars."""
    hits = [(0, 'k'), (0.75, 'k'), (1.5, 'k'), (2, 's'), (3, 'k'), (3.5, 'k')]
    hits += [(i * 0.5, 'o' if i % 4 == 3 else 'h') for i in range(8)]
    if bar % 2 == 0:
        hits.append((0, 'c'))
    return hits


# ---------- Songs (original riffs) ----------

E2 = 40


def phrygian_riff(pattern):
    """pattern: list of (beat, semitones above E2, beats, muted) per bar, cycled."""
    def riff(bar):
        return [(b, E2 + s, l, m) for b, s, l, m in pattern[bar % len(pattern)]]
    return riff


def chug_bar(root, accent=(0,), push=True):
    out = []
    for i in range(8):
        b = i * 0.5
        out.append((b, root, 0.5, b not in accent))
    if push:
        out[-1] = (3.5, root, 0.25, True)
        out.append((3.75, root, 0.25, True))
    return out


def title_song():
    bars = []
    for k, root in enumerate([0, 0, 1, 0, 0, 0, 3, 1]):
        bars.append([(b, s, l, m) for b, s, l, m in chug_bar(root, accent=(0, 1.5, 3))])
    melody = [(64, 2), (65, 1), (64, 1), (67, 2), (65, 2), (64, 4), (0, 4),
              (64, 2), (65, 1), (67, 1), (70, 2), (69, 2), (67, 3), (65, 1), (64, 4)]
    render_song('title', 132, 8, [(m + 12 if m else 0, b) for m, b in melody], phrygian_riff(bars), half_time_drums, lead_gain=0.8)


def city_song():
    pattern = []
    for root in [0, 0, 0, 1, 0, 0, 5, 3, 0, 0, 0, 1, 7, 5, 3, 1]:
        bar = [(0, root, 1, False)]
        for b in (1, 2, 3):
            bar += [(b, root, 0.5, True), (b + 0.5, root, 0.25, True), (b + 0.75, root, 0.25, True)]
        pattern.append(bar)
    melody = [(0, 16), (76, 1), (77, 1), (76, 1), (74, 1), (72, 2), (71, 2), (72, 1), (71, 1), (69, 1), (67, 1), (64, 4),
              (0, 16), (76, 1), (79, 1), (77, 1), (76, 1), (74, 2), (76, 2), (77, 2), (76, 1), (74, 1), (76, 4)]
    render_song('city', 160, 16, melody, phrygian_riff(pattern), gallop_drums, lead_gain=0.7)


def tunnel_song():
    pattern = []
    for root in [0, 0, 1, 0, 3, 1, 0, 6]:
        pattern.append([(i * 0.25, root if i % 4 else root, 0.25, i % 8 != 0) for i in range(16)])
    melody = [(0, 8), (64, 0.5), (65, 0.5), (67, 0.5), (65, 0.5), (64, 1), (70, 1), (69, 2), (67, 2), (0, 8),
              (64, 0.5), (65, 0.5), (67, 0.5), (70, 0.5), (71, 1), (70, 1), (67, 2), (64, 2)]
    render_song('tunnel', 176, 8, [(m + 12 if m else 0, b) for m, b in melody], phrygian_riff(pattern), gallop_drums, lead_gain=0.65)


def boss_song():
    pattern = []
    for root in [0, 0, 1, 0, 0, 6, 5, 1]:
        pattern.append([(0, root, 1.5, False), (1.5, root, 0.25, True), (1.75, root, 0.25, True), (2, root + (1 if root == 0 else -1), 1.5, False), (3.5, root, 0.25, True), (3.75, root, 0.25, True)])
    melody = [(64, 4), (65, 2), (64, 2), (70, 4), (69, 4), (64, 4), (65, 2), (67, 2), (64, 8)]
    render_song('boss', 108, 8, [(m + 12, b) for m, b in melody], phrygian_riff(pattern), half_time_drums, lead_gain=0.9)


# ---------- Sound effects ----------

def gun(sec, body_f, crack, tail, k=0):
    n = int(SR * sec)
    boom = osc(sec, body_f, 'sine', slide=0.4) * env(n, 0.001, tail * 0.6)
    burst = bandpass(noise(sec), 300 + 200 * k, 6000) * env(n, 0.001, crack)
    return np.tanh((boom * 0.9 + burst) * 2.2)


def zap(f0, f1, sec):
    n = int(SR * sec)
    return (osc(sec, f0, 'square', slide=f1 / f0) * 0.5 + osc(sec, f0 * 1.01, 'saw', slide=f1 / f0) * 0.4) * env(n, 0.002, sec * 0.7)


def whoosh(sec, lo, hi):
    n = noise(sec)
    return sweep_lowpass(highpass(n, lo * 0.7), lo, hi) * env(len(n), sec * 0.3, sec * 0.6)


def boom(sec, f=70):
    n = int(SR * sec)
    return np.tanh((osc(sec, f, 'sine', slide=0.35) * env(n, 0.002, sec * 0.7) + lowpass(noise(sec), 900) * env(n, 0.001, sec * 0.5)) * 2.5)


def jingle(notes, gap, hold, wave='square'):
    sec = gap * len(notes) + hold
    x = np.zeros(int(SR * sec))
    for i, m in enumerate(notes):
        tone = osc(hold, midi(m), wave) * 0.5 + osc(hold, midi(m + 12), 'tri') * 0.3
        place(x, tone * env(int(SR * hold), 0.005, hold * 0.6), i * gap)
    return x


def make_effects():
    save('shotgun', gun(0.35, 110, 0.12, 0.3), 0.8)
    save('mg', gun(0.12, 160, 0.04, 0.08, 2), 0.55)
    save('nail', zap(1800, 900, 0.07) * 0.4 + bandpass(noise(0.07), 3000, 8000) * env(int(SR * 0.07), 0.001, 0.03), 0.45)
    save('torch', whoosh(0.3, 300, 2500) + lowpass(noise(0.3), 400) * env(int(SR * 0.3), 0.05, 0.2) * 0.6, 0.5)
    save('slug', gun(0.45, 80, 0.1, 0.4, 1), 0.9)
    save('plasma', zap(900, 300, 0.25), 0.4)
    save('jump', zap(300, 600, 0.12) * 0.6, 0.3)
    save('land', lowpass(noise(0.08), 600) * env(int(SR * 0.08), 0.001, 0.04), 0.3)
    save('hit', bandpass(noise(0.1), 800, 4000) * env(int(SR * 0.1), 0.001, 0.05) + osc(0.1, 220, 'square', slide=0.5) * env(int(SR * 0.1), 0.001, 0.06) * 0.4, 0.5)
    save('hurt', osc(0.3, 300, 'saw', slide=0.4) * env(int(SR * 0.3), 0.002, 0.2) + boom(0.3, 120) * 0.5, 0.7)
    for k in range(3):
        x = osc(0.35, 500 + 120 * k, 'saw', slide=0.25) * env(int(SR * 0.35), 0.003, 0.25)
        x += bandpass(noise(0.35), 1500, 5000) * env(int(SR * 0.35), 0.001, 0.08) * 0.6
        save(f'die{k}', np.tanh(x * 1.5), 0.6)
    save('innocent', jingle([64, 63, 62, 61], 0.1, 0.35, 'saw'), 0.55)
    save('reveal', zap(200, 800, 0.35) + osc(0.35, 100, 'saw') * env(int(SR * 0.35), 0.01, 0.3) * 0.5, 0.5)
    x = np.zeros(int(SR * 0.6))
    place(x, zap(200, 1600, 0.4), 0)
    place(x, osc(0.5, 880, 'sine', slide=2) * env(int(SR * 0.5), 0.02, 0.4) * 0.5, 0.05)
    save('portal', x, 0.5)
    save('glasses_on', jingle([76, 83], 0.06, 0.15, 'tri'), 0.4)
    save('glasses_off', jingle([83, 76], 0.06, 0.15, 'tri'), 0.35)
    save('headache', osc(0.6, 620, 'square', slide=0.97) * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * t_axis(0.6))) * env(int(SR * 0.6), 0.01, 0.5), 0.45)
    save('found', jingle([72, 76, 79, 84], 0.07, 0.3, 'tri'), 0.5)
    save('pickup', jingle([79, 84], 0.05, 0.12, 'square'), 0.4)
    save('tackle', whoosh(0.22, 200, 1500) + boom(0.22, 90) * 0.4, 0.6)
    save('explode', boom(0.9, 55), 0.95)
    save('stomp', boom(0.4, 45), 0.8)
    x = whoosh(1.0, 100, 900) + osc(1.0, 200, 'saw', slide=0.25) * env(int(SR * 1.0), 0.05, 0.8) * 0.3
    save('descend', x, 0.6)
    roar = osc(1.2, 70, 'saw', slide=0.7) + osc(1.2, 72.5, 'saw', slide=0.68) + bandpass(noise(1.2), 150, 900) * 1.5
    save('roar', amp(roar * env(int(SR * 1.2), 0.1, 0.9, 0.5, 0.3) * 0.5, 6), 0.9)
    save('clear', jingle([64, 67, 71, 76, 79, 83, 88], 0.09, 0.9, 'square'), 0.6)
    save('gameover', jingle([71, 70, 69, 64], 0.3, 1.0, 'saw'), 0.6)
    save('tick', osc(0.06, 1200, 'sine') * env(int(SR * 0.06), 0.002, 0.03), 0.25)


if __name__ == '__main__':
    for f in os.listdir(out):
        if f.endswith('.wav'):
            os.remove(os.path.join(out, f))
    make_effects()
    title_song()
    city_song()
    tunnel_song()
    boss_song()
    print('wrote', len([f for f in os.listdir(out) if f.endswith('.wav')]), 'files')
