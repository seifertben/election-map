#!/usr/bin/env python3
"""Generate the site favicon: a ballot being dropped into a ballot box.

The app is a static site, so the icons are committed to public/ rather than
drawn at runtime. Run `python3 scripts/build-favicon.py` to regenerate them
after editing the design.

Requires Pillow (`pip install Pillow`). The mark is a white ballot paper with
a check, sliding into a white ballot box on the brand navy (#3c3b6e, the flag
canton used by src/components/Logo.tsx). Outputs:

  public/favicon.ico            16/32/48 multi-resolution
  public/favicon-48x48.png
  public/favicon-96x96.png
  public/favicon-192x192.png
  public/apple-touch-icon.png   180x180
"""

from __future__ import annotations

import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")

MASTER = 1024
NAVY = (0x2B, 0x2F, 0x64)
BADGE_TOP = (0x4A, 0x55, 0x99)
BADGE_BOTTOM = (0x2B, 0x2F, 0x64)
INK = (0x24, 0x27, 0x52)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def rounded_rect(draw, box, radius, fill):
    """Draw a filled rounded rectangle (Pillow < 8.2 has no rounded_rectangle)."""
    x0, y0, x1, y1 = [int(v) for v in box]
    r = int(radius)
    draw.rectangle([x0 + r, y0, x1 - r, y1], fill=fill)
    draw.rectangle([x0, y0 + r, x1, y1 - r], fill=fill)
    draw.pieslice([x0, y0, x0 + 2 * r, y0 + 2 * r], 180, 270, fill=fill)
    draw.pieslice([x1 - 2 * r, y0, x1, y0 + 2 * r], 270, 360, fill=fill)
    draw.pieslice([x0, y1 - 2 * r, x0 + 2 * r, y1], 90, 180, fill=fill)
    draw.pieslice([x1 - 2 * r, y1 - 2 * r, x1, y1], 0, 90, fill=fill)


def rounded_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    rounded_rect(ImageDraw.Draw(mask), [0, 0, size - 1, size - 1], radius, 255)
    return mask


def draw_check(draw, box, color, width):
    """Draw a check mark whose bounding box is `box` (x0, y0, x1, y1)."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    p1 = (x0, y0 + h * 0.52)
    p2 = (x0 + w * 0.38, y1)
    p3 = (x1, y0)
    half = width / 2
    for p in (p1, p2, p3):
        draw.ellipse([p[0] - half, p[1] - half, p[0] + half, p[1] + half], fill=color)
    draw.line([p1, p2, p3], fill=color, width=width, joint="curve")


def build_master():
    img = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    for y in range(MASTER):
        t = y / (MASTER - 1)
        d.line([(0, y), (MASTER, y)], fill=lerp(BADGE_TOP, BADGE_BOTTOM, t) + (255,))
    img.putalpha(rounded_mask(MASTER, int(MASTER * 0.224)))

    # Ballot paper: drawn at full resolution, checked, then rotated and
    # composited before the box so its lower half tucks into the slot.
    bw, bh = int(MASTER * 0.40), int(MASTER * 0.46)
    ballot = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    bd = ImageDraw.Draw(ballot)
    rounded_rect(bd, [0, 0, bw - 1, bh - 1], bw * 0.11, (255, 255, 255, 255))
    check_w = int(bw * 0.16)
    draw_check(
        bd,
        (bw * 0.24, bh * 0.22, bw * 0.78, bh * 0.56),
        NAVY,
        check_w,
    )
    ballot = ballot.rotate(-16, expand=True, resample=Image.BICUBIC)
    bx = int(MASTER * 0.5 - ballot.width / 2)
    by = int(MASTER * 0.40 - ballot.height / 2)
    img.alpha_composite(ballot, (bx, by))

    # Ballot box, with a soft drop shadow.
    box = [int(MASTER * 0.19), int(MASTER * 0.47), int(MASTER * 0.81), int(MASTER * 0.86)]
    box_r = int(MASTER * 0.07)
    shadow = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    rounded_rect(
        ImageDraw.Draw(shadow),
        [box[0], box[1] + int(MASTER * 0.02), box[2], box[3] + int(MASTER * 0.02)],
        box_r,
        (0, 0, 0, 90),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(MASTER * 0.02))
    img.alpha_composite(shadow)
    rounded_rect(d, box, box_r, (255, 255, 255, 255))

    # Vote slot, straddling the top edge of the box.
    slot = [
        int(MASTER * 0.30),
        int(MASTER * 0.455),
        int(MASTER * 0.70),
        int(MASTER * 0.545),
    ]
    rounded_rect(d, slot, MASTER * 0.045, INK + (255,))

    return img


def save(img, name, size):
    out = img.resize((size, size), Image.LANCZOS)
    path = os.path.join(PUBLIC, name)
    out.save(path)
    print(f"wrote {path} ({size}x{size})")


def main():
    master = build_master()
    save(master, "apple-touch-icon.png", 180)
    save(master, "favicon-192x192.png", 192)
    save(master, "favicon-96x96.png", 96)
    save(master, "favicon-48x48.png", 48)
    ico_path = os.path.join(PUBLIC, "favicon.ico")
    master.resize((256, 256), Image.LANCZOS).save(
        ico_path, sizes=[(16, 16), (32, 32), (48, 48)]
    )
    print(f"wrote {ico_path} (16/32/48)")


if __name__ == "__main__":
    main()
