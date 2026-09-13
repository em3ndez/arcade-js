#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Tempest §5 audio oracle: capture MAME's own POKEY audio + register writes over a driven gameplay run and
compare it to games/tempest/audio/synth.js. Two falsifiable tests (runbook §5): (i) AC (DC-removed) LEVEL
match and (ii) AC-envelope CORRELATION clearly positive. This is the FAITHFULNESS check; the per-voice teeth
are test/synth-voices.test.js (an aggregate correlation cannot fail per-voice). BYO ROM.

Capture: MAME headless with -wavwrite (its real POKEY output) + games/tempest/tools/lua/audio_tape.lua, which
drives coin->start->fire and taps each POKEY sound register with INDIVIDUAL single-address write taps
(a RANGE tap over 0x60c0-0x60df SEGFAULTS), timestamped in emu seconds so the stream aligns to the WAV.

FAIL-CLOSED: prints `tempest_audio: OK` only on a clean pass; SKIP (nonzero) with no mame/ffmpeg/romset.
Usage: python3 audio_suite.py [--rompath ~/Downloads] [--seconds 14]
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)
DRIVER = "tempest"
LUA = os.path.join(HERE, "lua", "audio_tape.lua")
CORRELATE = os.path.join(HERE, "audio_correlate.mjs")


def have_mame(rompath):
    if not shutil.which("mame"):
        return "audio_suite: SKIP -- no `mame` on PATH."
    try:
        r = subprocess.run(["mame", "-rompath", rompath, "-verifyroms", DRIVER],
                           capture_output=True, text=True, timeout=60)
        if "is good" not in r.stdout and "is best available" not in r.stdout:
            return f"audio_suite: SKIP -- romset {DRIVER} not found under {rompath}."
    except Exception:
        return "audio_suite: SKIP -- could not run `mame -verifyroms`."
    return None


def capture(rompath, work, seconds):
    """Drive MAME and capture out.wav + a timestamped POKEY write stream. Returns True on success."""
    os.makedirs(os.path.join(work, "nvram"), exist_ok=True)
    os.makedirs(os.path.join(work, "cfg"), exist_ok=True)
    wav = os.path.join(work, "out.wav")
    writes = os.path.join(work, "pokey_writes.txt")
    argv = [
        "mame", DRIVER, "-rompath", rompath,
        "-video", "none", "-sound", "none", "-nothrottle", "-frameskip", "0",
        "-wavwrite", wav,
        "-snapshot_directory", work, "-nvram_directory", os.path.join(work, "nvram"),
        "-cfg_directory", os.path.join(work, "cfg"), "-nonvram_save", "-noautosave", "-nocheat",
        "-seconds_to_run", str(seconds), "-autoboot_script", LUA,
    ]
    env = dict(os.environ, POKEY_OUT=writes, SDL_VIDEODRIVER="dummy")
    r = subprocess.run(argv, env=env, capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(wav) or not os.path.exists(writes) or os.path.getsize(writes) == 0:
        sys.stderr.write(r.stdout + r.stderr)
        return False
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rompath", default=os.path.expanduser("~/Downloads"))
    ap.add_argument("--seconds", type=int, default=14)
    a = ap.parse_args()

    skip = have_mame(a.rompath)
    if skip:
        print(skip)
        return 2

    work = tempfile.mkdtemp(prefix="tempest_audio_")
    try:
        if not capture(a.rompath, work, a.seconds):
            print("audio_suite: FAIL -- MAME/tap capture did not produce a wav + non-empty write stream.")
            return 1
        r = subprocess.run(["node", CORRELATE, os.path.join(work, "out.wav"),
                            os.path.join(work, "pokey_writes.txt")], capture_output=True, text=True)
        sys.stdout.write(r.stdout)
        sys.stderr.write(r.stderr)
        return r.returncode
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
