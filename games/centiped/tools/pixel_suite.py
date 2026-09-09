#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Centipede pixel gate: a fresh MAME golden vs the RNG-replayed oracle render, drift-tolerant reconverge.

Centiped's attract demo forks on POKEY RANDOM, so the render is entropy-matched: the capture logs MAME's
$100a stream (observe-only, dump_state_rng.lua) and convergence.mjs --mode pixel replays it into the
cycle-driven oracle before rendering, then diffs each JS frame against its NEAREST golden frame (the oracle
snapshots a sub-frame instant off MAME's raster). Centiped has no idiomatic layer yet (§4 pending), so this
renders the ORACLE for either --layer flag; when §4 lands the idiomatic layer becomes the shipped render.

FAIL-CLOSED: `pixel_suite: PASS` prints ONLY on a clean convergence PASS. No mame / no romset -> SKIP +
nonzero (never PASS). A poisoned capture, a convergence non-PASS, an RNG desync, a truncated run, or a crash
each print a non-PASS line and exit nonzero.
"""
import argparse, os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)                        # games/centiped
REPO = os.path.dirname(os.path.dirname(GAME))       # arcade-js
LUA = os.path.join(HERE, "lua", "dump_state_rng.lua")
CONV = os.path.join(HERE, "convergence.mjs")
DRIVER = "centiped3"
W, H = 256, 240
SECONDS = 10                    # ~600 attract frames: a per-commit regression tripwire, not the full golden
CONV_PASS = re.compile(r"^centiped_convergence: PASS", re.M)


def have_romset(rompath, mame):
    try:
        r = subprocess.run([mame, "-rompath", rompath, "-verifyroms", DRIVER],
                           capture_output=True, text=True, timeout=120)
        return "is good" in (r.stdout + r.stderr)
    except Exception:
        return False


def capture(rompath, mame, out, seconds):
    """One MAME run -> AVI frames + state + $100a RNG stream; ffmpeg converts the (bgr24) AVI to rgb24 raw.
    Returns True iff frames.rgb + rng.bin were produced with the expected frame count."""
    os.makedirs(out, exist_ok=True)
    avi = os.path.join(out, "out.avi")
    env = {**os.environ, "STATE_OUT": os.path.join(out, "state.bin"), "RNG_OUT": os.path.join(out, "rng.bin")}
    try:
        # ISOLATE cfg/nvram to this fresh per-run dir: without -cfg_directory MAME reads the working-dir
        # cfg/<game>.cfg, which an ad-hoc grounding capture can poison (a self-test capture leaves the
        # service switch HELD -> the golden boots into the frozen self-test screen). `out` is empty, so MAME
        # falls back to default dips (service idle) and the golden is immune to a stale working-dir cfg.
        subprocess.run([mame, DRIVER, "-rompath", rompath, "-norotate", "-video", "none", "-sound", "none",
                        "-nothrottle", "-frameskip", "0", "-nonvram_save", "-nocheat", "-noautosave",
                        "-cfg_directory", out, "-nvram_directory", out,
                        "-seconds_to_run", str(seconds), "-aviwrite", avi,
                        "-autoboot_script", LUA, "-autoboot_delay", "0"],
                       cwd=REPO, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=300)
        frames = os.path.join(out, "frames.rgb")
        subprocess.run(["ffmpeg", "-y", "-i", avi, "-map", "0:v:0", "-pix_fmt", "rgb24", "-f", "rawvideo", frames],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=300)
        os.remove(avi)  # the AVI is large; frames.rgb is what convergence reads
        want = seconds * 60
        got = os.path.getsize(frames) // (W * H * 3)
        return got >= want * 0.9
    except Exception:
        return False


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--layer", default="oracle")   # accepted; centiped renders the oracle for both
    p.add_argument("--seconds", type=int, default=SECONDS)
    p.add_argument("--rompath", default=os.path.join(os.environ.get("HOME", ""), "Downloads"))
    p.add_argument("--mame", default="/opt/homebrew/bin/mame")
    a = p.parse_args()

    if not shutil.which("ffmpeg"):
        print("pixel_suite: SKIP -- ffmpeg not found"); sys.exit(1)
    if not have_romset(a.rompath, a.mame):
        print(f"pixel_suite: SKIP -- no verified {DRIVER} romset at {a.rompath}"); sys.exit(1)

    work = tempfile.mkdtemp(prefix="centiped_px_")
    try:
        if not capture(a.rompath, a.mame, work, a.seconds):
            print("pixel_suite: FAIL -- capture did not produce the expected frames (poisoned/short)"); sys.exit(1)
        r = subprocess.run(["node", CONV, "--mode", "pixel", "--golden", work, "--layer", a.layer],
                           cwd=REPO, capture_output=True, text=True, timeout=600)
        out = r.stdout + r.stderr
        sys.stdout.write(out if out.endswith("\n") else out + "\n")
        if r.returncode == 0 and CONV_PASS.search(out):
            print("pixel_suite: PASS"); sys.exit(0)
        print("pixel_suite: FAIL -- convergence did not PASS"); sys.exit(1)
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
