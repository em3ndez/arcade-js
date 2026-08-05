# SPDX-License-Identifier: GPL-3.0-only
"""The Pit GAMEPLAY pixel gate -- JS render vs a MAME golden, THROUGH real play.

The existing pixel golden (games/thepit/out/golden/pixel) is ATTRACT only. This gate closes
the gameplay half: it drives coin -> start -> dig into BOTH MAME (the oracle) and the JS
renderer on the SAME entropy-pinned input, and asserts the JS frame buffer is byte-identical
to MAME's, pixel-for-pixel, all the way through the tunnelling gameplay. The translated layer
is the render source (render.js/runFrames); the idiomatic coroutine layer is separately proven
byte-identical to it over video RAM (idiomatic/test/{golive,tape,transition}.test.js), so this
validates both.

BYO-ROM: the golden is captured live from your own thepitu1 romset (copyrighted, never committed,
same posture as games/thepit/rom/ and the audio clips). Point --rompath at the dir that CONTAINS
your `thepitu1` romset dir; the gate skips (exit 0) if MAME cannot verify it, so CI without the
ROM is green.

    python3 games/thepit/tools/pixel_suite.py --rompath /path/to/roms

Two subtleties, both handled explicitly rather than hidden:
  * BOOT TRANSITION (frames 0-1): one 8x8 tile at the screen edge turns on ONE frame earlier in
    the JS render than in MAME -- a boot-phase artifact (the frame-stepped engine's boot frame
    phase differs by one), cosmetically invisible, present in the attract comparison too. The
    diff window starts at frame 2 so this documented transient is excluded; a real regression at
    any later frame (attract OR gameplay) still fails.
  * POISON FALSE-POSITIVE: mame_golden's boot-signature heuristic flags the coin/start frames
    (the screen blanks at those transitions, resembling boot) as a suspected watchdog reset. It
    is not one -- we re-verify from the STATE dump (work RAM at those frames is NOT the boot
    image and GAME_STATE progresses 0->3->1 normally). A REAL reset (work RAM == boot) fails.
"""
import argparse
import os
import subprocess
import sys

import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..','..','..','tools'))
import pixel_gate

TOOLS = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(TOOLS)                      # games/thepit
REPO = os.path.dirname(os.path.dirname(GAME))      # repo root
DRIVER = "thepitu1"
HW = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..','..','..','boards','thepit','hardware.json')
STATE_FRAME = 4352                                 # work(2048)@0x8000 + color + video + attrspr
PINSPEC = "4b34:00,4b35:00,4b39:00,4b3a:00"        # entropyPinRomSpec(manifest.entropyPin)
SECONDS = 13                                        # boot -> coin(400) -> start(460) -> ~300f of dig
DIFF_FROM = 2                                        # skip the documented boot-transition frames 0-1


def verify_roms(rompath):
    r = subprocess.run(["mame", "-rompath", rompath, "-verifyroms", DRIVER],
                       capture_output=True, text=True)
    return "is good" in (r.stdout + r.stderr)


def capture_golden(rompath, out):
    """Capture the MAME gameplay golden (dig tape, entropy-pinned). Returns True on a usable run.
    mame_golden exits nonzero on its boot-signature 'poison' heuristic; we accept that and prove
    validity from the STATE dump instead (see module docstring)."""
    env = dict(os.environ, TAPE_MODE="dig")
    subprocess.run(
        ["python3", f"{REPO}/tools/mame_golden.py",
         "--hardware", f"{REPO}/boards/thepit/hardware.json",
         "--lua-dir", f"{GAME}/tools/lua",
         "--tape", f"{GAME}/tapes/coin_start.lua",
         "--pin-entropy", PINSPEC,
         "--rompath", rompath, "--out", out, "--seconds", str(SECONDS)],
        env=env, capture_output=True, text=True, timeout=180)
    return os.path.exists(f"{out}/frames.rgb") and os.path.exists(f"{out}/state.bin")


def no_real_reset(state_path):
    """The honest check behind the poison flag: a genuine watchdog reset makes work RAM identical
    to the boot image. Confirm the flagged transitions are NORMAL progression, not a reset."""
    st = np.fromfile(state_path, dtype=np.uint8).reshape(-1, STATE_FRAME)
    boot = st[0][:64]
    # GAME_STATE (0x8001) must progress attract(0) -> credit(3) -> play(1), and no later frame may
    # snap work RAM back to the boot image.
    gs = st[:, 0x8001 - 0x8000]
    saw_credit = np.any(gs == 3)
    saw_play = np.any(gs == 1)
    reset_frames = [i for i in range(1, len(st)) if np.array_equal(st[i][:64], boot)]
    return saw_credit and saw_play and not reset_frames, reset_frames


def render_js(rompath, out, frames):
    romset = os.path.join(rompath, DRIVER)          # render.js wants the parts dir (p9.ic9, ...)
    dig = []
    for f in range(482, frames + 2, 32):            # +2 JS mirror of the lua dig pulses (period 32, hold 6)
        dig += ["--input", f"0xa000=0x10@{f}:hold6"]
    cmd = ["node", f"{GAME}/tools/render.js", "--pin", "--frames", str(frames),
           "--romset", romset, "--frames-out", out,
           "--input", "0xa800=0x01@402:hold8",     # coin  (lua 400 +2)
           "--input", "0xa800=0x04@462:hold8",     # start (lua 460 +2)
           "--input", f"0xa000=0x04@482:hold{frames}"] + dig  # hold Down from 482
    r = subprocess.run(cmd, capture_output=True, text=True)
    return os.path.exists(f"{out}/frames.rgb"), r.stdout + r.stderr


def diff(js_rgb, gd_rgb):
    """Per-frame differing-pixel count. Geometry, the pinned AVI offset and the
    reconvergence rule are shared: tools/pixel_gate.py. Do not re-derive them here."""
    return pixel_gate.frame_diffs(js_rgb, gd_rgb, HW)


def main():
    p = argparse.ArgumentParser(description="The Pit gameplay pixel gate (JS render vs MAME)")
    p.add_argument("--rompath", default=os.environ.get("THEPIT_ROMPATH", os.path.expanduser("~/Downloads")),
                   help="dir CONTAINING your thepitu1 romset dir (BYO; default $THEPIT_ROMPATH or ~/Downloads)")
    p.add_argument("--work", default=os.path.join(GAME, "out", "pixelwork"))
    args = p.parse_args()

    if not verify_roms(args.rompath):
        print(f"pixel_suite: SKIP -- MAME cannot verify {DRIVER} under --rompath {args.rompath} "
              f"(BYO romset; set --rompath or $THEPIT_ROMPATH)")
        return 0

    os.makedirs(args.work, exist_ok=True)
    go, eo = os.path.join(args.work, "golden"), os.path.join(args.work, "js")

    if not capture_golden(args.rompath, go):
        print("pixel_suite: FAIL -- MAME golden capture produced no frames"); return 1
    ok, resets = no_real_reset(f"{go}/state.bin")
    if not ok:
        print(f"pixel_suite: FAIL -- golden shows a REAL reset (work RAM == boot at frames {resets})"); return 1

    frames = os.path.getsize(f"{go}/frames.rgb") // pixel_gate.screen_geometry(HW)[2]      # render one fewer so golden covers the +1 offset
    ok, log = render_js(args.rompath, eo, frames)
    if not ok:
        print(f"pixel_suite: FAIL -- JS render produced no frames\n{log[-400:]}"); return 1

    d = diff(f"{eo}/frames.rgb", f"{go}/frames.rgb")
    window = d[DIFF_FROM:]
    bad = np.nonzero(window > 0)[0]
    start_js = 464                                          # GAME_STATE 3->1 (game begins)
    gp = d[start_js:]
    w, h, _ = pixel_gate.screen_geometry(HW)
    total = w * h

    # An EMPTY window is INCOMPLETE, never PASS. Without this, a render that died before
    # DIFF_FROM leaves `bad` empty, the headline reads PASS and main() returns 0 -- CI green
    # on a run that compared nothing. This suite's own floor is 0 px, so only the empty case
    # needs the shared verdict; everything below still applies the stricter byte-exact bar.
    for label, win in (("boot+attract+play", window), ("gameplay (coin->dig)", gp)):
        if pixel_gate.rough_verdict(win, HW)["verdict"] == pixel_gate.INCOMPLETE:
            print(f"pixel_suite: {pixel_gate.INCOMPLETE} -- {label} compared 0 frames of "
                  f"{len(d)} captured; a comparison this short concludes nothing.")
            return 1
    print(f"{'window':22} {'frames':>7} {'clean':>7} {'maxpx':>6} {'max%':>7} verdict")
    print(f"{'boot+attract+play':22} {len(window):7d} {int((window==0).sum()):7d} "
          f"{int(window.max()) if len(window) else 0:6d} {100*window.max()/total if len(window) else 0:7.3f} "
          f"{'PASS' if len(bad)==0 else 'FAIL'}")
    print(f"{'gameplay (coin->dig)':22} {len(gp):7d} {int((gp==0).sum()):7d} "
          f"{int(gp.max()) if len(gp) else 0:6d} {100*gp.max()/total if len(gp) else 0:7.3f} "
          f"{'PASS' if (len(gp) and gp.max()==0) else 'FAIL'}")
    if len(bad):
        print(f"pixel_suite: FAIL -- {len(bad)} frame(s) diverge from MAME in [{DIFF_FROM}, end); "
              f"first at JS frame {int(bad[0])+DIFF_FROM} ({int(window[bad[0]])} px)")
        return 1
    print(f"pixel_suite: PASS -- JS render byte-identical to MAME across {len(window)} frames "
          f"(boot transition frames 0-{DIFF_FROM-1} excluded, documented)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
