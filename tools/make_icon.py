"""Makes the app icons from the hero's sprite: his head with the shades on,
over a red-and-black burst. Writes icon.png (512), assets/icons/ios_1024.png
(1024, no transparency, as Apple requires) and store/play-icon.png (512).

Run: python3 tools/make_icon.py   (after tools/cut_sprites.py)
"""
import json
import math
import os

from PIL import Image, ImageDraw, ImageFilter

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')


def icon(size):
    s = size / 1024
    img = Image.new('RGBA', (size, size), (20, 6, 10, 255))
    d = ImageDraw.Draw(img)
    # A burst of rays from behind the head.
    c = (size / 2, size * 0.56)
    for i in range(24):
        a0 = i * math.tau / 24
        a1 = a0 + math.tau / 48
        col = (150, 20, 24, 255) if i % 2 else (90, 10, 16, 255)
        d.polygon([c, (c[0] + math.cos(a0) * size, c[1] + math.sin(a0) * size), (c[0] + math.cos(a1) * size, c[1] + math.sin(a1) * size)], fill=col)
    glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((c[0] - 330 * s, c[1] - 330 * s, c[0] + 330 * s, c[1] + 330 * s), fill=(255, 120, 60, 120))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(80 * s)))
    # The hero's head and shoulders, from the idle pose with shades.
    meta = json.load(open(os.path.join(root, 'assets', 'sprites', 'meta.json')))['heroshades']['idle']
    hero = Image.open(os.path.join(root, 'assets', 'sprites', 'heroshades', 'idle.png'))
    top = meta['top']
    h = meta['foot'][1] - top
    hx = meta['head'][0]
    crop = hero.crop((int(hx - h * 0.32), top, int(hx + h * 0.32), int(top + h * 0.45)))
    k = size * 0.88 / crop.width
    crop = crop.resize((int(crop.width * k), int(crop.height * k)), Image.LANCZOS)
    shadow = Image.new('RGBA', crop.size, (0, 0, 0, 0))
    shadow.putalpha(crop.split()[3].point(lambda v: v * 0.6))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(14 * s)), (int((size - crop.width) / 2 + 12 * s), int(size - crop.height + 18 * s)))
    img.alpha_composite(crop, (int((size - crop.width) / 2), int(size - crop.height)))
    return img


def main():
    os.makedirs(os.path.join(root, 'assets', 'icons'), exist_ok=True)
    os.makedirs(os.path.join(root, 'store'), exist_ok=True)
    big = icon(1024)
    big.convert('RGB').save(os.path.join(root, 'assets', 'icons', 'ios_1024.png'))
    small = big.resize((512, 512), Image.LANCZOS)
    small.save(os.path.join(root, 'icon.png'))
    small.convert('RGB').save(os.path.join(root, 'store', 'play-icon.png'))
    print('wrote icon.png, assets/icons/ios_1024.png, store/play-icon.png')


if __name__ == '__main__':
    main()
