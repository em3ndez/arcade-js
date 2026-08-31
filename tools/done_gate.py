#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Definition-of-done gate - "done" means a named gate ran and passed, never "it looks finished".

A game is shippable only when EVERY completion subsystem is green under its own gate AND the adversarial
done-audit has landed as a committed games/<game>/DONE.md (runbook §5, reviewer-rule R40): subsystem-green
is the PRE-FILTER, never sufficient on its own. This runs the subsystems for one game and reports
per-subsystem; exit 0 iff all pass AND the DONE.md record is committed. It exists because frogger was
declared "done" three times over with grounding, registers, and audio all still open - each a
subsystem with no gate guarding the done-claim. Subsystems:
  idiomatic   - tools/idiomatic_gate.py: the idiomatic layer holds ZERO CPU/memory cruft — no
                registers, no m.call, no m.push*, no raw 0xHHHH addresses.
  grounding   - no ungrounded [code]/[guess] proposals remain in names.js (the registry).
  naming      - tools/naming_gate.py: every grounded idiomatic routine has a descriptive name, not loc_.
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
CELL_CONST = re.compile(r"^export const [A-Z0-9_]+\s*=\s*(0x[0-9a-f]+)\s*;")  # a named cell -> its address
ROUT_ADDR = re.compile(r"^\s*(0x[0-9a-f]+):")                                  # a ROUTINES entry -> its address


def _line_ungrounded(ln):
    # Evidence = the FIRST bracketed tag; [code]/[guess] there = ungrounded (the `[code] not [seen]`
    # idiom keeps [code] first, so a trailing [seen] must NOT exempt). Skip the legend + [code]->[seen].
    # A `//` line comment (a section divider `// == Batch ... [code] ==` or prose) is NEVER a cell's
    # JSDoc tag -- a cell tag lives in a /** ... */ block -- so its stray [code] has no cell and must
    # not be counted as one (else the divider is a phantom ungrounded cell that can never be grounded).
    if ln.lstrip().startswith("//"):
        return False
    if "evidence tag" in ln or GND_ARROW.search(ln):
        return False
    m = FIRST_TAG.search(ln)
    return bool(m and m.group(1) in ("code", "guess"))


def _count_grounding(lines):
    # Two kinds of claim in names.js, graded by DIFFERENT signals: a CELL by the [code]/[guess]/[seen]
    # bracket tag in its JSDoc; a ROUTINE by its ROUTINES-entry `cert:` field (which carries no bracket
    # tag). Count them separately -- a cert line is a routine even if its role prose holds a stray tag.
    # Also collect each ungrounded item's ADDRESS (a cell's is on the `export const` line below its
    # JSDoc; a routine's is on the cert line) so check_grounding can subtract the accounted-for allowlist.
    cells = routines = 0
    cell_addrs, rout_addrs = [], []
    for i, ln in enumerate(lines):
        if CERT_ANY.search(ln):
            if CERT_UNGROUNDED.search(ln):
                routines += 1
                m = ROUT_ADDR.match(ln)
                rout_addrs.append(int(m.group(1), 16) if m else None)
        elif _line_ungrounded(ln):
            cells += 1
            a = None
            for j in range(i + 1, min(i + 8, len(lines))):
                mc = CELL_CONST.match(lines[j])
                if mc:
                    a = int(mc.group(1), 16)
                    break
            cell_addrs.append(a)
    return cells, routines, cell_addrs, rout_addrs


def _read_grounding_debt(game):
    # games/<game>/grounding-debt.txt accounts for the honestly-IRREDUCIBLE ungrounded items -- a role
    # that can never terminate in a MAME observation on a good ROM (an anti-tamper clone that runs only on
    # a tampered ROM; a ROM constant read only by the checksum sweep). One "0xADDR  reason" per line
    # (# comments / blank lines ignored). done_gate SUBTRACTS these so the gate enforces the runbook's
    # "accounted-for by a reasoned note" rule -- and stays honest: a reasonless entry, or one whose address
    # is NOT actually ungrounded, BLOCKS (check_grounding). Each entry is reviewer-verified as genuinely
    # irreducible, proposer != confirmer (reviewer-rules R39).
    path = f"games/{game}/grounding-debt.txt"
    debt = {}
    if not os.path.exists(path):
        return debt
    for ln in open(path, encoding="utf-8", errors="replace"):
        ln = ln.split("#", 1)[0].strip()
        if not ln:
            continue
        parts = ln.split(None, 1)
        try:
            a = int(parts[0], 16)
        except ValueError:
            continue
        debt[a] = parts[1].strip() if len(parts) > 1 else ""
    return debt


def check_grounding(game):
    # names.js (the registry) is the authoritative grounding artifact; mechanisms.md `[code]` are
    # accounted-for prose, not counted here. grounding-debt.txt subtracts the honestly-irreducible tail.
    path = f"games/{game}/idiomatic/names.js"
    if not os.path.exists(path):
        return False, "no names.js"
    cells, routines, cell_addrs, rout_addrs = _count_grounding(
        open(path, encoding="utf-8", errors="replace").readlines())
    debt = _read_grounding_debt(game)
    noreason = sorted(a for a, r in debt.items() if not r)
    if noreason:
        return False, "grounding-debt.txt: entries need a reason -> " + ", ".join(hex(a) for a in noreason)
    ung = {a for a in cell_addrs + rout_addrs if a is not None}
    stale = sorted(set(debt) - ung)
    if stale:
        return False, ("grounding-debt.txt: stale (already-grounded / not an ungrounded claim) -> "
                       + ", ".join(hex(a) for a in stale))
    acc_cells = sum(1 for a in cell_addrs if a is not None and a in debt)
    acc_rout = sum(1 for a in rout_addrs if a is not None and a in debt)
    rem_cells, rem_rout = cells - acc_cells, routines - acc_rout
    acc = acc_cells + acc_rout
    tail = f" ({acc} accounted-for via grounding-debt.txt)" if acc else ""
    if rem_cells + rem_rout == 0:
        return True, "fully grounded" + tail
    return False, f"{rem_cells} ungrounded cells + {rem_rout} ungrounded routines" + tail


def check_audio(game):
    rc, out = run(["python3", "tools/audio_gate.py", "check", "--game", game])
    line = out.strip().splitlines()[-1] if out.strip() else ""
    return (rc == 0), line[:120]


def check_pixel(game):
    # The DONE gate runs the FULL pixel path (--done), NOT the bare attract-prefix default the per-commit
    # tripwire (tools/pixel_gate_required.py) runs: --done adds attract COMPLETENESS past the former crash
    # frames + tape-driven GAMEPLAY vs the MAME golden, closing the green-but-blind hole where gameplay was
    # pixel-validated NOWHERE (runbook 5: an attract-only gate must NOT count green for done). PASS is the
    # literal `pixel_suite: PASS` line, never the exit code (the suite exits 0 when it CANNOT run -- no
    # mame/romset); a suite that does not accept --done is a stale attract-only gate and must not pass.
    suite = f"games/{game}/tools/pixel_suite.py"
    if not os.path.exists(suite):
        return False, "no pixel_suite.py"
    # Legacy pre-runbook ports (runbook "Legacy games": do not retrofit) are grandfathered on the attract
    # pixel gate; the --done gameplay bar is the go-forward standard for games ported under the runbook.
    LEGACY_ATTRACT_ONLY = {"frogger", "timeplt", "thepit"}
    if "--done" not in open(suite, encoding="utf-8", errors="replace").read():
        if game not in LEGACY_ATTRACT_ONLY:
            return False, "pixel_suite.py has no --done mode (attract-only gate is blind to gameplay)"
        rc, out = run(["python3", suite, "--layer", "idiomatic"])
        ok = rc == 0 and re.search(r"^pixel_suite: PASS", out, re.M) is not None
        return ok, ("PASS (legacy attract-only, grandfathered)" if ok else "pixel suite FAILED")
    rc, out = run(["python3", suite, "--layer", "idiomatic", "--done"])
    passed = rc == 0 and re.search(r"^pixel_suite: PASS", out, re.M) is not None
    if passed:
        return True, "PASS (--done: attract completeness + gameplay vs MAME)"
    last = next((ln for ln in reversed(out.splitlines()) if ln.strip()), "")
    return False, "pixel --done FAILED: " + last[:90]


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


def check_naming(game):
    """Every grounded (cert:"seen") idiomatic ROUTINE must carry a descriptive EFFECT name, not loc_<addr>
    (runbook §4-end cleanup: it RENAMES loc_->descriptive leaf-first, it does not only comment). Enforced by
    tools/naming_gate.py -- legacy pre-runbook ports grandfathered; a reviewed games/<game>/names-debt.txt
    allowlist subtracts a genuinely-effect-unnameable routine. Wired here so a game cannot reach DONE while
    the RENAME half of the cleanup is skipped -- the exact gap that once let a sweep ship comment-only."""
    rc, out = run(["python3", "tools/naming_gate.py", "check", "--game", game])
    summary = next((ln for ln in out.splitlines() if ln.startswith(f"naming [{game}]:")), "")
    detail = summary.split(":", 1)[1].strip() if summary else ("PASS" if rc == 0 else "grounded loc_ routines remain")
    return (rc == 0), detail[:120]


SUBSYSTEMS = [
    ("idiomatic", check_idiomatic),
    ("wiring", check_wiring),
    ("grounding", check_grounding),
    ("naming", check_naming),
    ("audio", check_audio),
    ("pixel", check_pixel),
    ("whole-game", check_wholegame),
]


def done_record_committed(game, tracked=None):
    """True iff games/<game>/DONE.md is a COMMITTED (git-tracked) file -- the landed, reviewer-verified
    adversarial done-audit (runbook §5, reviewer-rule R40). review_gate refuses that commit without an
    independent PASS, so a committed record IS the proof an independent agent agreed the game is done; a
    green pre-filter alone is never sufficient. An untracked working-tree DONE.md has not passed review,
    so it does not count. `tracked` is a test seam (a set of paths) that bypasses git."""
    path = f"games/{game}/DONE.md"
    if tracked is not None:
        return path in tracked
    rc, _ = run(["git", "ls-files", "--error-unmatch", path])
    return rc == 0


def check(game):
    print(f"definition-of-done [{game}]:")
    all_ok = True
    for name, fn in SUBSYSTEMS:
        ok, detail = fn(game)
        all_ok = all_ok and ok
        print(f"  [{'OK ' if ok else 'RED'}] {name:<11} {detail}")
    if not all_ok:
        print(f"\n{game}: NOT DONE — a subsystem gate is red (above). The ship is refused.", file=sys.stderr)
        return 1
    if done_record_committed(game):
        print(f"\n{game}: DONE — every subsystem gate passed and the adversarial done-audit is on "
              f"record (games/{game}/DONE.md).")
        return 0
    print(f"\n{game}: NOT DONE — subsystem gates are green (pre-filter), but no committed "
          f"games/{game}/DONE.md: the adversarial done-audit (runbook §5, reviewer-rule R40) has not "
          f"landed. A green pre-filter is necessary, never sufficient.", file=sys.stderr)
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
        ('// == Batch: leaves-first decompile cells [code] (pending) ==', False),  # phantom divider
        ('// observation ...; [code] role read from the translated', False),       # phantom prose
        ('/** [code] a real ungrounded cell */', True),                 # a genuine JSDoc cell tag
    ]
    for ln, exp in cases:
        if _line_ungrounded(ln) != exp:
            print(f"selftest FAIL: grounding {ln!r} -> {_line_ungrounded(ln)} want {exp}", file=sys.stderr); ok = False
    # the cells/routines split + address extraction: a cell is graded by its bracket tag (address on the
    # export const below it), a routine by its cert field (address on the cert line).
    cells, routines, cell_addrs, rout_addrs = _count_grounding([
        "/** [code] (unobservable) FOO bias */",                             # ungrounded cell
        "export const FOO = 0x8800;",
        "/** [seen] (golden: 0->1 at f302) BAR credit */",                   # grounded cell
        '  0x0714: { name: "loc_0714", role: "copy loop", cert: "code" },',  # ungrounded routine
        '  0x0a25: { name: "loc_0a25", role: "tile paint", cert: "seen" },', # grounded routine
    ])
    if (cells, routines, cell_addrs, rout_addrs) != (1, 1, [0x8800], [0x0714]):
        print(f"selftest FAIL: grounding split -> {(cells, routines, cell_addrs, rout_addrs)} "
              "want (1, 1, [0x8800], [0x0714])", file=sys.stderr); ok = False
    # accounting: a grounding-debt entry subtracts an ungrounded item by ADDRESS (0x8800 here -> 1 accounted).
    if sum(1 for a in cell_addrs + rout_addrs if a in {0x8800}) != 1:
        print("selftest FAIL: grounding accounting arithmetic", file=sys.stderr); ok = False
    # done-record: subsystem-green is only the PRE-FILTER; "done" also needs a COMMITTED DONE.md. The
    # helper counts a record only when git-tracked (an untracked working-tree DONE.md has not been reviewed).
    if not done_record_committed("x", tracked={"games/x/DONE.md"}):
        print("selftest FAIL: done_record_committed missed a tracked DONE.md", file=sys.stderr); ok = False
    if done_record_committed("x", tracked=set()):
        print("selftest FAIL: done_record_committed counted an absent DONE.md", file=sys.stderr); ok = False
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
