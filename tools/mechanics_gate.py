#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Mechanic-coverage gate - a game cannot ship until every gameplay mechanic it declares is exercised by a
poke test that agrees with MAME.

WHY. Attract-mode and single-input gates are BLIND to gameplay: a collision / carry / death mechanic runs
identically whether it is right or wrong, because it never executes under those gates. A game shipped a false
in-play death that every green gate missed - the whole reason for this one. The model (poke, don't play): the
suite pokes each mechanic's STATE identically into the JS engine and MAME, drives a few frames, and asserts
the two SIDES AGREE (MAME is the oracle - no hand-authored expected value, so a faithful-but-wrong port fails
too).

WHAT THIS CHECKS (fail-closed; a ship-time gate, slow is fine):
  (1) manifest `mechanics: [ <id>, ... ]` - absent or empty => BLOCK (a game declaring none is untested).
  (2) games/<game>/tools/mechanics_suite.py - absent => BLOCK.
  (3) COVERAGE: run the suite; every declared id must have >=1 result. Uncovered => BLOCK - this is what
      stops a vacuous suite (one that passes while testing nothing fails coverage).
  (4) RESULT: every result must be PASS (JS agreed with MAME). Any FAIL => BLOCK (named).

THE HONEST LIMIT. A gate cannot prove the mechanic LIST is COMPLETE (mechanics are not mechanically
enumerable); that stays the adversarial done-audit's job. This enforces only "every LISTED mechanic is tested
and agrees with MAME". The suite owns the poke/MAME/compare machinery and its one-line-per-test contract
(`MECHANIC <id> PASS|FAIL`, exit 0 on a clean run). Subcommands: check --game <game>, selftest.
"""
import argparse
import contextlib
import io
import os
import re
import subprocess
import sys
import tempfile


def read_text(path):
    return open(path, encoding="utf-8").read() if os.path.exists(path) else ""


def declared_mechanics(manifest_text):
    """The list of mechanic ids from a manifest `mechanics: [ "a", "b", ... ]` block, else None.
    None (no block) is distinct from [] (an empty block) - both BLOCK, with different messages."""
    m = re.search(r"\bmechanics\s*:\s*\[(.*?)\]", manifest_text, re.S)
    if not m:
        return None
    return re.findall(r"[\"']([A-Za-z0-9_]+)[\"']", m.group(1))


# One result line per test: `MECHANIC <id> PASS` or `MECHANIC <id> FAIL <reason>`.
RESULT_RE = re.compile(r"^MECHANIC\s+([A-Za-z0-9_]+)\s+(PASS|FAIL)\b(.*)$", re.M)


def run_suite(path):
    """Run the game's mechanics suite. Returns (ran_ok, results) where results maps id -> list of
    (ok, detail). ran_ok is False on any launch/exit failure (fail-closed)."""
    try:
        r = subprocess.run(["python3", path], capture_output=True, text=True, timeout=2400)
    except (OSError, subprocess.SubprocessError) as e:
        return False, {"__launch__": [(False, f"suite failed to run: {e}")]}
    results = {}
    for mid, verdict, detail in RESULT_RE.findall(r.stdout + r.stderr):
        results.setdefault(mid, []).append((verdict == "PASS", detail.strip()))
    # A clean run must exit 0 AND have produced result lines; either failing is a fail-closed BLOCK.
    ran_ok = r.returncode == 0 and bool(results)
    if not ran_ok and not results:
        results["__launch__"] = [(False, f"suite exited {r.returncode} with no MECHANIC result lines")]
    return ran_ok, results


def check(game):
    base = f"games/{game}"
    fails = []

    ids = declared_mechanics(read_text(f"{base}/manifest.js"))
    if ids is None:
        fails.append("manifest declares no `mechanics: [...]` block (the game's mechanics are undeclared)")
    elif not ids:
        fails.append("manifest `mechanics` block is empty (a game with no declared mechanics is untested)")

    suite = f"{base}/tools/mechanics_suite.py"
    results = {}
    if not os.path.exists(suite):
        fails.append(f"no mechanics suite: {suite}")
    else:
        ran_ok, results = run_suite(suite)
        # Surface every FAIL result (and launch failures) as its own blocker line.
        for mid, runs in results.items():
            for ok, detail in runs:
                if not ok:
                    where = "suite" if mid == "__launch__" else f"mechanic '{mid}'"
                    fails.append(f"{where} FAILED{': ' + detail if detail else ''}")
        if not ran_ok and not any(mid == "__launch__" for mid in results):
            fails.append("mechanics suite did not complete cleanly")

    # Coverage: every DECLARED mechanic must have at least one (passing) test result.
    if ids:
        for mid in ids:
            runs = results.get(mid)
            if not runs:
                fails.append(f"declared mechanic '{mid}' has no covering test (uncovered)")

    if fails:
        print(f"mechanics [{game}]: BLOCK - the mechanic coverage is incomplete:", file=sys.stderr)
        for x in fails:
            print(f"  - {x}", file=sys.stderr)
        return 1
    print(f"mechanics [{game}]: OK ({len(ids)} declared mechanic(s), each covered by a poke test that "
          f"agrees with MAME).")
    return 0


def _fixture_game(root, game, manifest_body, suite_lines, suite_rc):
    """A synthetic game under `root`: a manifest and (optionally) a stub mechanics_suite.py that prints
    the given lines and exits `suite_rc`, so the selftest drives the REAL run_suite subprocess path."""
    gdir = os.path.join(root, "games", game)
    tdir = os.path.join(gdir, "tools")
    os.makedirs(tdir, exist_ok=True)
    if manifest_body is not None:
        with open(os.path.join(gdir, "manifest.js"), "w", encoding="utf-8") as fh:
            fh.write(manifest_body)
    if suite_lines is not None:
        src = "import sys\n" + "".join(f"print({ln!r})\n" for ln in suite_lines) + f"sys.exit({suite_rc})\n"
        with open(os.path.join(tdir, "mechanics_suite.py"), "w", encoding="utf-8") as fh:
            fh.write(src)


def _check_rc(root, game):
    """Drive the REAL check() from a fixture repo root (it reads relative paths); its own output muted."""
    saved = os.getcwd()
    try:
        os.chdir(root)
        with contextlib.redirect_stderr(io.StringIO()), contextlib.redirect_stdout(io.StringIO()):
            return check(game)
    finally:
        os.chdir(saved)


def selftest():
    ok = True
    # declared_mechanics: None when absent, the id list when present, [] when the block is empty.
    if declared_mechanics("boards: {}\ninputs: {}") is not None:
        print("selftest FAIL: mechanics found where there is no block", file=sys.stderr); ok = False
    got = declared_mechanics('mechanics: [\n  "collision_kill",\n  "goal_score",\n]')
    if got != ["collision_kill", "goal_score"]:
        print(f"selftest FAIL: mechanics parse -> {got}", file=sys.stderr); ok = False
    if declared_mechanics("mechanics: []") != []:
        print("selftest FAIL: empty mechanics block not detected", file=sys.stderr); ok = False
    # RESULT_RE parses PASS/FAIL result lines, ignoring surrounding suite chatter.
    hits = RESULT_RE.findall("running...\nMECHANIC collision_kill PASS\nMECHANIC fall_hazard FAIL drowned in JS, rode in MAME\n")
    if [(h[0], h[1]) for h in hits] != [("collision_kill", "PASS"), ("fall_hazard", "FAIL")]:
        print(f"selftest FAIL: result parse -> {hits}", file=sys.stderr); ok = False

    # Fixture-driven: drive the REAL check()/run_suite() so the fail-closed refusal is DEFENDED, not just
    # the parsers. A green selftest must prove the gate BLOCKS. The happy path runs FIRST as a positive
    # control: if it is not ACCEPTED, the BLOCK cases below would prove only that the gate rejects everything.
    M1 = 'export default { mechanics: ["m1"] };\n'
    M12 = 'export default { mechanics: ["m1", "m2"] };\n'
    cases = [
        ("happy path: declared + PASS -> allow", M1, ["MECHANIC m1 PASS"], 0, 0),
        ("declared but untested mechanic -> BLOCK", M12, ["MECHANIC m1 PASS"], 0, 1),
        ("suite prints FAIL -> BLOCK", M1, ["MECHANIC m1 FAIL diverged"], 0, 1),
        ("suite SKIP (exit 0, no result lines) -> BLOCK", M1, ["mechanics: SKIP no mame"], 0, 1),
        ("suite crash (nonzero, no result lines) -> BLOCK", M1, ["boom"], 1, 1),
        ("PASS then nonzero exit (crash after verdict) -> BLOCK", M1, ["MECHANIC m1 PASS"], 3, 1),
        ("no mechanics block -> BLOCK", 'export default { board: "x" };\n', ["MECHANIC m1 PASS"], 0, 1),
        ("empty mechanics block -> BLOCK", 'export default { mechanics: [] };\n', [], 0, 1),
    ]
    with tempfile.TemporaryDirectory() as root:
        for i, (label, manifest_body, lines, rc, want) in enumerate(cases):
            game = f"fix{i}"
            _fixture_game(root, game, manifest_body, lines, rc)
            got_rc = _check_rc(root, game)
            good = got_rc == want
            ok = ok and good
            print(f"  [{'ok ' if good else 'BAD'}] {label}: rc={got_rc} (expected {want})")
        # manifest present but the suite file is missing -> BLOCK.
        _fixture_game(root, "nosuite", M1, None, 0)
        got_rc = _check_rc(root, "nosuite")
        good = got_rc == 1
        ok = ok and good
        print(f"  [{'ok ' if good else 'BAD'}] missing suite file -> BLOCK: rc={got_rc} (expected 1)")

    print("selftest OK" if ok else "selftest FAILED")
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser(description="Mechanic-coverage completion gate.")
    ap.add_argument("cmd", choices=("check", "selftest"))
    ap.add_argument("--game", default=None)
    args = ap.parse_args()
    if args.cmd == "selftest":
        return selftest()
    if not args.game:
        ap.error("check requires --game")
    return check(args.game)


if __name__ == "__main__":
    sys.exit(main())
