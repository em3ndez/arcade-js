# SPDX-License-Identifier: GPL-3.0-only
"""The pixel gate's ROUGH tolerance, in one place.

`framediff.py` is the BYTE-EXACT half, right for a deterministic stretch and wrong elsewhere: a
sprite one frame early that no player could see fails it. This is the other half -- a RIGHT
translation differs in brief bounded transients and snaps back, a WRONG one stays diverged.
Reading a `framediff` FAIL as the verdict, without asking whether it recovered, is the mistake
this exists to stop.

A caller MUST consume `verdict`. Deriving one from `max_pct` and `frames_over` reads an EMPTY
comparison as a pass, since nothing differed in frames that were never compared.
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import frameio  # noqa: E402
import hardware  # noqa: E402
from framediff import FROZEN_OFFSET  # noqa: E402

#: A frame may differ by less than this fraction and still pass, provided it reconverges.
ROUGH_TOLERANCE = 0.05

#: Verdicts. INCOMPLETE mirrors framediff's EXIT_NOTHING: an incomplete comparison is
#: inconclusive, and must never be mistaken for a pass.
PASS, FAIL, INCOMPLETE = "PASS", "FAIL", "INCOMPLETE"


def screen_geometry(hardware_path):
    """(width, height, bytes_per_frame) from the board's hardware.json.

    `frameio.configure` sets MODULE GLOBALS: mixing boards in one process is last-call-wins.
    """
    frameio.configure(hardware.Hardware.load(hardware_path))
    return frameio.WIDTH, frameio.HEIGHT, frameio.BYTES_PER_FRAME


def frame_diffs(js_rgb, golden_rgb, hardware_path, offset=FROZEN_OFFSET):
    """Per-frame count of differing PIXELS, js[i] vs golden[i + offset]. Raw bytes, no hash."""
    _, _, bpf = screen_geometry(hardware_path)
    n = min(os.path.getsize(js_rgb) // bpf, os.path.getsize(golden_rgb) // bpf - offset)
    if n <= 0:
        return np.zeros(0, dtype=np.int64)
    out = np.zeros(n, dtype=np.int64)
    with open(js_rgb, "rb") as jf, open(golden_rgb, "rb") as gf:
        for i in range(n):
            jf.seek(i * bpf)
            gf.seek((i + offset) * bpf)
            a = np.frombuffer(jf.read(bpf), dtype=np.uint8).reshape(-1, frameio.CHANNELS)
            b = np.frombuffer(gf.read(bpf), dtype=np.uint8).reshape(-1, frameio.CHANNELS)
            out[i] = int(np.any(a != b, axis=1).sum())
    return out


def rough_verdict(diffs, hardware_path, from_frame=0, tolerance=ROUGH_TOLERANCE):
    """PASS iff the window is non-empty and no frame exceeds `tolerance`; empty is INCOMPLETE."""
    w, h, _ = screen_geometry(hardware_path)
    total = w * h
    window = np.asarray(diffs[from_frame:], dtype=np.int64)
    if window.size == 0:
        return {
            "verdict": INCOMPLETE, "max_pixels": 0, "max_pct": 0.0,
            "worst_frame": None, "frames_over": 0, "frames_differing": 0, "frames": 0,
        }
    over = int((window > int(total * tolerance)).sum())
    return {
        "verdict": PASS if over == 0 else FAIL,
        "max_pixels": int(window.max()),
        "max_pct": 100.0 * int(window.max()) / total,
        "worst_frame": from_frame + int(window.argmax()),
        "frames_over": over,
        "frames_differing": int((window > 0).sum()),
        "frames": int(window.size),
    }
