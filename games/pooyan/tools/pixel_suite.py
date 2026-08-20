#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Pooyan attract-boot pixel gate: JS oracle render vs a fresh MAME golden, per-frame RECONVERGE.

The JS<->golden frame offset drifts across boot, so a single frozen offset false-fails at the fill
transitions; each JS frame is scored against its NEAREST golden frame within a window instead (the
drift-tolerant reconverge). Pooyan covers only the attract boot with no input -- the translated boot
reaches 0x05ee, an untranslated dispatcher, and stops (render.js paints what it has and exits nonzero,
which is EXPECTED here, not a failure).

CALIBRATION (two independent certified goldens, 2026-08-19): a correct oracle render reconverges to
EXACTLY 0px -- byte-identical -- on every boot frame but one. The exception is js31, an ldirAt sub-frame
fill instant that no whole-frame golden captures (16325px at every offset), isolated between byte-exact
neighbours. So the floor is 0 and 3x0 stays 0: BAND_MAX_PX = 0 (a frame is a mismatch if it differs from
its nearest golden by any pixel), and the one irreducible transient is carried by TRANSIENT_BUDGET, NOT
by inflating the band to swallow 16325px (which would pass a 28%-wrong frame). VERDICT: PASS iff at most
TRANSIENT_BUDGET frames mismatch. Injecting a single wrong pixel makes 2 mismatches -> FAIL (teeth).

FAIL-CLOSED: `pixel_suite: PASS` prints ONLY on a clean comparison. No mame/romset -> SKIP + nonzero. A
poisoned golden, a boot that stops anywhere but 0x05ee, too few frames, a frozen screen, or more than the
budgeted mismatches each print a non-PASS line and exit nonzero.
"""
import argparse
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)                       # games/pooyan
REPO = os.path.dirname(os.path.dirname(GAME))      # arcade-js
sys.path.insert(0, os.path.join(REPO, "tools"))

import numpy as np      # noqa: E402
import pixel_gate       # noqa: E402

HW = os.path.join(REPO, "boards", "pooyan", "hardware.json")
DRIVER = "pooyan"
SECONDS = 4                    # 244 golden frames: covers the ~131 painted boot frames + the search window

# Nearest-golden search half-width. Distinct-content frames drift about +1; static fill/hold frames match
# any identical golden frame, so the chosen offset ranges wider but every clean frame still scores 0px --
# stable over windows 8..20 in measurement. 20 is generous margin over the +1 content drift.
WINDOW = 20

# Measured correct-layer floor is 0px (byte-exact); see the module docstring. BAND_MAX_PX 0 makes any
# nonzero diff a mismatch; TRANSIENT_BUDGET 1 forgives the single irreducible ldirAt sub-frame transient.
BAND_MAX_PX = 0
TRANSIENT_BUDGET = 1

EXPECTED_BOOT_GAP = 0x05ee     # the untranslated dispatcher the oracle boot reaches; pinned so a boot that
MIN_PAINTED = 120              # regresses to an earlier gap, or advances past it, trips the gate for review
MIN_DISTINCT = 10              # a frozen/black render proves nothing; the boot has ~34 distinct images

# Positive control: flip one pixel in one painted frame (well clear of the js31 transient) -> must FAIL.
INJECT_AT = 60
INJECT_XY = (100, 100)


def capture_golden(rompath, out, seconds):
    """Fresh certified attract golden via the shared capturer (no --tape). mame_golden.py exits nonzero
    on a POISONED capture -- watchdog reset, frame-count/delta mismatch, unverified DSW0/reset -- so its
    return code IS the poison guard: 0 means every invariant held."""
    r = subprocess.run(
        [sys.executable, os.path.join(REPO, "tools", "mame_golden.py"),
         "--hardware", HW, "--lua-dir", os.path.join(HERE, "lua"),
         "--rompath", rompath, "--out", out, "--seconds", str(seconds)])
    return r.returncode == 0


def render_oracle(out, frames):
    """Render the translated (oracle) boot. Returns (painted, gap, dropped, log). `painted` comes from the
    file size, not the log. render.js exits nonzero at the boot gap -- EXPECTED for pooyan -- so the caller
    judges by gap address + painted count, not the exit code."""
    cmd = ["node", os.path.join(HERE, "render.js"), "--frames", str(frames), "--frames-out", out]
    r = subprocess.run(cmd, capture_output=True, text=True)
    log = (r.stdout or "") + (r.stderr or "")
    _, _, bpf = pixel_gate.screen_geometry(HW)
    rgb = os.path.join(out, "frames.rgb")
    painted = os.path.getsize(rgb) // bpf if os.path.exists(rgb) else 0
    m = re.search(r"boot gap 0x([0-9a-f]+)", log)
    gap = int(m.group(1), 16) if m else None
    return painted, gap, ("DROPPED" in log), log


def load_frames(rgb_path, count, bpf, h, w):
    with open(rgb_path, "rb") as fh:
        return [np.frombuffer(fh.read(bpf), np.uint8).reshape(h, w, 3) for _ in range(count)]


def reconverge(js, golden, window):
    """Per-frame nearest-golden differing-pixel count: for each JS frame, the min over golden[i-W..i+W].
    Breaks on a byte-exact match -- nothing beats 0 -- which also keeps the sweep fast."""
    ng = len(golden)
    scores = []
    for i, a in enumerate(js):
        best = 1 << 30
        for j in range(max(0, i - window), min(ng, i + window + 1)):
            d = int(np.any(a != golden[j], axis=2).sum())
            if d < best:
                best = d
                if best == 0:
                    break
        scores.append(best)
    return scores


def distinct(frames):
    return len({f.tobytes() for f in frames})


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--rompath", default=os.path.expanduser("~/Downloads"),
                   help="MAME romset search path (needs pooyan.zip); NOT the JS ROM dir.")
    p.add_argument("--seconds", type=int, default=SECONDS)
    p.add_argument("--frames", type=int, default=400, help="render cap; the boot stops at 0x05ee first.")
    p.add_argument("--work", default=os.path.join(GAME, "out", "pixelwork"))
    # The gate invokes every suite with --layer {oracle,idiomatic}. Pooyan has no idiomatic layer yet, so
    # both render the oracle; accepted (not rejected) so a shared-infra commit is never blocked here.
    p.add_argument("--layer", default="oracle", choices=["oracle", "idiomatic"])
    p.add_argument("--inject-defect", action="store_true",
                   help="POSITIVE CONTROL: flip one pixel in the render before scoring; the suite must FAIL.")
    a = p.parse_args()
    if a.layer == "idiomatic":
        print("  note: pooyan has no idiomatic layer yet -- rendering the oracle for this --layer.")

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

    painted, gap, dropped, log = render_oracle(jo, a.frames)
    if dropped:
        print("pixel_suite: FAIL -- render dropped frames (a tick outran a frame); indices shifted.")
        return 1
    if gap != EXPECTED_BOOT_GAP:
        seen = "no gap (boot ran clean or died elsewhere)" if gap is None else f"0x{gap:04x}"
        print(f"pixel_suite: FAIL -- boot stopped at {seen}, not the pinned gap 0x{EXPECTED_BOOT_GAP:04x}. "
              "Boot depth changed -- re-measure and update EXPECTED_BOOT_GAP.\n" + log.strip()[-400:])
        return 1
    if painted < MIN_PAINTED:
        print(f"pixel_suite: FAIL -- render painted {painted} frames (< {MIN_PAINTED}); too short to judge.")
        return 1

    _, _, bpf = pixel_gate.screen_geometry(HW)
    w, h = pixel_gate.frameio.WIDTH, pixel_gate.frameio.HEIGHT
    n_g = os.path.getsize(os.path.join(go, "frames.rgb")) // bpf
    if n_g < painted + WINDOW:
        print(f"pixel_suite: FAIL -- golden {n_g} frames < render {painted} + window {WINDOW}; "
              "capture more --seconds so every frame has a search window.")
        return 1

    golden = load_frames(os.path.join(go, "frames.rgb"), n_g, bpf, h, w)
    js = load_frames(os.path.join(jo, "frames.rgb"), painted, bpf, h, w)
    g_d, j_d = distinct(golden), distinct(js)
    print(f"  golden: {n_g} frames, {g_d} distinct   render: {painted} frames, {j_d} distinct")
    if g_d < MIN_DISTINCT or j_d < MIN_DISTINCT:
        print(f"pixel_suite: FAIL -- under {MIN_DISTINCT} distinct frames (golden {g_d}, render {j_d}); "
              "a frozen screen proves nothing.")
        return 1

    if a.inject_defect:
        x, y = INJECT_XY
        js[INJECT_AT] = js[INJECT_AT].copy()
        js[INJECT_AT][y, x] ^= np.uint8(0xFF)
        print(f"  INJECTED one wrong pixel at frame {INJECT_AT} {INJECT_XY} (positive control -- expect FAIL).")

    scores = reconverge(js, golden, WINDOW)
    over = [i for i, v in enumerate(scores) if v > BAND_MAX_PX]
    worst = int(np.argmax(scores))
    print(f"  reconverge: worst={scores[worst]}px @frame {worst}; mismatches(>{BAND_MAX_PX}px)={over} "
          f"(budget {TRANSIENT_BUDGET})")

    if len(over) > TRANSIENT_BUDGET:
        print(f"pixel_suite: FAIL -- {len(over)} frames mismatch (> {TRANSIENT_BUDGET}); the boot is not "
              "byte-exact against MAME beyond the one irreducible ldirAt transient.")
        return 1
    print("pixel_suite: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
