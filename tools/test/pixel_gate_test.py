# SPDX-License-Identifier: GPL-3.0-only
"""Teeth for tools/pixel_gate.py, built around the case the real corpora cannot show.

Same-output-on-real-data proved the extraction preserved behaviour on a HAPPY run and said
nothing about a short one. The short one is where the regression was: an empty window has a
max of 0 and 0 frames over tolerance, so a caller deriving PASS from those numbers reads a
run that compared NOTHING as clean -- turning a loud crash into a silent pass.

Run: python3 tools/test/pixel_gate_test.py
"""
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
REPO = os.path.dirname(TOOLS)
sys.path.insert(0, TOOLS)

import numpy as np  # noqa: E402
import pixel_gate as P  # noqa: E402

HW = os.path.join(REPO, "boards", "dkong", "hardware.json")
W, H, BPF = P.screen_geometry(HW)
TOTAL = W * H
fails = []


def check(name, got, want):
    if got != want:
        fails.append(f"{name}: got {got!r}, want {want!r}")


def rgb(path, frames, fill=0):
    with open(path, "wb") as fh:
        fh.write(bytes([fill]) * (BPF * frames))
    return path


# --- the regression: an incomplete comparison must never read as a pass ----------------
check("empty window", P.rough_verdict(np.zeros(0), HW)["verdict"], P.INCOMPLETE)
check("window starts past the end",
      P.rough_verdict(np.zeros(50), HW, from_frame=1600)["verdict"], P.INCOMPLETE)
check("exactly one frame short",
      P.rough_verdict(np.zeros(1600), HW, from_frame=1600)["verdict"], P.INCOMPLETE)
check("exactly one frame long",
      P.rough_verdict(np.zeros(1601), HW, from_frame=1600)["verdict"], P.PASS)

# An INCOMPLETE verdict must not be reachable by reading the numbers alone -- this is the
# shape that made the old call sites print PASS.
r = P.rough_verdict(np.zeros(0), HW)
check("incomplete looks clean numerically", (r["max_pct"], r["frames_over"]), (0.0, 0))
check("...so the verdict is the only safe field", r["verdict"], P.INCOMPLETE)

# --- the rule itself -------------------------------------------------------------------
check("under tolerance passes", P.rough_verdict(np.array([int(TOTAL * 0.04)]), HW)["verdict"], P.PASS)
check("over tolerance fails", P.rough_verdict(np.array([int(TOTAL * 0.06)]), HW)["verdict"], P.FAIL)
check("one bad frame among good fails",
      P.rough_verdict(np.array([0, 0, int(TOTAL * 0.9), 0]), HW)["verdict"], P.FAIL)
check("bounded transient reconverges", P.rough_verdict(np.array([0, 4, 0, 0]), HW)["verdict"], P.PASS)

# --- frame_diffs boundaries: a truncated capture must yield an empty window, not a crash --
with tempfile.TemporaryDirectory() as td:
    js, gd = os.path.join(td, "j.rgb"), os.path.join(td, "g.rgb")
    for name, nj, ng in [("both empty", 0, 0), ("golden empty", 4, 0),
                         ("golden shorter than the offset", 4, 1), ("js empty", 0, 4)]:
        rgb(js, nj); rgb(gd, ng)
        d = P.frame_diffs(js, gd, HW)
        check(f"frame_diffs: {name}", (len(d), P.rough_verdict(d, HW)["verdict"]), (0, P.INCOMPLETE))
    # every pixel differing must be FAIL, not a silent pass
    rgb(js, 3, fill=0x00); rgb(gd, 4, fill=0xff)
    d = P.frame_diffs(js, gd, HW)
    check("all pixels differ", P.rough_verdict(d, HW)["verdict"], P.FAIL)
    check("all pixels differ: count", int(d.max()), TOTAL)

# --- the pinned offset is imported, not re-declared -------------------------------------
sys.path.insert(0, TOOLS)
import framediff  # noqa: E402
check("offset is framediff's", P.FROZEN_OFFSET, framediff.FROZEN_OFFSET)

# --- geometry comes from the board, not a constant --------------------------------------
check("timeplt geometry", P.screen_geometry(os.path.join(REPO, "boards", "timeplt", "hardware.json")),
      (256, 224, 172032))

print(f"pixel_gate selftest: {'PASS' if not fails else 'FAIL'} ({len(fails)} failure(s))")
for f in fails:
    print("  " + f)
sys.exit(1 if fails else 0)
