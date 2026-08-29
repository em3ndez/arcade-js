#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Pooyan attract-boot pixel gate: JS oracle render vs a fresh MAME golden, per-frame RECONVERGE.

The JS<->golden frame offset drifts across boot, so a single frozen offset false-fails at the fill
transitions; each JS frame is scored against its NEAREST golden frame within a window instead (the
drift-tolerant reconverge). Pooyan covers the attract boot with no input. Since batch 5 completed the
0x0242 attract state table, the translated boot no longer stops early -- it runs CLEAN and only reaches
the next untranslated gap (0x60bc) around frame 1447. This gate validates the byte-exact PREFIX_FRAMES
prefix of that boot; render.js is asked for exactly that many frames and must return them with NO gap.

CALIBRATION (2026-08-20): a correct oracle render reconverges to EXACTLY 0px -- byte-identical to MAME --
on every prefix frame but one. The exception is js31, an ldirAt sub-frame fill instant that no whole-frame
golden captures (16325px at every offset), isolated between byte-exact neighbours. So the floor is 0 and
3x0 stays 0: BAND_MAX_PX = 0 (a frame is a mismatch if it differs from its nearest golden by any pixel),
and the one irreducible transient is carried by TRANSIENT_BUDGET, NOT by inflating the band to swallow
16325px (which would pass a 28%-wrong frame). VERDICT: PASS iff at most TRANSIENT_BUDGET prefix frames
mismatch. Injecting a single wrong pixel makes 2 mismatches -> FAIL (teeth).

SCOPE NOTE: beyond the prefix the extended attract demo (frames ~177-1357) shows ~20 ISOLATED,
recover-immediately sub-frame / animation-drift transients vs MAME (max 1446px @ f793; every mismatched
frame has byte-exact neighbours -- no cascade, so not state corruption). Gating that full sequence needs
a fresh ~24s golden and a cascade-aware budget; it is a tracked FOUNDATION item, deliberately NOT papered
over by inflating TRANSIENT_BUDGET here.

FAIL-CLOSED: `pixel_suite: PASS` prints ONLY on a clean comparison. No mame/romset -> SKIP + nonzero. A
poisoned golden, a boot that stops (any gap) inside the prefix, too few frames, a frozen screen, or more
than the budgeted mismatches each print a non-PASS line and exit nonzero.
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
SECONDS = 4                    # 244 golden frames: covers the PREFIX_FRAMES validated window + the search window

# The oracle boot no longer STOPS in the validated window -- since batch 5 (the attract 0x0242 state table
# is complete) it runs clean to frame ~1447 and only then reaches the next untranslated gap 0x60bc. So this
# gate validates the byte-exact PREFIX: the first PREFIX_FRAMES boot frames, which stay byte-identical to
# MAME (only the js31 ldirAt sub-frame transient differs). Beyond the prefix the extended attract demo shows
# ~20 ISOLATED, recover-immediately sub-frame/animation-drift transients vs MAME (max 1446px @ f793; each
# frame's neighbours are byte-exact -- no cascade). Pixel-gating that full 1357-frame sequence needs a fresh
# ~24s golden and a cascade-aware budget; that is a tracked FOUNDATION item (see ARCADE2-RESUME.md), not
# swept under an inflated budget here. 170 is the last frame before the first extended transient (f177).
PREFIX_FRAMES = 170
FULL_BOOT_GAP = 0x60bc         # where the FULL boot now stops (documentation; the prefix gate expects NO gap)

# Nearest-golden search half-width. Distinct-content frames drift about +1; static fill/hold frames match
# any identical golden frame, so the chosen offset ranges wider but every clean frame still scores 0px --
# stable over windows 8..20 in measurement. 20 is generous margin over the +1 content drift.
WINDOW = 20

# Measured correct-layer floor is 0px (byte-exact) across the prefix; see the module docstring. BAND_MAX_PX 0
# makes any nonzero diff a mismatch; TRANSIENT_BUDGET 1 forgives the single irreducible js31 ldirAt transient.
BAND_MAX_PX = 0
TRANSIENT_BUDGET = 1

MIN_PAINTED = 160              # the prefix must render nearly all PREFIX_FRAMES; a boot that stops early trips it
MIN_DISTINCT = 10              # a frozen/black render proves nothing; the boot has ~34 distinct images

# Positive control: flip one pixel in one painted frame (well clear of the js31 transient) -> must FAIL.
INJECT_AT = 60
INJECT_XY = (100, 100)

# ── DONE gate (--done): the FULL path done_gate runs, NOT the short per-commit prefix. ──────────────
# The per-commit tripwire (tools/pixel_gate_required.py) runs the byte-exact PREFIX above. `--done` is the
# ship-time gate (runbook 5): it adds the two checks the short prefix is BLIND to and closes the
# green-but-blind hole the adversarial done-audit found -- gameplay was pixel-validated vs MAME NOWHERE.
#
#  PART A (completeness / crash): render the idiomatic ATTRACT input-free for ATTRACT_DONE_FRAMES -- far
#    past the two former crash frames (both at f1681, an unseated register-bridge in the enemy-scan/
#    actor-reset chain, fixed in bfd81fcb + e8631403). A gap/short/dropped run == a crash reintroduced ==
#    RED. This is the mechanism that would have caught crashes #1/#2, which sat in reachable-but-unchecked
#    attract states past the 170-frame prefix.
#  PART B (gameplay correctness): capture a long TAPE-DRIVEN MAME golden (coin -> start -> ~90s of play,
#    reaching life-loss/respawn transitions the attract gate never dispatches), render the idiomatic layer
#    with the SAME tape, and score it with the runbook's DRIFT-TOLERANT reconverge (tools/convergence.mjs
#    nearest-golden -- the same stride-8 sampled %, whole-golden search). This EXERCISES the in-play seams
#    (fire/climb handlers, object/HUD leaves) against MAME instead of asserting idiomatic==oracle (JS-vs-JS,
#    which proves nothing about correctness).
ATTRACT_DONE_FRAMES = 2400     # >= 2000, well past the two former crash frames at f1681 (PART A)
GAMEPLAY_SECONDS = 90          # tape-driven golden length: coin@300, start@360, play from 420 (~5456 frames)
GAMEPLAY_TAPE = os.path.join(GAME, "tapes", "coin_start_play.lua")  # the MAME-side driver for the golden
GAMEPLAY_FRAMES = 5389         # idiomatic frames to render+score; the collapsed layer runs AHEAD of MAME
# The idiomatic layer collapses the boot pure-delays, so it reaches gameplay AHEAD of MAME by a per-game
# constant MEASURED (not assumed): golden_frame == js_frame + TAPE_ORIGIN in the aligned region. Re-derived
# 2026-08-29 from the pre-input boot (JS<233, input-free regardless of the tape): the nearest-golden match
# offset over frames 100..232 has median 67 (early-boot drift ramps 40->67; the inputs fire at frame 300+,
# in the settled +67 region). render.js applies the tape at f + TAPE_ORIGIN, so a JS render at frame
# (300-67)=233 lands the coin at the same game-state MAME reaches at golden frame 300.
TAPE_ORIGIN = 67

# The gameplay bar is COARSE by design: entropy is UNPINNED (manifest.entropyPin=null), so the JS and MAME
# RNGs diverge from each other and the death/respawn TIMING differs -- the drift-tolerant nearest-golden
# reconverge tolerates that (each JS frame scored against its nearest golden frame anywhere). Tight per-sprite
# teeth need entropy-pinning (deliberately deferred; runbook 4 "pin for TESTING only"). So this catches GROSS
# divergence -- a crash, a frozen/blank render, a persistent wrong region -- not a subtle one-sprite error.
# Calibrated 2026-08-29 on the certified render (games/pooyan/out/donework):
#   clean gameplay: worst 3.24% (matches convergence.mjs), 0 frames over the 5% band, matched-golden span 4856
#   a persistent 56x56 wrong region: ALL 360 scored frames over the band (teeth); a 64x64 region: worst 9.93%
#   a frozen render: band gives 0.00% (each frame matches its own golden twin!) -- so the band ALONE is blind
#     to a freeze; the SPAN + MIN_DISTINCT guards catch it (frozen span 0, distinct 1)
GP_SPATIAL_STRIDE = 8          # sample every 8th px in x and y -- the convergence.mjs grid (the 3.24% is on it)
GP_FRAME_STRIDE = 15           # score every 15th JS frame -- the convergence.mjs temporal stride
GP_BAND_PCT = 5.0              # per-frame band on the sampled grid (convergence.mjs default px-threshold)
# A small per-death transient allowance: under the nearest-golden bar the death/respawn transients reconverge
# BELOW the band (0 over 5% on the certified render), so this is headroom for entropy-capture variation, NOT a
# hole -- a real gross regression trips hundreds of frames (56x56 -> 360), dwarfing it.
GP_TRANSIENT_BUDGET = 8


def capture_golden(rompath, out, seconds, tape=None):
    """Fresh certified golden via the shared capturer. `tape` (a tapes/*.lua driver) composes coin/start/
    play inputs into the capture for the gameplay golden; omitted, it is the input-free attract golden.
    mame_golden.py exits nonzero on a POISONED capture -- watchdog reset, frame-count/delta mismatch,
    unverified DSW0/reset -- so its return code IS the poison guard: 0 means every invariant held."""
    cmd = [sys.executable, os.path.join(REPO, "tools", "mame_golden.py"),
           "--hardware", HW, "--lua-dir", os.path.join(HERE, "lua"),
           "--rompath", rompath, "--out", out, "--seconds", str(seconds)]
    if tape:
        cmd += ["--tape", tape]
    return subprocess.run(cmd).returncode == 0


def render_js(out, frames, idiomatic, inputs=None, tape_origin=0):
    """Render `frames` frames -- the idiomatic layer when `idiomatic`, else the translated oracle. With
    `inputs` (render.js --input PORT=BITS@FRAME[:holdN] specs) it drives a coin/start/play tape, applied at
    f + tape_origin so the collapsed idiomatic timeline rides the golden's frame numbering. Returns
    (painted, gap, dropped, log); `painted` from file size. render.js exits nonzero at a boot gap -- so the
    caller judges by gap address + painted count, not the exit code."""
    cmd = ["node", os.path.join(HERE, "render.js"), "--frames", str(frames), "--frames-out", out]
    if idiomatic:
        cmd.append("--idiomatic")
    if inputs:
        for spec in inputs:
            cmd += ["--input", spec]
        cmd += ["--tape-origin", str(tape_origin)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    log = (r.stdout or "") + (r.stderr or "")
    _, _, bpf = pixel_gate.screen_geometry(HW)
    rgb = os.path.join(out, "frames.rgb")
    painted = os.path.getsize(rgb) // bpf if os.path.exists(rgb) else 0
    m = re.search(r"boot gap 0x([0-9a-f]+)", log)
    gap = int(m.group(1), 16) if m else None
    return painted, gap, ("DROPPED" in log), log


def gameplay_tape_specs(max_frame):
    """render.js --input specs mirroring tapes/coin_start_play.lua (the MAME-side golden driver), in
    PRESSED-BIT form (io folds the active-low polarity). Ports/bits from manifest.inputs.actions:
    coin=IN0(0xa080) b0, start1=IN0 b3, fire=IN1(0xa0a0) b4, up=IN1 b2, down=IN1 b3. Timing from the lua:
    coin@300 hold6, start@360 hold6, then from 420 fire (period 24, hold 4) + up/down (period 120, hold 60,
    alternating). Verified to reproduce the certified render byte-for-byte (games/pooyan/out/donework)."""
    specs = ["0xa080=0x01@300:hold6", "0xa080=0x08@360:hold6"]
    for f in range(420, max_frame + 1, 24):
        specs.append("0xa0a0=0x10@%d:hold4" % f)
    for k, f in enumerate(range(420, max_frame + 1, 60)):
        specs.append("0xa0a0=0x%02x@%d:hold60" % (0x04 if k % 2 == 0 else 0x08, f))
    return specs


def load_frames_ds(rgb_path, count, bpf, h, w, s):
    """Load `count` frames DOWNSAMPLED to every s-th pixel, flattened to (count, samples, 3) for a fast
    vectorized nearest-golden search -- the convergence.mjs stride-8 grid the 3.24% figure is measured on."""
    ys, xs = range(0, h, s), range(0, w, s)
    out = np.empty((count, len(ys) * len(xs), 3), np.uint8)
    with open(rgb_path, "rb") as fh:
        for i in range(count):
            f = np.frombuffer(fh.read(bpf), np.uint8).reshape(h, w, 3)
            out[i] = f[::s, ::s, :].reshape(-1, 3)
    return out


def reconverge_nearest_pct(js_ds, golden_ds, frame_stride):
    """Drift-tolerant reconverge (runbook / convergence.mjs nearest-golden): score every `frame_stride`-th
    JS frame against its NEAREST golden frame ANYWHERE in the golden, as a %-of-samples differing. Returns
    (scores_pct, matched_golden_idxs). Nearest-anywhere (not monotonic) is deliberate: entropy is unpinned
    so gameplay TIMING drifts, and a monotonic index falls behind and stops tracking (measured: it locks at
    golden ~2449 of 5456); nearest tracks the whole run (span 4856), and a frozen render is caught instead by
    MIN_DISTINCT + the matched-index span, not by this per-frame %."""
    samp = golden_ds.shape[1]
    scores, idxs = [], []
    for i in range(0, len(js_ds), frame_stride):
        d = np.any(golden_ds != js_ds[i], axis=2).sum(axis=1)   # per-golden-frame differing sample count
        k = int(np.argmin(d))
        scores.append(100.0 * int(d[k]) / samp)
        idxs.append(k)
    return scores, idxs


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


# The generator idiomatic layer collapses pure-delay waits, so its frame i lands at a golden index that
# drifts ahead non-uniformly (+33..+67 over the boot) -- the fixed +/-WINDOW sweep cannot track that.
IDIOMATIC_SECONDS = 6          # ~366 golden frames: headroom for the ~1.4x collapse
MONO_BACK = 20                 # backward slack for near-identical adjacent boot frames
MONO_AHEAD = 96                # forward reach per frame: covers the initial collapse jump + drift


def reconverge_monotonic(js, golden, back, ahead):
    """Drift-tolerant reconverge for the COLLAPSED generator timeline: score each JS frame against its
    nearest golden frame at a MONOTONICALLY non-decreasing index (search [lo-back, lo+ahead), advance lo
    to the match). Monotonicity is the teeth -- a frozen/garbage render cannot pass by cherry-picking
    scattered golden frames, since the match index can only move forward. Returns (scores, idxs)."""
    ng = len(golden)
    lo = 0
    scores, idxs = [], []
    for a in js:
        best = 1 << 30
        bj = min(lo, ng - 1)
        for j in range(max(0, lo - back), min(ng, lo + ahead)):
            d = int(np.any(a != golden[j], axis=2).sum())
            if d < best:
                best = d
                bj = j
                if best == 0:
                    break
        scores.append(best)
        idxs.append(bj)
        lo = bj
    return scores, idxs


def distinct(frames):
    return len({f.tobytes() for f in frames})


def _done_partA(a):
    """PART A -- completeness / crash. Render the idiomatic ATTRACT input-free for ATTRACT_DONE_FRAMES,
    far past the two former crash frames (f1681). A gap / dropped / short run means a crash was
    reintroduced -> RED. No golden needed: this is a survival check, not a pixel diff. Returns True=clean."""
    out = os.path.join(a.work, "done_attract")
    painted, gap, dropped, log = render_js(out, ATTRACT_DONE_FRAMES, idiomatic=True)
    if a.inject_attract_crash:  # positive control: truncate so the render looks short/crashed
        rgb = os.path.join(out, "frames.rgb")
        _, _, bpf = pixel_gate.screen_geometry(HW)
        with open(rgb, "r+b") as fh:
            fh.truncate(bpf * 800)
        painted = 800
        print(f"  [PART A] INJECTED a truncation to {painted} frames (positive control -- expect FAIL).")
    if dropped:
        print("pixel_suite: FAIL -- PART A: attract render DROPPED frames (a tick outran a frame).")
        return False
    if gap is not None:
        print(f"pixel_suite: FAIL -- PART A: attract CRASHED at gap 0x{gap:04x} after {painted} frames "
              f"(a reachable attract state past the 170-frame prefix regressed).\n" + log.strip()[-400:])
        return False
    if painted < ATTRACT_DONE_FRAMES:
        print(f"pixel_suite: FAIL -- PART A: attract painted only {painted}/{ATTRACT_DONE_FRAMES} frames "
              "(short run == a crash / early stop in a reachable attract state).")
        return False
    print(f"  [PART A] attract ran CLEAN for {painted} frames (past the former crash frames at f1681).")
    return True


def _done_partB(a):
    """PART B -- gameplay correctness. Capture a tape-driven MAME golden (coin->start->~90s play), render
    the idiomatic layer with the same tape, and score with the drift-tolerant nearest-golden reconverge.
    Teeth: (1) the render must COMPLETE (a gameplay crash -> gap/short -> RED); (2) MIN_DISTINCT + the
    matched-golden SPAN reject a frozen/blank/non-tracking render; (3) at most GP_TRANSIENT_BUDGET frames
    may exceed GP_BAND_PCT (a gross wrong render trips hundreds). Returns True=clean."""
    go, jo = os.path.join(a.work, "done_golden"), os.path.join(a.work, "done_js")
    if not capture_golden(a.rompath, go, GAMEPLAY_SECONDS, tape=GAMEPLAY_TAPE):
        print("pixel_suite: FAIL -- PART B: mame_golden refused to certify the gameplay capture (poisoned).")
        return False
    _, _, bpf = pixel_gate.screen_geometry(HW)
    w, h = pixel_gate.frameio.WIDTH, pixel_gate.frameio.HEIGHT
    n_g = os.path.getsize(os.path.join(go, "frames.rgb")) // bpf
    if n_g < GAMEPLAY_FRAMES:
        print(f"pixel_suite: FAIL -- PART B: gameplay golden {n_g} frames < {GAMEPLAY_FRAMES}; "
              "capture more --seconds so the collapsed idiomatic timeline has headroom.")
        return False

    specs = gameplay_tape_specs(n_g + TAPE_ORIGIN + 60)  # cover the whole golden, in MAME frame numbers
    painted, gap, dropped, log = render_js(jo, GAMEPLAY_FRAMES, True, inputs=specs, tape_origin=TAPE_ORIGIN)
    if dropped:
        print("pixel_suite: FAIL -- PART B: gameplay render DROPPED frames (a tick outran a frame).")
        return False
    if gap is not None:
        print(f"pixel_suite: FAIL -- PART B: gameplay CRASHED at gap 0x{gap:04x} after {painted} frames "
              "(an in-play seam regressed).\n" + log.strip()[-400:])
        return False
    if painted < GAMEPLAY_FRAMES:
        print(f"pixel_suite: FAIL -- PART B: gameplay painted only {painted}/{GAMEPLAY_FRAMES} frames.")
        return False

    s = GP_SPATIAL_STRIDE
    ncols = (w + s - 1) // s
    nrows = (h + s - 1) // s
    golden = load_frames_ds(os.path.join(go, "frames.rgb"), n_g, bpf, h, w, s)
    js = load_frames_ds(os.path.join(jo, "frames.rgb"), painted, bpf, h, w, s)
    if a.inject_gameplay_defect:  # positive control: a persistent BxB wrong region in EVERY frame
        b = max(1, a.inject_gameplay_defect // s)
        y0, x0 = 80 // s, 90 // s
        grid = js.reshape(painted, nrows, ncols, 3)  # a view -- XOR writes back into js
        grid[:, y0:y0 + b, x0:x0 + b, :] ^= np.uint8(0xFF)
        print(f"  [PART B] INJECTED a persistent {a.inject_gameplay_defect}px wrong region (positive control "
              "-- expect FAIL).")

    j_d = len(np.unique(js.reshape(painted, -1), axis=0))
    if j_d < MIN_DISTINCT:
        print(f"pixel_suite: FAIL -- PART B: render has only {j_d} distinct frames (< {MIN_DISTINCT}); "
              "a frozen screen proves nothing.")
        return False

    scores, idxs = reconverge_nearest_pct(js, golden, GP_FRAME_STRIDE)
    worst = max(scores)
    worstf = int(np.argmax(scores)) * GP_FRAME_STRIDE
    over = [i * GP_FRAME_STRIDE for i, v in enumerate(scores) if v > GP_BAND_PCT]
    span = max(idxs) - min(idxs)
    print(f"  [PART B] gameplay nearest-golden reconverge: {len(scores)} frames scored (stride "
          f"{GP_FRAME_STRIDE}); worst {worst:.2f}% @JS {worstf}; matched golden {min(idxs)}..{max(idxs)} "
          f"(span {span}); over {GP_BAND_PCT}% band: {len(over)} (budget {GP_TRANSIENT_BUDGET}); distinct {j_d}")
    if span < painted // 2:
        print(f"pixel_suite: FAIL -- PART B: matched-golden span {span} < {painted // 2} -- the render is "
              "not tracking the golden across the run (frozen / misaligned / stuck).")
        return False
    if len(over) > GP_TRANSIENT_BUDGET:
        print(f"pixel_suite: FAIL -- PART B: {len(over)} frames exceed the {GP_BAND_PCT}% band "
              f"(> budget {GP_TRANSIENT_BUDGET}) -- gameplay diverges grossly from MAME. e.g. {over[:8]}")
        return False
    print(f"  [PART B] gameplay tracks MAME within the drift-tolerant band.")
    return True


def run_done(a):
    """The FULL ship-time pixel gate (runbook 5): PART A (attract completeness/crash) + PART B (tape-driven
    gameplay vs MAME). done_gate.check_pixel runs this. `pixel_suite: PASS` prints ONLY when both are clean;
    every cannot-run path already exited nonzero above (no mame / no romset), and each part fails closed."""
    os.makedirs(a.work, exist_ok=True)
    print(f"pixel_suite --done [{DRIVER}]: attract completeness + tape-driven gameplay vs MAME")
    if not _done_partA(a):
        return 1
    if not _done_partB(a):
        return 1
    print("pixel_suite: PASS")
    return 0


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--rompath", default=os.path.expanduser("~/Downloads"),
                   help="MAME romset search path (needs pooyan.zip); NOT the JS ROM dir.")
    p.add_argument("--seconds", type=int, default=SECONDS)
    p.add_argument("--frames", type=int, default=PREFIX_FRAMES,
                   help="frames to render+validate (the byte-exact boot prefix; the full boot runs clean past it).")
    p.add_argument("--work", default=os.path.join(GAME, "out", "pixelwork"))
    # The gate invokes every suite with --layer {oracle,idiomatic}; render.js renders that layer.
    p.add_argument("--layer", default="oracle", choices=["oracle", "idiomatic"])
    p.add_argument("--inject-defect", action="store_true",
                   help="POSITIVE CONTROL: flip one pixel in the render before scoring; the suite must FAIL.")
    p.add_argument("--done", action="store_true",
                   help="the FULL ship-time gate (runbook 5): PART A attract-completeness (past the former "
                        "crash frames) + PART B tape-driven GAMEPLAY vs MAME. done_gate runs this, not the "
                        "short per-commit prefix. Always idiomatic; fail-closed.")
    p.add_argument("--inject-gameplay-defect", type=int, default=0, metavar="B",
                   help="POSITIVE CONTROL for --done PART B: XOR a BxB block into EVERY gameplay frame "
                        "(a persistent wrong region); the band+budget must FAIL. 0 = off.")
    p.add_argument("--inject-attract-crash", action="store_true",
                   help="POSITIVE CONTROL for --done PART A: truncate the attract render so it looks like a "
                        "crash/short run; PART A must FAIL. (Use the real crash-fix revert for a truer test.)")
    a = p.parse_args()
    idiomatic = a.layer == "idiomatic"

    try:
        verified = subprocess.run(["mame", "-rompath", a.rompath, "-verifyroms", DRIVER],
                                  capture_output=True, text=True).returncode == 0
    except FileNotFoundError:
        print("pixel_suite: SKIP -- no `mame` on PATH; cannot build a golden to compare against.")
        return 1
    if not verified:
        print(f"pixel_suite: SKIP -- romset {DRIVER} not found under {a.rompath}.")
        return 1

    if a.done:
        return run_done(a)

    os.makedirs(a.work, exist_ok=True)
    go, jo = os.path.join(a.work, "golden"), os.path.join(a.work, "js")

    secs = max(a.seconds, IDIOMATIC_SECONDS) if idiomatic else a.seconds
    if not capture_golden(a.rompath, go, secs):
        print("pixel_suite: FAIL -- mame_golden refused to certify the capture (poisoned golden).")
        return 1

    painted, gap, dropped, log = render_js(jo, a.frames, idiomatic)
    if dropped:
        print("pixel_suite: FAIL -- render dropped frames (a tick outran a frame); indices shifted.")
        return 1
    if gap is not None:
        print(f"pixel_suite: FAIL -- boot stopped at gap 0x{gap:04x} inside the {PREFIX_FRAMES}-frame prefix. "
              f"The prefix must run CLEAN (the full boot runs to 0x{FULL_BOOT_GAP:04x}); an earlier stop is a "
              "regression -- investigate.\n" + log.strip()[-400:])
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

    if idiomatic:
        # The idiomatic BOOT PREFIX is deterministic (pre-RNG), so it is byte-exact everywhere -- budget 0.
        budget = 0
        scores, idxs = reconverge_monotonic(js, golden, MONO_BACK, MONO_AHEAD)
        over = [i for i, v in enumerate(scores) if v > BAND_MAX_PX]
        worst = int(np.argmax(scores))
        span = idxs[-1] - idxs[0]
        print(f"  reconverge (monotonic, collapsed timeline): worst={scores[worst]}px @frame {worst}; "
              f"matched golden {idxs[0]}..{idxs[-1]} (span {span}); mismatches(>{BAND_MAX_PX}px)={over} "
              f"(budget {budget})")
        if idxs[-1] >= n_g - 1:
            print(f"pixel_suite: FAIL -- idiomatic match reached the end of the golden ({idxs[-1]}/{n_g}); "
                  "capture more --seconds so the collapsed timeline keeps headroom.")
            return 1
        if span < painted // 2:
            print(f"pixel_suite: FAIL -- idiomatic match advanced only {span} golden frames over {painted} "
                  "render frames; the render is not tracking the timeline (frozen/misaligned).")
            return 1
    else:
        budget = TRANSIENT_BUDGET
        scores = reconverge(js, golden, WINDOW)
        over = [i for i, v in enumerate(scores) if v > BAND_MAX_PX]
        worst = int(np.argmax(scores))
        print(f"  reconverge: worst={scores[worst]}px @frame {worst}; mismatches(>{BAND_MAX_PX}px)={over} "
              f"(budget {budget})")

    if len(over) > budget:
        print(f"pixel_suite: FAIL -- {len(over)} frames mismatch (> {budget}); the render is not "
              "byte-exact against MAME beyond the allowed transient.")
        return 1
    print("pixel_suite: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
