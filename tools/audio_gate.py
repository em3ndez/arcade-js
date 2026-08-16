#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Audio-coverage gate - a game cannot ship without a wired, tested audio layer.

Audio is the one ship step with no gate ("by ear, no oracle"), so it silently gets skipped (frogger
shipped "done" three times with no audio layer). A COMPLETION gate (run at ship, not per-commit). It
cannot check a clip *sounds right* - no oracle, that stays a by-ear sign-off - but it makes a MISSING
or untested audio layer un-shippable by requiring the artifacts a complete layer has (model: dkong):
(1) manifest `audio: { map: <file> }` + the map file exists; (2) if the map declares a soundLatch AND
names.js names SOUND_CMD_LATCH they must match (a clips player keying off the wrong address is silent/
wrong); (3) test/audio-map.test.js (committed COVERAGE test; the WAVs are gitignored copyright) and
(4) test/audio-wiring.test.js (committed WIRING test). Those two tests prove coverage+wiring in the
standing suite; this gate only guarantees they were not skipped. Legacy games are not retrofitted.

Subcommands: check --game <game> (exit 0 iff complete), selftest.
"""
import argparse
import os
import re
import sys


def read_text(path):
    return open(path, encoding="utf-8").read() if os.path.exists(path) else ""


def read_hex(path, name):
    m = re.search(rf"\b{name}\s*=\s*(0x[0-9a-fA-F]+|\d+)", read_text(path))
    return int(m.group(1), 0) if m else None


def audio_map_rel(manifest_text):
    m = re.search(r"audio\s*:\s*\{[^}]*?\bmap\s*:\s*[\"']([^\"']+)[\"']", manifest_text, re.S)
    return m.group(1) if m else None


def check(game):
    base = f"games/{game}"
    fails = []

    maprel = audio_map_rel(read_text(f"{base}/manifest.js"))
    mappath = None
    if not maprel:
        fails.append("manifest declares no audio.map (the audio layer was never built)")
    else:
        mappath = f"{base}/{maprel}"
        if not os.path.exists(mappath):
            fails.append(f"audio.map file missing: {mappath}")
            mappath = None

    if mappath:
        # Latch correctness applies only to the clips model (a synth model has no soundLatch). When the
        # map declares one AND names.js names SOUND_CMD_LATCH, they must agree or the player is mis-wired.
        maptext = read_text(mappath)
        mlatch = re.search(r"soundLatch\s*:\s*(0x[0-9a-fA-F]+|\d+)", maptext)
        game_latch = read_hex(f"{base}/idiomatic/names.js", "SOUND_CMD_LATCH")
        if mlatch and game_latch is not None and int(mlatch.group(1), 0) != game_latch:
            fails.append(f"soundLatch {mlatch.group(1)} != game SOUND_CMD_LATCH {hex(game_latch)} "
                         f"(the player keys off the wrong address)")

    for kind in ("map", "wiring"):
        if not os.path.exists(f"{base}/test/audio-{kind}.test.js"):
            fails.append(f"no test/audio-{kind}.test.js (the audio {kind} is unproven)")

    if fails:
        print(f"audio-coverage [{game}]: BLOCK — the audio layer is incomplete:", file=sys.stderr)
        for x in fails:
            print(f"  - {x}", file=sys.stderr)
        return 1
    print(f"audio-coverage [{game}]: OK (map present + latch-correct + map/wiring tests committed). "
          f"Clip correctness is a by-ear sign-off (no oracle).")
    return 0


def selftest():
    ok = True
    # audio_map_rel extracts the map path from a manifest `audio: { map: ... }` block, else None.
    if audio_map_rel('audio: {\n  map: "audio/sounds.js",\n  samples: "audio/samples",\n}') != "audio/sounds.js":
        print("selftest FAIL: audio_map_rel did not extract the map", file=sys.stderr); ok = False
    if audio_map_rel("// no audio here\nboards: {}") is not None:
        print("selftest FAIL: audio_map_rel matched a manifest with no audio", file=sys.stderr); ok = False
    print("selftest OK" if ok else "selftest FAILED")
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser(description="Audio-coverage completion gate.")
    ap.add_argument("cmd", choices=("check", "selftest"))
    ap.add_argument("--game", default="frogger")
    args = ap.parse_args()
    return selftest() if args.cmd == "selftest" else check(args.game)


if __name__ == "__main__":
    sys.exit(main())
