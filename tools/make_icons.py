"""Generate Pulss icons: icons/icon-192.png, icon-512.png, icon-maskable-512.png.

Run from the project root:  python tools/make_icons.py
Design: dark rounded background, white heart, ECG zigzag in accent colour (#e0324b).
Maskable variant: full-bleed background, content kept inside the central 80 % safe zone.
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw

BG = (28, 28, 34, 255)        # #1c1c22
ACCENT = (224, 50, 75, 255)   # #e0324b
WHITE = (255, 255, 255, 255)
OUT = Path(__file__).resolve().parent.parent / "icons"
SS = 4  # supersampling factor


def heart_points(cx, cy, r, n=240):
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        x = 16 * math.sin(a) ** 3
        y = 13 * math.cos(a) - 5 * math.cos(2 * a) - 2 * math.cos(3 * a) - math.cos(4 * a)
        pts.append((cx + x * r / 17, cy - y * r / 17))
    return pts


def draw_icon(size, maskable):
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable:
        d.rectangle([0, 0, S, S], fill=BG)   # full bleed; the OS applies its own mask
        scale = 0.80                         # content inside central 80 %
    else:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=BG)
        scale = 1.0
    cx = cy = S / 2
    r = S * 0.30 * scale
    d.polygon(heart_points(cx, cy + S * 0.02 * scale, r), fill=WHITE)
    # ECG line across the heart
    w = S * 0.58 * scale
    h = S * 0.11 * scale
    y0 = cy + S * 0.01 * scale
    x0 = cx - w / 2
    pts = [
        (x0, y0), (x0 + w * 0.28, y0), (x0 + w * 0.36, y0 - h * 0.35),
        (x0 + w * 0.44, y0 + h * 0.9), (x0 + w * 0.52, y0 - h * 1.6),
        (x0 + w * 0.60, y0 + h * 0.5), (x0 + w * 0.66, y0), (x0 + w, y0),
    ]
    d.line(pts, fill=ACCENT, width=int(S * 0.045 * scale), joint="curve")
    return img.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(exist_ok=True)
    draw_icon(192, False).save(OUT / "icon-192.png", optimize=True)
    draw_icon(512, False).save(OUT / "icon-512.png", optimize=True)
    draw_icon(512, True).save(OUT / "icon-maskable-512.png", optimize=True)
    for p in sorted(OUT.glob("*.png")):
        print(p.name, p.stat().st_size, "B")


if __name__ == "__main__":
    main()
