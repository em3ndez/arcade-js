#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""A §4 decompile batch must be ADD-ONLY w.r.t. previously-committed routine modules.

A decompile batch ADDS new idiomatic/translated routine modules; it must not MODIFY or DELETE an already-
committed routine module in the SAME commit. A batch partition that overlapped committed routines once had
agents RE-TRANSLATE and DELETE shipped, reviewed code -- caught only by a stray "41 M" in staging (retro
finding F8, previously un-gated). This is a write-time interlock (model: tools/pixel_gate_required.py): it
reads the staged index and refuses.

THE DISCRIMINATOR (derived from the git history, so it does NOT false-block legit work): the §4 commit kinds
are cleanly separable by diff STATUS.
  * a DECOMPILE batch is pure ADDs (git `A`) of new routine modules;
  * an UNDERSTANDING pass RENAMES an existing routine (loc_<addr>.js -> descriptive.js) -- git reports a
    RENAME (`R` under -M), NEVER a pure add of a new module;
  * a bug fix MODIFIES an existing module (`M`) but adds no new one.
So the ONLY commit that both adds new routine modules AND touches committed ones is the partition-overlap
accident:
  RED  <=> staged set ADDS >=1 new routine module (A) AND ALSO M/D (not R) an already-committed routine module.
  PASS <=> a pure-add batch (A only); a rename pass (R); a bug fix (M, no A); anything with no new routine add.

SCOPE: games/<g>/idiomatic/*.js and games/<g>/translated/*.js ROUTINE modules only -- EXCLUDING the generated
registry + names.js (a batch legitimately regenerates those) and test/ files (a deeper path). A genuine one-off
dissolve (a real M/D of a committed routine inside a batch, rare) takes the approved --no-verify escape, like
any exceptional commit. Subcommands: check (reads the staged index), selftest.
"""
import re
import subprocess
import sys

ROUTINE_PATH = re.compile(r"^games/[^/]+/(?:idiomatic|translated)/[^/]+\.js$")
EXCLUDE_BASENAMES = {"_registry.generated.js", "names.js"}


def is_routine(path):
    """A game idiomatic/translated ROUTINE module (not the generated registry, names.js, or a test/ file)."""
    return bool(ROUTINE_PATH.match(path)) and path.rsplit("/", 1)[-1] not in EXCLUDE_BASENAMES


def classify(name_status_text):
    """Split a `git diff --cached --name-status -M` block into (added_routines, touched_committed_routines).
    Renames (R) are skipped (a legit understanding pass); only pure A / M / D of routine modules count."""
    added, touched = [], []
    for line in name_status_text.splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        status = parts[0]
        if status.startswith("R") or status.startswith("C"):  # rename / copy -> old preserved, not a loss
            continue
        if status[0] not in "AMD":
            continue
        path = parts[1]
        if not is_routine(path):
            continue
        if status[0] == "A":
            added.append(path)
        else:  # M or D of an already-committed routine module
            touched.append((status[0], path))
    return added, touched


def verdict_red(added, touched):
    """RED iff a batch ADDS new routine modules AND ALSO modifies/deletes previously-committed ones."""
    return bool(added) and bool(touched)


def check():
    out = subprocess.run(["git", "diff", "--cached", "--name-status", "-M"],
                         capture_output=True, text=True).stdout
    added, touched = classify(out)
    if verdict_red(added, touched):
        print("decompile-addonly: BLOCKED — a batch that ADDS new routine modules must not MODIFY/DELETE "
              "previously-committed ones.", file=sys.stderr)
        print(f"  the staged set adds {len(added)} new routine module(s) (e.g. {added[0]}) AND also:", file=sys.stderr)
        for st, p in touched[:8]:
            print(f"    {'DELETES' if st == 'D' else 'MODIFIES'} committed routine {p}", file=sys.stderr)
        print("  A partition that overlaps committed routines re-translates/loses shipped, reviewed code "
              "(retro F8). A rename (loc_->name) is an understanding pass and is allowed; a genuine dissolve "
              "uses the per-commit-approved --no-verify escape.", file=sys.stderr)
        return 1
    print("decompile-addonly: OK (no batch-add that also modifies/deletes a committed routine module).")
    return 0


def selftest():
    ok = True

    def want(desc, red, block):
        nonlocal ok
        if red != block:
            print(f"selftest FAIL: {desc} (verdict_red={red}, expected {block})", file=sys.stderr)
            ok = False

    # is_routine scoping
    assert is_routine("games/galaxian/idiomatic/stepAlienShot.js")
    assert is_routine("games/frogger/translated/loc_0368.js")
    assert not is_routine("games/galaxian/idiomatic/_registry.generated.js")
    assert not is_routine("games/galaxian/idiomatic/names.js")
    assert not is_routine("games/galaxian/idiomatic/test/equivalence-0010.test.js")
    assert not is_routine("games/galaxian/machine.js")
    assert not is_routine("tools/decompile_addonly_gate.py")

    def V(block):
        return verdict_red(*classify(block))

    # PASS cases
    want("pure-add batch (+ registry regen)", V(
        "A\tgames/x/idiomatic/loc_1000.js\nA\tgames/x/idiomatic/loc_1010.js\n"
        "M\tgames/x/idiomatic/_registry.generated.js\nM\tgames/x/idiomatic/names.js\n"), False)
    want("understanding rename pass", V(
        "R100\tgames/x/idiomatic/loc_1000.js\tgames/x/idiomatic/stepThing.js\n"
        "M\tgames/x/idiomatic/names.js\n"), False)
    want("bug fix (modify only, no add)", V("M\tgames/x/idiomatic/existing.js\n"), False)
    want("add batch + only a test/registry change", V(
        "A\tgames/x/idiomatic/loc_2000.js\nM\tgames/x/idiomatic/test/equivalence-2000.test.js\n"), False)
    # RED cases
    want("batch-add + MODIFY of a committed routine (the 41-M accident)", V(
        "A\tgames/x/idiomatic/loc_2000.js\nM\tgames/x/idiomatic/committed.js\n"), True)
    want("batch-add + DELETE of a committed routine", V(
        "A\tgames/x/idiomatic/loc_2000.js\nD\tgames/x/idiomatic/committed.js\n"), True)
    want("batch-add + DELETE of a committed translated routine", V(
        "A\tgames/x/idiomatic/loc_2000.js\nD\tgames/x/translated/loc_9999.js\n"), True)

    print("selftest OK" if ok else "selftest FAILED", file=sys.stderr if not ok else sys.stdout)
    return 0 if ok else 1


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    if cmd == "selftest":
        return selftest()
    if cmd == "check":
        return check()
    print(f"usage: {sys.argv[0]} [check|selftest]", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
