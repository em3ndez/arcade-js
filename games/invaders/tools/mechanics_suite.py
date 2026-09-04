#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Space Invaders mechanic-coverage poke suite — the game side of tools/mechanics_gate.py.

THE MODEL (poke, don't play). For each declared mechanic, poke its scenario IDENTICALLY into MAME (a tape lua
captured by tools/mame_golden.py) and into the idiomatic JS engine (mech_compare.mjs), then assert the
mechanic's own cells AGREE with MAME. MAME is the ORACLE (no hand-authored expected value), so a
faithful-but-wrong port fails too. mech_compare.mjs documents why invaders asserts the mechanic's write-set at
a pinned frame offset rather than frogger's whole-RAM byte-compare (the non-deterministic alien-shot subsystem).

CONTRACT: print one line per test — `MECHANIC <id> PASS` or `MECHANIC <id> FAIL <reason>` — and exit 0 on a
clean run. REQUIRES `mame` + `invaders.zip` under the rompath, `node`, and the assembled ROM at
games/invaders/rom/; a missing prerequisite is a fail-closed FAIL.

extra_ship_award: awardExtraShip (0x0935) grants the next reserve ship once the active player's score tally
reaches its port-2-selected bonus threshold. The scenario coins/starts a one-player game (NO fire/move, so no
alien kill triggers the explosion-despawn collapse), then at the poke frame arms the award-pending flag
(0x20e5) and seats the tally (0x20f9) above the threshold; awardExtraShip then grants exactly once — reserve
count (0x21ff) +1, flag cleared, the lives-digit column repainted. The suite asserts those cells vs MAME.
"""

import os
import re
import subprocess
import sys
import tempfile

TOOLS = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(TOOLS)))
MECH_COMPARE = os.path.join(TOOLS, "mech_compare.mjs")
HARDWARE = os.path.join(REPO, "boards/invaders/hardware.json")
LUA_DIR = os.path.join(REPO, "games/invaders/tools/lua")
ROMPATH = os.path.expanduser(os.environ.get("INVADERS_ROMPATH", "~/Downloads"))

# One dict per mechanic keeps the MAME lua env and the JS comparator args in lockstep (the same pokes to both).
# `offset` is the measured boot/collapse frame lead of the idiomatic ordinal behind the MAME frame (invaders'
# analogue of frogger's fixed delta); mech_compare pins and confirms it before asserting the window.
EXTRA_SHIP_AWARD = dict(
    id="extra_ship_award",
    scenario_lua=os.path.join(REPO, "games/invaders/tapes/extra_ship_award.lua"),
    coin=300,
    start=360,
    poke_frame=760,
    tally_val=0x20,  # above either 0x10/0x15 bonus threshold
    offset=24,
    pin_landmark=740,  # pre-poke; confirms the offset alignment
    win_lo=763,
    win_hi=770,  # after the award has fired (count risen, flag cleared)
    seconds=17,  # golden length; must reach past win_hi (17s ~= 1014 frames)
)


def capture_golden(mech, out_dir):
    """Capture the MAME golden state.bin for a mechanic scenario. Returns (ok, state_path, detail)."""
    env = dict(os.environ)
    env.update(
        TAPE_COIN_FRAME=str(mech["coin"]),
        TAPE_START_FRAME=str(mech["start"]),
        TAPE_POKE_FRAME=str(mech["poke_frame"]),
        TAPE_TALLY_VAL=str(mech["tally_val"]),
    )
    argv = [
        sys.executable,
        os.path.join(REPO, "tools/mame_golden.py"),
        "--hardware",
        HARDWARE,
        "--lua-dir",
        LUA_DIR,
        "--rompath",
        ROMPATH,
        "--tape",
        mech["scenario_lua"],
        "--out",
        out_dir,
        "--seconds",
        str(mech["seconds"]),
        "--no-frames",
    ]
    try:
        r = subprocess.run(
            argv, env=env, cwd=REPO, capture_output=True, text=True, timeout=1200
        )
    except (OSError, subprocess.SubprocessError) as e:
        return False, None, f"MAME golden capture failed to run: {e}"
    state = os.path.join(out_dir, "state.bin")
    if r.returncode != 0 or not os.path.exists(state):
        tail = (r.stdout + r.stderr).strip().splitlines()[-3:]
        return False, None, f"MAME golden capture did not certify ({' | '.join(tail)})"
    return True, state, ""


def run_compare(mech, state_path):
    """Run the JS-vs-MAME comparator. Returns (ok, detail) parsed from its RESULT line."""
    argv = [
        "node",
        MECH_COMPARE,
        "--golden",
        state_path,
        "--coin",
        str(mech["coin"]),
        "--start",
        str(mech["start"]),
        "--poke-frame",
        str(mech["poke_frame"]),
        "--offset",
        str(mech["offset"]),
        "--tally-val",
        str(mech["tally_val"]),
        "--pin-landmark",
        str(mech["pin_landmark"]),
        "--win-lo",
        str(mech["win_lo"]),
        "--win-hi",
        str(mech["win_hi"]),
    ]
    try:
        r = subprocess.run(argv, cwd=REPO, capture_output=True, text=True, timeout=600)
    except (OSError, subprocess.SubprocessError) as e:
        return False, f"comparator failed to run: {e}"
    m = re.search(r"^RESULT (PASS|FAIL)\b(.*)$", r.stdout + r.stderr, re.M)
    if not m:
        tail = (r.stdout + r.stderr).strip().splitlines()[-2:]
        return False, f"comparator produced no RESULT line ({' | '.join(tail)})"
    return m.group(1) == "PASS", m.group(2).strip()


def run_test(mech):
    """Run one mechanic test; print its MECHANIC result line. Returns True iff it PASSED."""
    mid = mech["id"]
    with tempfile.TemporaryDirectory(prefix=f"mech_{mid}_") as out_dir:
        ok, state, detail = capture_golden(mech, out_dir)
        if not ok:
            print(f"MECHANIC {mid} FAIL {detail}")
            return False
        ok, detail = run_compare(mech, state)
        print(f"MECHANIC {mid} {'PASS' if ok else 'FAIL ' + detail}")
        return ok


def main():
    return 0 if run_test(EXTRA_SHIP_AWARD) else 1


if __name__ == "__main__":
    sys.exit(main())
