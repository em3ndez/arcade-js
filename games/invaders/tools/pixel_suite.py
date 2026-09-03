#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Space Invaders attract pixel gate: a fresh MAME golden vs the JS render, drift-tolerant reconverge.

Invaders is a 1bpp BITMAP board (no gfx/tile ROMs): boards/invaders/video.js paints VRAM to
monochrome RGB and machine.renderFrame() hands the whole frame to tools/convergence.mjs --mode pixel,
which already does the reconverge + verdict (each JS frame scored against its nearest golden frame;
PASS iff none diverges past the threshold). So this suite is THIN -- it captures a short attract
golden via mame_golden.py, runs convergence for the requested --layer, and translates convergence's
own PASS into the literal `pixel_suite: PASS` line the per-commit gate requires.

A short --seconds attract window is a per-commit regression TRIPWIRE, not the full golden. Both layers
are byte-exact vs MAME on the attract (MEASURED 2026-09-03: convergence --mode pixel worst-frame 0.00%).

FAIL-CLOSED: `pixel_suite: PASS` prints ONLY on a clean convergence PASS. No mame / no romset ->
SKIP + nonzero (never PASS). A poisoned capture, a convergence non-PASS, a crash, or an incomplete run
each print a non-PASS line and exit nonzero -- exactly as pooyan's suite does.
"""
import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)                        # games/invaders
REPO = os.path.dirname(os.path.dirname(GAME))       # arcade-js
HW = os.path.join(REPO, "boards", "invaders", "hardware.json")
LUA = os.path.join(HERE, "lua")
DRIVER = "invaders"
SECONDS = 4                     # ~240 attract frames: a short per-commit tripwire, not the full golden

# convergence.mjs prints "PASS — reconverges ..." (exit 0) on success, "FAIL — ..." otherwise.
CONV_PASS = re.compile(r"^PASS\b", re.M)


def have_romset(rompath):
    """(ok, skip_line): True only when `mame` runs and verifies the invaders romset. A clean SKIP
    (not FAIL) keeps the gate honest -- it means nothing was checked, not that a pixel diverged."""
    try:
        r = subprocess.run(["mame", "-rompath", rompath, "-verifyroms", DRIVER],
                           capture_output=True, text=True)
    except FileNotFoundError:
        return False, "pixel_suite: SKIP -- no `mame` on PATH; cannot build a golden to compare against."
    if r.returncode != 0:
        return False, f"pixel_suite: SKIP -- romset {DRIVER} not found under {rompath}."
    return True, ""


def capture_golden(rompath, out, seconds):
    """Fresh certified golden via the shared capturer. mame_golden.py exits nonzero on a POISONED
    capture, so its return code IS the poison guard -- 0 means every invariant held."""
    cmd = [sys.executable, os.path.join(REPO, "tools", "mame_golden.py"),
           "--hardware", HW, "--lua-dir", LUA,
           "--rompath", rompath, "--out", out, "--seconds", str(seconds)]
    return subprocess.run(cmd, cwd=REPO).returncode == 0


def run_convergence(golden, idiomatic):
    """(ok, output): run convergence --mode pixel for the layer. ok only when it exits 0 AND prints
    its PASS line -- both, so a crash after the verdict cannot pass (the gate applies this rule too)."""
    cmd = ["node", os.path.join(REPO, "tools", "convergence.mjs"),
           "--game", DRIVER, "--golden", golden, "--mode", "pixel"]
    if idiomatic:
        cmd.append("--idiomatic")
    r = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True)
    out = (r.stdout or "") + (r.stderr or "")
    return (r.returncode == 0 and bool(CONV_PASS.search(out))), out


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--layer", default="oracle", choices=["oracle", "idiomatic"],
                   help="which layer to render (the gate runs both).")
    p.add_argument("--seconds", type=int, default=SECONDS,
                   help="attract golden length (a short per-commit tripwire, not the full golden).")
    p.add_argument("--rompath", default=os.path.expanduser("~/Downloads"),
                   help="MAME romset search path (needs invaders); NOT the JS ROM dir.")
    a = p.parse_args()

    ok, skip = have_romset(a.rompath)
    if not ok:
        print(skip)
        return 1

    work = tempfile.mkdtemp(prefix="invaders_pixel_")
    try:
        golden = os.path.join(work, "golden")
        if not capture_golden(a.rompath, golden, a.seconds):
            print("pixel_suite: FAIL -- mame_golden refused to certify the capture (poisoned golden).")
            return 1
        ok, out = run_convergence(golden, a.layer == "idiomatic")
        print(out.rstrip())
        if not ok:
            print(f"pixel_suite: FAIL -- convergence did not PASS for the {a.layer} layer "
                  "(a frame diverged past the threshold, or the run was incomplete).")
            return 1
        print("pixel_suite: PASS")
        return 0
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
