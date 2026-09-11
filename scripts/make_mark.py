#!/usr/bin/env python3
"""Render the reinvented three-bar mark for favicons and the share card."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
CLOUD = (240, 238, 233)  # Pantone 11-4201 Cloud Dancer
BG = (7, 6, 5)
FONTS = [
    "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf",
]


def mix(alpha):
    return tuple(int(BG[i] + (CLOUD[i] - BG[i]) * alpha) for i in range(3))


def font_path():
    for path in FONTS:
        if Path(path).exists():
            return path
    raise FileNotFoundError("no serif font")


def draw_bars(draw, box):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    bar_w = w * 0.16
    gap = w * 0.075
    total = 3 * bar_w + 2 * gap
    left = x0 + (w - total) / 2
    top = y0 + h * 0.16
    height = h * 0.68
    radius = max(1, int(bar_w * 0.08))
    alphas = (0.55, 0.78, 1.0) if w < 48 else (0.42, 0.72, 1.0)
    for i, alpha in enumerate(alphas):
        x = left + i * (bar_w + gap)
        # Each bar lifts a little — the original mark, still rising
        lift = height * 0.045 * i
        draw.rounded_rectangle(
            [x, top - lift, x + bar_w, top + height],
            radius=radius,
            fill=mix(alpha),
        )


def icon(size):
    img = Image.new("RGB", (size, size), BG)
    draw_bars(ImageDraw.Draw(img), (0, 0, size, size))
    return img


def og_card():
    w, h = 1200, 630
    img = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(img)
    draw.rectangle([36, 36, w - 36, h - 36], outline=mix(0.14), width=1)

    mark = 168
    mx = (w - mark) // 2
    my = 148
    draw_bars(draw, (mx, my, mx + mark, my + mark))

    serif = ImageFont.truetype(font_path(), 52)
    text = "NAYAN  ARORA"
    tw = draw.textlength(text, font=serif)
    draw.text(((w - tw) / 2, my + mark + 18), text, font=serif, fill=CLOUD)
    return img


def main():
    (ROOT / "images").mkdir(exist_ok=True)
    icon(16).save(ROOT / "icon_16x16.png", optimize=True)
    icon(32).save(ROOT / "icon_32x32.png", optimize=True)
    icon(180).save(ROOT / "icon_180x180.png", optimize=True)
    icon(192).save(ROOT / "android-192x192.png", optimize=True)
    icon(512).save(ROOT / "android-512x512.png", optimize=True)
    icon(256).save(
        ROOT / "myicon.ico",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    og_card().save(ROOT / "images" / "og-na.jpg", quality=92, optimize=True, subsampling=1)
    print("wrote mark assets")


if __name__ == "__main__":
    main()
