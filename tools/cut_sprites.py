"""Cuts the character sheets in art-source/ into one image per pose.

Each sheet holds one or more characters, each in its own bordered panel (or
the whole sheet), with the poses in rows, read left to right. SHEETS below
says which character is in which panel and which pose each figure is. For
every sheet this:
- erases the panel borders and makes the plain white background clear,
- finds the figures row by row (small detached bits, like a ball or flying
  rocks, join the nearest figure),
- puts every pose of a character at one scale (sheets were drawn at
  different sizes; the figures' area tells them apart),
- records where the feet and head are.

Run: python3 tools/cut_sprites.py   (writes assets/sprites/<character>/<pose>.png
and assets/sprites/meta.json)
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
src_dir = os.path.join(root, 'art-source')
out_dir = os.path.join(root, 'assets', 'sprites')

CIV_ROWS = [['idle', 'walk1', 'walk2', 'walk3', 'stare', 'attack'], ['flee1', 'flee2', 'flee3', 'panic', 'hit', 'down']]
KID_ROWS = [['idle', 'ball', 'hop', 'walk1', 'walk2', 'walk3', 'walk4'], ['run1', 'run2', 'run3', 'carried', 'scared', 'wave']]
HERO_1 = [['idle', 'aimup', 'aimupfwd', 'aimdownfwd'], ['crouch', 'tackle', 'hit', 'down']]
HERO_2 = [['run1', 'run2', 'run3', 'run4', 'run5', 'run6'], ['runup1', 'runup2', 'runup3', 'rundown1', 'rundown2', 'rundown3']]

# file: (panel grid (cols, rows), [(character, rows of poses) per panel, row-major])
# A character name of None skips that row (duplicates).
SHEETS = {
    'hero-1.png': ((1, 1), [('hero', HERO_1)]),
    'heroshades-1.png': ((1, 1), [('heroshades', HERO_1)]),
    'hero-2.png': ((1, 1), [('hero', HERO_2)]),
    'heroshades-2.png': ((1, 1), [('heroshades', HERO_2)]),
    'hero-3.png': ((1, 1), [({0: 'hero', 1: 'heroshades'}, [['jump', 'ball', 'fall', 'land'], ['jump', 'ball', 'fall', 'land']])]),
    'hero-4.png': ((1, 1), [({0: 'hero', 1: 'heroshades'}, [['shades', 'portal', 'victory'], ['shades', 'portal', 'victory']])]),
    'civilians.png': ((2, 3), [(f'civ{i}', CIV_ROWS) for i in range(1, 7)]),
    'civilian-lizard.png': ((2, 3), [(f'civ{i}liz', CIV_ROWS) for i in range(1, 7)]),
    'sewer-lizards.png': ((2, 2), [
        ('grunt', [['idle', 'walk1', 'walk2', 'walk3', 'attack', 'emerge'], ['run1', 'run2', 'run3', 'run4', 'hit', 'down']]),
        ('gunner', [['idle', 'walk1', 'walk2', 'walk3', 'walk4', 'emerge'], ['aim', 'shoot', 'aimup', 'crouchshoot', 'hit', 'down']]),
        ('snatcher', [['idle', 'walk1', 'walk2', 'walk3', 'walk4'], ['run1', 'run2', 'run3', 'run4', 'grab']]),
        ('snatcher', [['carry1', 'carry2', 'carry3', 'carry4'], ['warp', 'emerge', 'hit', 'down']]),
    ]),
    'children.png': ((2, 2), [(f'kid{i}', KID_ROWS) for i in range(1, 5)]),
    'cultists.png': ((1, 2), [
        ('zealot', [['idle', 'chant1', 'chant2', 'walk1', 'walk2', 'walk3', 'walk4', 'attack'], ['run1', 'run2', 'run3', 'run4', 'hit', 'down']]),
        ('priest', [['idle', 'chant1', 'chant2', 'walk1', 'walk2', 'walk3'], ['walk4', 'attack', 'hit', 'collapse', 'down']]),
    ]),
    'moloch.png': ((2, 1), [
        ('moloch', [['dormant', 'waking', 'idle', 'walk1'], ['walk2', 'walk3', 'walk4', 'spit']]),
        ('moloch', [['breath', 'leapcrouch', 'leapair', 'slam'], ['summon', 'hurt', 'rage', 'crumble']]),
    ]),
}

# Lizard versions of the civilians are drawn at the people's scale.
SCALE_LIKE = {f'civ{i}liz': f'civ{i}' for i in range(1, 7)}


def find_borders(a):
    """Rows and columns that are long thin dark lines (panel borders)."""
    px = a[..., :3].astype(int)
    dark = px.min(axis=2) < 200
    h, w = dark.shape
    rows = [y for y in range(h) if longest_run(dark[y]) > w * 0.4]
    cols = [x for x in range(w) if longest_run(dark[:, x]) > h * 0.6]
    return rows, cols


def longest_run(v):
    if not v.any():
        return 0
    d = np.diff(np.concatenate([[0], v.astype(int), [0]]))
    starts, ends = np.where(d == 1)[0], np.where(d == -1)[0]
    return int((ends - starts).max())


def clusters(vals, gap=6):
    out = []
    for v in vals:
        if out and v - out[-1][-1] <= gap:
            out[-1].append(v)
        else:
            out.append([v])
    return out


def key_out(a):
    """Clears the plain light background: everything light joined to the edges."""
    px = a[..., :3].astype(int)
    light = (px.min(axis=2) > 222) & (px.max(axis=2) - px.min(axis=2) < 30)
    lab, _ = ndimage.label(light)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, edge[edge > 0])
    a[bg, 3] = 0
    near = ndimage.binary_dilation(bg, iterations=2) & ~bg
    a[near & (px.min(axis=2) > 175), 3] = 0
    return a


def drop_thin_lines(a, length=90, width=6):
    """Clears long straight lines only a few pixels thick (border leftovers)
    that a figure's own shapes never are."""
    m = a[..., 3] > 0
    thick_x = ndimage.binary_opening(m, structure=np.ones((1, width + 1)))
    thick_y = ndimage.binary_opening(m, structure=np.ones((width + 1, 1)))
    thin_v = m & ~thick_x
    thin_h = m & ~thick_y
    lines = ndimage.binary_opening(thin_v, structure=np.ones((length, 1))) | ndimage.binary_opening(thin_h, structure=np.ones((1, length)))
    lines = ndimage.binary_dilation(lines, iterations=2)
    a[lines, 3] = 0
    return a


def panels(a, grid):
    """Splits the sheet into its bordered panels (or one panel if no borders)."""
    rows, cols = find_borders(a)
    h, w = a.shape[:2]
    # Erase the border lines so the background behind them is clear.
    for y in rows:
        a[max(0, y - 3) : y + 4, :, :3] = 255
    for x in cols:
        a[:, max(0, x - 3) : x + 4, :3] = 255
    gx, gy = grid

    def cuts(lines, n, size):
        """Where panels meet: one per pair of borders between neighbours,
        else equal parts."""
        even = [round(size * i / n) for i in range(n + 1)]
        if n == 1:
            return even
        seps = [int(np.mean(c)) for c in clusters(lines, gap=20)]
        seps = [x for x in seps if 15 < x < size - 15]
        if len(seps) < n - 1:
            return even
        chosen = sorted(min(seps, key=lambda x: abs(x - e)) for e in even[1:-1])
        return [0] + chosen + [size]

    xc = cuts(cols, gx, w)
    yc = cuts(rows, gy, h)
    out = []
    for j in range(gy):
        for i in range(gx):
            out.append((xc[i], yc[j], xc[i + 1], yc[j + 1]))
    return a, out


def figures(a, nrows, counts):
    """The figures in a panel, row by row, left to right."""
    m = a[..., 3] > 30
    lab, n = ndimage.label(ndimage.binary_dilation(m, iterations=2))
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    objs = ndimage.find_objects(lab)
    if n == 0:
        return []
    big = [i for i in range(n) if sizes[i] > sizes.max() * 0.15]
    cy = np.array([(objs[i][0].start + objs[i][0].stop) / 2 for i in big])
    order = np.argsort(cy)
    cys = cy[order]
    if nrows > 1:
        gaps = np.argsort(np.diff(cys))[-(nrows - 1):]
        bounds = sorted((cys[g] + cys[g + 1]) / 2 for g in gaps)
    else:
        bounds = []
    edges = [-1] + bounds + [1e9]
    rows = [[] for _ in range(nrows)]
    for i in big:
        c = (objs[i][0].start + objs[i][0].stop) / 2
        r = next(k for k in range(nrows) if edges[k] <= c < edges[k + 1])
        rows[r].append(i)
    out = []
    for r, members in enumerate(rows):
        masks = [lab == i + 1 for i in members]
        want = counts[r]
        while len(masks) > want:
            # Two pieces of one figure: merge the closest pair.
            masks.sort(key=lambda mk: np.where(mk.any(axis=0))[0].min())
            gaps = [np.where(masks[k + 1].any(axis=0))[0].min() - np.where(masks[k].any(axis=0))[0].max() for k in range(len(masks) - 1)]
            k = int(np.argmin(gaps))
            masks[k : k + 2] = [masks[k] | masks[k + 1]]
        while len(masks) < want:
            widest = max(range(len(masks)), key=lambda k: np.ptp(np.where(masks[k].any(axis=0))[0]))
            masks[widest : widest + 1] = split(masks[widest])
        masks.sort(key=lambda mk: np.where(mk.any(axis=0))[0].min())
        # Small detached bits join the nearest figure in this row if close.
        for i in range(n):
            if i in big or sizes[i] < 15:
                continue
            sl = objs[i]
            c = ((sl[1].start + sl[1].stop) / 2, (sl[0].start + sl[0].stop) / 2)
            if not (edges[r] <= c[1] < edges[r + 1]):
                continue
            best, bd = None, 1e9
            for k, mk in enumerate(masks):
                ys, xs = np.where(mk)
                d = max(xs.min() - c[0], 0, c[0] - xs.max()) + max(ys.min() - c[1], 0, c[1] - ys.max())
                if d < bd:
                    best, bd = k, d
            if best is not None and bd < 40:
                masks[best] = masks[best] | (lab == i + 1)
        for mk in masks:
            mk = mk & m
            ys, xs = np.where(mk)
            crop = np.zeros_like(a)
            crop[mk] = a[mk]
            out.append(crop[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1])
    return out


def split(mk):
    xs = np.where(mk.any(axis=0))[0]
    x0, x1 = xs.min(), xs.max()
    cols = mk[:, x0 : x1 + 1].sum(axis=0)
    lo, hi = int(len(cols) * 0.3), int(len(cols) * 0.7)
    cut = x0 + lo + int(np.argmin(cols[lo:hi]))
    left, right = mk.copy(), mk.copy()
    left[:, cut:] = False
    right[:, :cut] = False
    return [left, right]


def anchors(img):
    m = img[..., 3] > 60
    ys, xs = np.where(m)
    foot_y = int(ys.max())
    low = m[max(0, foot_y - 6) : foot_y + 1].any(axis=0)
    fx = np.where(low)[0]
    top = int(ys.min())
    head_rows = m[top : top + max(1, (foot_y - top) // 5)]
    hx = np.where(head_rows.any(axis=0))[0]
    return {
        'foot': [round((fx.min() + fx.max()) / 2, 1), foot_y],
        'center_x': round((xs.min() + xs.max()) / 2, 1),
        'top': top,
        'head': [round((hx.min() + hx.max()) / 2, 1), top + (foot_y - top) // 6],
    }


def main():
    cut = {}  # (char, pose) -> (image, sheet key)
    for file, (grid, panel_list) in SHEETS.items():
        a = np.asarray(Image.open(os.path.join(src_dir, file)).convert('RGBA')).copy()
        a, rects = panels(a, grid)
        a = drop_thin_lines(key_out(a))
        if len(rects) != len(panel_list):
            sys.exit(f'{file}: {len(rects)} panels, expected {len(panel_list)}')
        for p, ((x0, y0, x1, y1), (who, rows)) in enumerate(zip(rects, panel_list)):
            part = a[y0:y1, x0:x1]
            figs = figures(part, len(rows), [len(r) for r in rows])
            want = sum(len(r) for r in rows)
            if len(figs) != want:
                sys.exit(f'{file} panel {p}: found {len(figs)} figures, expected {want}')
            k = 0
            for r, poses in enumerate(rows):
                name = who[r] if isinstance(who, dict) else who
                for pose in poses:
                    cut[(name, pose)] = (figs[k], f'{file}#{p}')
                    k += 1
    # One scale per character: each sheet (or panel) is scaled so its median
    # figure area matches the panel the character's idle pose is in.
    def area(img):
        return float((img[..., 3] > 60).sum())
    scale = {}
    for name in {n for n, _ in cut}:
        ref_name = SCALE_LIKE.get(name, name)
        groups = {}
        for (n, pose), (img, key) in cut.items():
            if n == name:
                groups.setdefault(key, []).append(area(img))
        ref_groups = {}
        for (n, pose), (img, key) in cut.items():
            if n == ref_name:
                ref_groups.setdefault(key, []).append(area(img))
        ref_key = cut[(ref_name, 'idle' if (ref_name, 'idle') in cut else next(p for q, p in cut if q == ref_name))][1]
        ref_area = float(np.median(ref_groups[ref_key]))
        for key, areas in groups.items():
            scale[(name, key)] = (ref_area / float(np.median(areas))) ** 0.5
    meta = {}
    pad = 8
    for (name, pose), (img, key) in sorted(cut.items()):
        s = scale[(name, key)]
        im = Image.fromarray(img)
        if abs(s - 1.0) > 0.02:
            im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
        canvas = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2))
        canvas.paste(im, (pad, pad))
        os.makedirs(os.path.join(out_dir, name), exist_ok=True)
        canvas.save(os.path.join(out_dir, name, f'{pose}.png'), optimize=True)
        info = anchors(np.asarray(canvas))
        info['size'] = [canvas.width, canvas.height]
        meta.setdefault(name, {})[pose] = info
    with open(os.path.join(out_dir, 'meta.json'), 'w') as f:
        json.dump(meta, f, indent=1, sort_keys=True)
    print('cut', len(cut), 'poses for', len(meta), 'characters')
    print('scales:', {f'{n} {k.split("#")[0]}': round(v, 2) for (n, k), v in sorted(scale.items()) if abs(v - 1) > 0.02})


if __name__ == '__main__':
    main()
