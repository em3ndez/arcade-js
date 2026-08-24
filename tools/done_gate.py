#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Definition-of-done gate - "done" means a named gate ran and passed, never "it looks finished".

A game is shippable only when EVERY completion subsystem is green under its own gate. This runs them
all for one game and reports per-subsystem; exit 0 iff all pass. It exists because frogger was
declared "done" three times over with grounding, registers, and audio all still open - each a
subsystem with no gate guarding the done-claim. Subsystems:
  idiomatic   - tools/idiomatic_gate.py: the idiomatic layer holds ZERO CPU/memory cruft — no
                registers, no m.call, no m.push*, no raw 0xHHHH addresses.
  grounding   - no ungrounded [code]/[guess] proposals remain in names.js (the registry).
  audio       - tools/audio_gate.py: a wired, tested audio layer.
  pixel       - the game's idiomatic pixel suite matches MAME golden.
  whole-game  - the standing whole-game tests (boot/attract, tape, transition) pass.
Slow subsystems (pixel, suite) are fine: this is a ship-time gate, not per-commit. A subsystem whose
tooling is absent or errors is reported RED (fail-closed), never silently skipped.

Subcommand: check --game <game>.
"""
import argparse
import glob
import os
import re
import subprocess
import sys


def run(cmd):
    """Return (returncode, combined_output). rc=-1 on launch failure (fail-closed)."""
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=2400)
        return r.returncode, (r.stdout + r.stderr)
    except (OSError, subprocess.SubprocessError) as e:
        return -1, f"launch failed: {e}"


def check_idiomatic(game):
    rc, out = run(["python3", "tools/idiomatic_gate.py", "worklist", game])
    if rc != 0:
        return False, "idiomatic_gate worklist errored"
    m = re.search(rf"{re.escape(game)}:\s*total\s+(\d+)", out)
    if not m:
        return False, "could not read idiomatic cruft count"
    n = int(m.group(1))
    return (n == 0), (f"{n} CPU/memory cruft refs remain (registers + m.call + m.push* + raw 0xHHHH)"
                      if n else "0 cruft — the layer is idiomatic")


FIRST_TAG = re.compile(r"\[(seen|code|guess)\]")
GND_ARROW = re.compile(r"\[code\]\s*(?:->|→)\s*\[seen\]")  # "was [code], now [seen]" = grounded
CERT_ANY = re.compile(r'\bcert:\s*"')                       # a ROUTINES entry line (graded by its cert field)
CERT_UNGROUNDED = re.compile(r'\bcert:\s*"(code|guess)"')   # an ungrounded routine


def _line_ungrounded(ln):
    # Evidence = the FIRST bracketed tag; [code]/[guess] there = ungrounded (the `[code] not [seen]`
    # idiom keeps [code] first, so a trailing [seen] must NOT exempt). Skip the legend + [code]->[seen].
    if "evidence tag" in ln or GND_ARROW.search(ln):
        return False
    m = FIRST_TAG.search(ln)
    return bool(m and m.group(1) in ("code", "guess"))


def _count_grounding(lines):
    # Two kinds of claim in names.js, graded by DIFFERENT signals: a CELL by the [code]/[guess]/[seen]
    # bracket tag in its JSDoc; a ROUTINE by its ROUTINES-entry `cert:` field (which carries no bracket
    # tag). Count them separately -- a cert line is a routine even if its role prose holds a stray tag.
    cells = routines = 0
    for ln in lines:
        if CERT_ANY.search(ln):
            if CERT_UNGROUNDED.search(ln):
                routines += 1
        elif _line_ungrounded(ln):
            cells += 1
    return cells, routines


def check_grounding(game):
    # names.js (the registry) is the authoritative grounding artifact; mechanisms.md `[code]` are
    # accounted-for prose, not counted here.
    path = f"games/{game}/idiomatic/names.js"
    if not os.path.exists(path):
        return False, "no names.js"
    cells, routines = _count_grounding(open(path, encoding="utf-8", errors="replace").readlines())
    n = cells + routines
    detail = f"{cells} ungrounded cells + {routines} ungrounded routines" if n else "fully grounded"
    return (n == 0), detail


def check_audio(game):
    rc, out = run(["python3", "tools/audio_gate.py", "check", "--game", game])
    line = out.strip().splitlines()[-1] if out.strip() else ""
    return (rc == 0), line[:120]


def check_pixel(game):
    suite = f"games/{game}/tools/pixel_suite.py"
    if not os.path.exists(suite):
        return False, "no pixel_suite.py"
    rc, out = run(["python3", suite, "--layer", "idiomatic"])
    return (rc == 0), ("PASS" if rc == 0 else "pixel suite FAILED")


def check_wholegame(game):
    tests = sorted(glob.glob(f"games/{game}/test/*.test.js"))
    standing = [t for t in tests if re.search(r"(idiomatic|tape|transition)\.test\.js$", t)]
    if not standing:
        return False, "no standing whole-game tests found"
    rc, out = run(["node", "--test", *standing])
    return (rc == 0), ("PASS" if rc == 0 else "whole-game tests FAILED")


def check_wiring(game):
    """The repo-wide wiring invariants: every idiomatic module is DISPATCHED (registry-coverage), no
    idiomatic routine m.call()s an already-decompiled callee (no-stale-mcall), and no idiomatic module
    imports+calls the FROZEN copy of a routine that has an idiomatic twin (no-frozen-twin-call). These
    live in tools/test/, OUTSIDE the game tree, so check_wholegame's games/<g>/test glob never reaches
    them -- a done-authority that omits wiring is a check that cannot fail at the top of the stack, and
    every one of them runs the idiomatic layer as designed only if the wiring is sound. The gates are
    repo-wide (they discover their own games), so a wiring break in ANY game blocks the ship: the
    invariant is global, not per-game."""
    gates = ["registry-coverage", "no-stale-mcall", "no-frozen-twin-call"]
    for g in gates:
        path = f"tools/test/{g}.test.js"
        if not os.path.exists(path):
            return False, f"missing wiring gate {g}"
        rc, _ = run(["node", "--test", path])
        if rc != 0:
            return False, f"wiring gate {g} FAILED"
    return True, "PASS (registry-coverage, no-stale-mcall, no-frozen-twin-call)"


SUBSYSTEMS = [
    ("idiomatic", check_idiomatic),
    ("wiring", check_wiring),
    ("grounding", check_grounding),
    ("audio", check_audio),
    ("pixel", check_pixel),
    ("whole-game", check_wholegame),
]


def check(game):
    print(f"definition-of-done [{game}]:")
    all_ok = True
    for name, fn in SUBSYSTEMS:
        ok, detail = fn(game)
        all_ok = all_ok and ok
        print(f"  [{'OK ' if ok else 'RED'}] {name:<11} {detail}")
    if all_ok:
        print(f"\n{game}: DONE — every subsystem gate passed.")
        return 0
    print(f"\n{game}: NOT DONE — a subsystem gate is red (above). The ship is refused.", file=sys.stderr)
    return 1


def selftest():
    # the register-count regex and the grounding legend/proposal split are the only non-shell logic.
    ok = True
    if not re.search(r"register-elimination:\s*(\d+)\s+references", "register-elimination: 12 references across 3 modules"):
        print("selftest FAIL: register count regex", file=sys.stderr); ok = False
    cases = [
        (" * Names carry an evidence tag: [code] understood ...; [seen] observed", False),  # legend
        ('  role: "does X. [code] not [seen]: readers agree",', True),   # trailing [seen] must NOT exempt
        ('  role: "[code] (axis per the [seen] block)",', True),         # [code] first, [seen] justifies
        ('  role: "does X", cert: "seen",', False),                      # grounded
        ('  // 0x80 was [code]->[seen] once the tap fired', False),      # completion arrow
        ('  mem8[x] = 1;', False),                                       # no tag
    ]
    for ln, exp in cases:
        if _line_ungrounded(ln) != exp:
            print(f"selftest FAIL: grounding {ln!r} -> {_line_ungrounded(ln)} want {exp}", file=sys.stderr); ok = False
    # the cells/routines split: a cell is graded by its bracket tag, a routine by its cert field.
    split = _count_grounding([
        "/** [code] (unobservable) FOO bias */",                             # ungrounded cell
        "export const FOO = 0x8800;",
        "/** [seen] (golden: 0->1 at f302) BAR credit */",                   # grounded cell
        '  0x0714: { name: "loc_0714", role: "copy loop", cert: "code" },',  # ungrounded routine
        '  0x0a25: { name: "loc_0a25", role: "tile paint", cert: "seen" },', # grounded routine
    ])
    if split != (1, 1):
        print(f"selftest FAIL: grounding split -> {split} want (1, 1)", file=sys.stderr); ok = False
    print("selftest OK" if ok else "selftest FAILED")
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser(description="Definition-of-done gate: every subsystem must pass.")
    ap.add_argument("cmd", choices=("check", "selftest"))
    ap.add_argument("--game", default="frogger")
    args = ap.parse_args()
    return selftest() if args.cmd == "selftest" else check(args.game)


if __name__ == "__main__":
    sys.exit(main())
