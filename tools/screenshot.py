#!/usr/bin/env python3
"""Produce a representative game screenshot from a pixel-gate MAME golden (or any
raw frames.rgb), applying the manifest's ROT so the image is oriented the way a
player sees the cabinet. One frame of frames.rgb -> games/<game>/<game>.jpg.

The screenshot documents the game (web-player gallery / README) and is the image
the Computer-Archaeology contrib pages reference (`![<Game>](<game>.jpg)` + the
`>>> deploy: +<game>.jpg`). It is ROM-derived graphics; the repo's copyright
posture governs whether it is committed or gitignored (see the runbook §5).

Usage:
  screenshot.py <game> --golden <dir> [--frame N] [--out PATH] [--scale S]
    <dir> holds frames.rgb (+ frames.json/index.json giving width/height/
    bytes_per_frame); width/height/rot fall back to the game's manifest.
    --frame: which frame (default: a representative frame ~1/4 into the capture,
    past the black boot). --scale: integer upscale (default 3, matching the
    other games' selector shots). --out defaults to games/<game>/screenshot.png
    (the file the web selector loads, `games/<game>/screenshot.png`). Pass a
    .jpg --out to also produce the smaller Computer-Archaeology page image.
    Output format follows the --out extension (.png or .jpg).
"""
import argparse
import json
import os
import re
import sys

from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# MAME ROT -> PIL transpose. MAME rotates the native raster CLOCKWISE; PIL's
# ROTATE_* is COUNTER-clockwise, so a 90 CW cabinet (ROT90) is PIL ROTATE_270.
ROT_TO_PIL = {0: None, 90: Image.ROTATE_270, 180: Image.ROTATE_180, 270: Image.ROTATE_90}


def manifest_screen(game):
    text = open(os.path.join(REPO, "games", game, "manifest.js")).read()
    m = re.search(r"screen:\s*\{([^}]*)\}", text)
    body = m.group(1) if m else ""

    def num(k, default):
        mm = re.search(k + r":\s*(\d+)", body)
        return int(mm.group(1)) if mm else default

    return num("width", 256), num("height", 224), num("rot", 0)


def golden_dims(golden):
    for name in ("frames.json", "index.json"):
        p = os.path.join(golden, name)
        if os.path.exists(p):
            idx = json.load(open(p))
            if "width" in idx and "height" in idx:
                return idx["width"], idx["height"]
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("game")
    ap.add_argument("--golden", required=True, help="dir containing frames.rgb")
    ap.add_argument("--frame", type=int, default=None)
    ap.add_argument("--out")
    ap.add_argument("--scale", type=int, default=3)
    args = ap.parse_args()

    w, h, rot = manifest_screen(args.game)
    gd = golden_dims(args.golden)
    if gd:
        w, h = gd  # the golden's own dims win (a game may capture a sub-window)

    rgb_path = os.path.join(args.golden, "frames.rgb")
    if not os.path.exists(rgb_path):
        sys.exit(f"no frames.rgb in {args.golden} (decode a compressed golden first: "
                 f"tools/golden_mp4.py decode {args.golden})")
    bpf = w * h * 3
    total = os.path.getsize(rgb_path)
    nframes = total // bpf
    if nframes == 0:
        sys.exit(f"frames.rgb is smaller than one {w}x{h} frame ({total} < {bpf})")
    frame = args.frame if args.frame is not None else min(nframes - 1, max(1, nframes // 4))
    if not (0 <= frame < nframes):
        sys.exit(f"frame {frame} out of range 0..{nframes - 1}")

    with open(rgb_path, "rb") as f:
        f.seek(frame * bpf)
        data = f.read(bpf)
    img = Image.frombytes("RGB", (w, h), data)
    if ROT_TO_PIL.get(rot):
        img = img.transpose(ROT_TO_PIL[rot])
    if args.scale > 1:
        img = img.resize((img.width * args.scale, img.height * args.scale), Image.NEAREST)

    # Default: the web selector's screenshot.png (web/index.html loads
    # games/<game>/screenshot.png). A .jpg --out is the Computer-Archaeology page image.
    out = args.out or os.path.join(REPO, "games", args.game, "screenshot.png")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    fmt = "PNG" if out.lower().endswith(".png") else "JPEG"
    img.convert("RGB").save(out, fmt, **({"quality": 90} if fmt == "JPEG" else {}))
    print(f"wrote {out}  ({img.width}x{img.height}, frame {frame}/{nframes - 1}, rot {rot})")


if __name__ == "__main__":
    sys.exit(main())
