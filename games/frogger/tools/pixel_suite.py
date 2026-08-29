#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Frogger ATTRACT pixel gate: JS render vs a fresh MAME golden, byte-for-byte.

Attract's deterministic animation makes reproducing it pixel-exact the test. main() SWEEPS offsets and
picks the min-diff one (nothing hardcoded); BAND_MAX_PX is one tight band above the measured floor, so
a real regression blows past it. FAIL-CLOSED: `pixel_suite: PASS` prints ONLY on a clean comparison;
no mame/romset, a poisoned golden, a short/frozen render, or any over-band frame exits nonzero (the
gate treats any non-PASS, SKIP included, as refusal).
"""
import argparse
import json
import math
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)                       # games/frogger
REPO = os.path.dirname(os.path.dirname(GAME))      # arcade-js
sys.path.insert(0, os.path.join(REPO, "tools"))

import numpy as np      # noqa: E402
import pixel_gate       # noqa: E402

HW = os.path.join(REPO, "boards", "frogger", "hardware.json")
DRIVER = "frogger"
SECONDS = 10

# Sweep window straddling the expected +1 (the AVI lag), so a drift either way is caught, not assumed.
OFFSETS = range(-2, 5)

# Measured correct-layer floor: 3px on 1 frame. Band ~5x floor, << one 8x8 tile (64px). Over = FAIL.
BAND_FLOOR_PX = 3
BAND_MAX_PX = 16

# A frozen/black screen (distinct ~1) lets two dead frames match and PASS over nothing; require motion.
MIN_DISTINCT = 10

# Idiomatic go-live alignment, MEASURED: the "ignore the clock" boot collapses ~49 frames, so idio
# render frame i matches golden i+GEN_OFFSET, and the first GEN_BOOT_SKIP frames are the boot transient
# (no golden match, excluded). Past it, idio is PIXEL-EXACT (0px) to MAME -- the DK --tape-origin case.
GEN_OFFSET = 49
GEN_BOOT_SKIP = 51
GEN_OFFSETS = range(GEN_OFFSET - 3, GEN_OFFSET + 4)   # straddle it: a drift is measured, not assumed


def capture_golden(rompath, out, seconds):
    """Fresh certified golden via the shared capturer. Attract only -- no --tape.

    mame_golden.py returns nonzero on a POISONED capture (watchdog reset, frame delta, unverified
    DSW/reset); returncode 0 == "all invariants hold". So its exit code IS the poison guard here.
    """
    r = subprocess.run(
        [sys.executable, os.path.join(REPO, "tools", "mame_golden.py"),
         "--hardware", HW, "--lua-dir", os.path.join(HERE, "lua"),
         "--rompath", rompath, "--out", out, "--seconds", str(seconds)])
    return r.returncode == 0


def render_js(out, frames, idiomatic):
    """Fresh JS render (nonzero on a boot gap / dropped frame). idiomatic = the generator spine via
    runIdiomaticGame; oracle = the cycle-driven translated layer. The gate picks by the changed files."""
    cmd = ["node", os.path.join(HERE, "render.js"), "--frames", str(frames), "--frames-out", out]
    if idiomatic:
        cmd.append("--idiomatic")
    r = subprocess.run(cmd)
    return r.returncode == 0


def distinct_frames(frames_json):
    """How many DISTINCT images the emitter recorded (both render.js and mame_golden write sha256)."""
    with open(frames_json) as fh:
        j = json.load(fh)
    return len({f["sha256"] for f in j["frames"]})


def frame_bytes():
    _, _, bpf = pixel_gate.screen_geometry(HW)
    return bpf


def total_diff(js_rgb, golden_rgb, bpf, offset, from_frame=0):
    """(total differing px, worst per-frame px, worst frame, frames compared) for js[i] vs g[i+off].

    Skips i where i+offset falls outside the golden -- so negative offsets never seek before 0.
    from_frame drops the leading render frames (the idiomatic boot transient has no golden match)."""
    njs = os.path.getsize(js_rgb) // bpf
    ngd = os.path.getsize(golden_rgb) // bpf
    total = worst = 0
    worst_at = None
    n = 0
    with open(js_rgb, "rb") as jf, open(golden_rgb, "rb") as gf:
        for i in range(from_frame, njs):
            j = i + offset
            if j < 0 or j >= ngd:
                continue
            jf.seek(i * bpf)
            gf.seek(j * bpf)
            a = np.frombuffer(jf.read(bpf), dtype=np.uint8).reshape(-1, 3)
            b = np.frombuffer(gf.read(bpf), dtype=np.uint8).reshape(-1, 3)
            c = int(np.any(a != b, axis=1).sum())
            total += c
            n += 1
            if c > worst:
                worst, worst_at = c, i
    return total, worst, worst_at, n


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--rompath", default=os.path.expanduser("~/Downloads"),
                   help="MAME romset search path (needs frogger.zip); NOT the JS ROM dir.")
    p.add_argument("--seconds", type=int, default=SECONDS,
                   help="emulated seconds of attract to capture+render (10 = fast pre-commit gate; larger = extensive).")
    # Cover the whole golden (~refresh*seconds frames) with margin; render.js paints frames-1.
    p.add_argument("--frames", type=int, default=None,
                   help="render frame count; default (None) covers the whole --seconds golden.")
    p.add_argument("--work", default=os.path.join(GAME, "out", "pixelwork"))
    # The gate invokes every suite with --layer {oracle,idiomatic}, chosen from which layer's files changed.
    p.add_argument("--layer", default="oracle", choices=["oracle", "idiomatic"],
                   help="which layer to render vs MAME (the pixel gate passes this explicitly).")
    a = p.parse_args()
    if a.frames is None:
        a.frames = math.ceil(60.606061 * a.seconds) + 34
    idiomatic = a.layer == "idiomatic"
    offsets = GEN_OFFSETS if idiomatic else OFFSETS
    from_frame = GEN_BOOT_SKIP if idiomatic else 0
    print(f"  layer: {'IDIOMATIC (runIdiomaticGame)' if idiomatic else 'oracle (cycle-driven)'}")

    # --- can we compare at all? every "no" below exits NONZERO (fail-closed). ---
    try:
        verified = subprocess.run(["mame", "-rompath", a.rompath, "-verifyroms", DRIVER],
                                  capture_output=True, text=True).returncode == 0
    except FileNotFoundError:
        print("pixel_suite: SKIP -- no `mame` on PATH; cannot build a golden to compare against.")
        return 1
    if not verified:
        print(f"pixel_suite: SKIP -- romset {DRIVER} not found under {a.rompath}.")
        return 1

    os.makedirs(a.work, exist_ok=True)
    go, jo = os.path.join(a.work, "golden"), os.path.join(a.work, "js")

    if not capture_golden(a.rompath, go, a.seconds):
        print("pixel_suite: FAIL -- mame_golden refused to certify the capture (poisoned golden).")
        return 1
    if not render_js(jo, a.frames, idiomatic):
        print("pixel_suite: FAIL -- render.js stopped early (boot gap / dropped frame); "
              "a short artifact must not be diffed.")
        return 1

    g_rgb, j_rgb = os.path.join(go, "frames.rgb"), os.path.join(jo, "frames.rgb")
    bpf = frame_bytes()
    n_g = os.path.getsize(g_rgb) // bpf
    n_j = os.path.getsize(j_rgb) // bpf

    # --- positive control: the golden must actually be a LIVE, animated attract, not frozen/black. ---
    g_distinct = distinct_frames(os.path.join(go, "frames.json"))
    j_distinct = distinct_frames(os.path.join(jo, "frames.json"))
    print(f"  golden: {n_g} frames, {g_distinct} distinct   render: {n_j} frames, {j_distinct} distinct")
    if g_distinct < MIN_DISTINCT or j_distinct < MIN_DISTINCT:
        print(f"pixel_suite: FAIL -- fewer than {MIN_DISTINCT} distinct frames "
              f"(golden {g_distinct}, render {j_distinct}); a frozen screen proves nothing.")
        return 1

    # --- MEASURE the offset: minimise total differing pixels over the overlap. ---
    sweep = {off: total_diff(j_rgb, g_rgb, bpf, off, from_frame) for off in offsets}
    for off in offsets:
        tot, wst, _at, nn = sweep[off]
        print(f"    offset {off:+d}: total={tot:>8d}px  worst={wst:>6d}px  frames={nn}")
    offset = min(offsets, key=lambda o: sweep[o][0])
    total, worst, worst_at, n = sweep[offset]
    expect = f"expected +{GEN_OFFSET}, the boot collapse" if idiomatic else "expected +1, the AVI lag"
    print(f"  measured offset: {offset:+d} (minimises total diff; {expect})")

    # --- did we actually compare the whole attract? render must span the full golden overlap. ---
    need = n_g - offset - from_frame
    if n < need:
        print(f"pixel_suite: FAIL -- compared only {n} of {need} overlapping frames; "
              "render did not cover the full golden attract.")
        return 1

    # --- the tight full-frame band is the whole verdict (no decorative loose band). ---
    verdict = pixel_gate.PASS if worst <= BAND_MAX_PX else pixel_gate.FAIL
    print(f"  band: worst={worst}px @frame {worst_at} (floor {BAND_FLOOR_PX}px, budget {BAND_MAX_PX}px) "
          f"over {n} frames -> {verdict}")
    if verdict != pixel_gate.PASS:
        print(f"pixel_suite: FAIL -- frame {worst_at} differs by {worst}px, over the {BAND_MAX_PX}px band.")
        return 1

    print("pixel_suite: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
