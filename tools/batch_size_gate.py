#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Batch-size gate — make "fan out, don't dribble" a MECHANICAL prerequisite, not a wish.

The failure mode this exists to stop: the translation pass drifts back to tiny batches
(4 agents / ~11 routines) no matter how emphatically the runbook says "fan aggressively".
Prose that does not halt a commit is decoration and gets skipped. This gate halts it.

What it does
------------
At pre-commit it counts the NEW translated routine files in the staged commit and refuses a
commit that adds too few of them WHILE more remain to translate.

* N = staged files with status A (added) matching ``games/<game>/translated/loc_<hex>.js``
  (routine files; the ``test/`` subdir is excluded). N is the batch's routine count.
  **N == 0 -> the gate is INERT and passes** — a bug-fix to an existing routine is a MODIFY,
  not an add, so is never touched; nor is a tool/doc/test/registry commit. Only a
  fresh-translation batch is held to the floor.
* R = "remaining frontier" = distinct ``m.call(0x____)`` targets across the post-commit
  translated layer for that game that do NOT yet have a ``loc_<addr>.js`` file. Cheap
  (regex + set-difference, no decode/BFS). It UNDERCOUNTS true remaining work, which is the
  safe direction: R >= 1 means there is definitely more you could have pulled into this batch.

The rule (fail closed)
----------------------
For each game with added routine files:
  * PASS if N >= FLOOR (the batch is big enough), OR
  * PASS if R == 0 (the frontier is now closed — this was the finishing batch, any size), else
  * BLOCK — unless a single-use waiver is on file for this exact staged diff.

That forces every batch to >= FLOOR until the last one that drives R to 0 (and stops the tail
being dribbled: if 8 remain you must do all 8, not 3).

The waiver (accountable, not silent)
------------------------------------
``batch_size_gate.py waive --reason "<why>"`` writes ``.batchsize-waivers/<diff_id>.json`` bound
to the sha256 of the staged diff — so it is CONSUMED the instant the staged content changes
(edit one byte and the waiver no longer matches). It cannot be left on permanently, and the
reason is on file. Use it for a genuine small ADD (e.g. splitting a mis-merged routine into a
new file); a routine escape hatch would make the gate decoration again.

FAIL CLOSED: any git error blocks rather than reading as "nothing to check".

Honest limits (stated, not hidden)
----------------------------------
* ``--no-verify`` bypasses any local hook; a determined agent could forge a waiver. This stops
  DRIFT (the real failure mode), not a deliberate bypass.
* R is read from the working-tree file contents (fast), not the staged blobs; at commit time
  those agree for the staged batch. An unrelated UNSTAGED loc_ file on disk would perturb R —
  but the single-threaded-across-batches rule means no such file exists at commit time.
* FLOOR (40) is set below the ~50 target so heavy loop-latch INLINING (which turns ~50 routines
  into ~40 files) does not false-block an honest big batch. It is a minimum, not the target.

Subcommands
-----------
  id                  print the current staged diff_id
  check               the hook calls this; exit 1 if a too-small batch is staged (fail closed)
  plan --game G       advisory: print N-so-far and R for game G (use at SCOPING time, pre-fan)
  waive --reason S    write a single-use waiver bound to the staged diff
  install             wire core.hooksPath = hooks
  selftest            prove the rule + controls against a throwaway repo
"""
import argparse
import contextlib
import glob
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

FLOOR = 40  # minimum routines a fresh-translation batch must add while the frontier is open

# games/<game>/translated/loc_<hex>.js  (NOT under a test/ subdir)
LOC_RE = re.compile(r"^games/([^/]+)/translated/loc_([0-9a-fA-F]+)\.js$")
CALL_RE = re.compile(r"m\.call\(0x([0-9a-fA-F]+)\)")
# An address-owning export INSIDE a file: a file can hold several routines (gen-registry's
# discover() registers each), so an m.call target is covered by the EXPORT, not the filename.
# `\b` after the 4 hex excludes helper splits `loc_<parent>_<addr>` (never address-owners); anchored
# to line-start so a commented/quoted "export function loc_XXXX" cannot be miscredited as coverage.
EXPORT_RE = re.compile(r"^\s*export function loc_([0-9a-fA-F]{4})\b", re.M)


class GitError(RuntimeError):
    """A git invocation failed — callers turn this into a BLOCK (fail closed)."""


def repo_root():
    r = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True)
    if r.returncode != 0 or not r.stdout.strip():
        raise GitError(r.stderr.strip() or "not inside a git work tree")
    return r.stdout.strip()


def git(args):
    """Run git at REPO; raise GitError on any non-zero exit so callers fail CLOSED."""
    r = subprocess.run(["git", *args], capture_output=True, text=True, cwd=REPO)
    if r.returncode != 0:
        raise GitError(f"`git {' '.join(args)}` failed (exit {r.returncode}): {r.stderr.strip()}")
    return r.stdout


def staged_diff():
    """Staged diff with flags pinned so the waiver's diff_id is reproducible."""
    return git(["diff", "--cached", "--no-color", "--no-ext-diff", "-U0", "--full-index"])


def diff_id(diff):
    return hashlib.sha256(diff.encode()).hexdigest()


def added_routine_files():
    """{game: set(hex_addr)} for loc_<addr>.js files with git status A (added) in the staged set."""
    out = git(["diff", "--cached", "--name-status", "--no-renames"])
    added = {}
    for line in out.splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        status, path = parts[0], parts[-1]
        if not status.startswith("A"):  # only ADDED files are a "new routine"; M/D never count
            continue
        m = LOC_RE.match(path)
        if m:
            added.setdefault(m.group(1), set()).add(m.group(2).lower())
    return added


def remaining_frontier(game):
    """R for one game: distinct m.call targets across its translated layer with no loc_ file.

    Reads the working-tree files (fast); at commit time they equal the staged batch. Uses the
    INDEX file list (git ls-files) as the covered set so an unstaged stray file cannot pose as
    covered. Missing dir / no files -> 0 (nothing to translate here yet)."""
    tdir = f"games/{game}/translated"
    listed = git(["ls-files", f"{tdir}/loc_*.js"]).split()
    covered = set()
    targets = set()
    for rel in listed:
        m = LOC_RE.match(rel)
        if m:
            covered.add(m.group(2).lower())
        p = os.path.join(REPO, rel)
        try:
            text = open(p, encoding="utf-8", errors="replace").read()
        except OSError:
            continue
        for e in EXPORT_RE.findall(text):  # multi-routine files: credit EVERY address-owning export
            covered.add(e.lower())
        for t in CALL_RE.findall(text):
            targets.add(t.lower())
    return len(targets - covered), targets - covered


def classify(n_added, r_remaining, floor=FLOOR):
    """Pure rule (positive-control-tested in selftest). Returns (ok: bool, reason: str)."""
    if n_added == 0:
        return True, "inert (no routine files added)"
    if n_added >= floor:
        return True, f"batch OK: {n_added} routines added (floor {floor})"
    if r_remaining == 0:
        return True, f"finishing batch: {n_added} added and the frontier is now closed"
    return False, (
        f"batch too small: {n_added} routines added, floor is {floor}, and {r_remaining} "
        f"call-target(s) remain uncovered"
    )


def waiver_path(did):
    return os.path.join(WAIVERS, did + ".json")


def cmd_id(_a):
    print(diff_id(staged_diff()))
    return 0


def cmd_check(_a):
    added = added_routine_files()
    if not added:
        return 0  # inert: no fresh routines in this commit
    did = diff_id(staged_diff())
    problems = []
    for game, addrs in sorted(added.items()):
        n = len(addrs)
        r, _ = remaining_frontier(game)
        ok, reason = classify(n, r)
        if not ok:
            problems.append((game, reason))
    if not problems:
        return 0
    # A single-use waiver bound to this exact staged diff clears the block.
    wp = waiver_path(did)
    if os.path.exists(wp):
        try:
            w = json.load(open(wp))
            why = w.get("reason", "")
        except (OSError, json.JSONDecodeError) as e:
            sys.stderr.write(f"\nCOMMIT BLOCKED — batch-size waiver {wp} is unreadable ({e}).\n\n")
            return 1
        print(f"batch_size_gate: WAIVED for diff {did[:12]} — {why}")
        return 0
    msg = "; ".join(f"{g}: {why}" for g, why in problems)
    sys.stderr.write(
        "\nCOMMIT BLOCKED — batch_size_gate: " + msg + ".\n"
        "  Fan wider — target ~50 routines across ~15 agents (see docs/runbook.md section 3).\n"
        "  For a genuine small ADD (e.g. splitting a mis-merged routine), record a single-use waiver:\n"
        f'    python3 tools/batch_size_gate.py waive --reason "<why>"\n'
        "  Do NOT --no-verify around this.\n\n"
    )
    return 1


def cmd_plan(args):
    """Advisory (run at scoping time, before firing the fan): N-so-far and R for a game."""
    added = added_routine_files().get(args.game, set())
    r, missing = remaining_frontier(args.game)
    print(f"{args.game}: {len(added)} routine file(s) staged-added; {r} call-target(s) still uncovered.")
    ok, reason = classify(len(added), r)
    print(f"  -> {'OK' if ok else 'TOO SMALL'}: {reason}")
    if r:
        show = " ".join("0x" + a for a in sorted(missing)[:20])
        print(f"  uncovered (first 20): {show}")
    return 0


def cmd_waive(args):
    diff = staged_diff()
    if not diff.strip():
        sys.stderr.write("nothing staged to waive.\n")
        return 1
    did = diff_id(diff)
    os.makedirs(WAIVERS, exist_ok=True)
    json.dump(
        {"diff_id": did, "reason": args.reason, "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
        open(waiver_path(did), "w"), indent=2,
    )
    print(f"batch-size waiver recorded for diff {did[:12]} — {args.reason}")
    print("  (single-use: it stops matching the instant the staged content changes)")
    return 0


def cmd_install(_a):
    git(["config", "core.hooksPath", "hooks"])
    print("installed: core.hooksPath = hooks (batch-size gate active)")
    return 0


def _case(label, fn, want, failures):
    buf_o, buf_e = io.StringIO(), io.StringIO()
    try:
        with contextlib.redirect_stdout(buf_o), contextlib.redirect_stderr(buf_e):
            got = fn()
    except Exception as e:
        failures.append(f"{label}: raised {type(e).__name__}: {e}")
        return
    if got != want:
        failures.append(f"{label}: got {got!r}, expected {want!r}")


def cmd_selftest(_a):
    """Prove the rule + its CONTROLS. A gate that always says PASS would be useless, so the
    small-batch-with-frontier-open case MUST block, and the controls (big batch, closed
    frontier, waiver, inert) must pass."""
    global REPO, WAIVERS
    saved = (REPO, WAIVERS)
    failures = []

    # 1) Pure-rule matrix (the load-bearing logic, no git).
    _case("pure: inert", lambda: classify(0, 999)[0], True, failures)
    _case("pure: small+open BLOCKS", lambda: classify(11, 40)[0], False, failures)
    _case("pure: big passes", lambda: classify(40, 40)[0], True, failures)
    _case("pure: big passes (over)", lambda: classify(56, 40)[0], True, failures)
    _case("pure: small+closed passes", lambda: classify(8, 0)[0], True, failures)
    _case("pure: floor boundary (39 open) BLOCKS", lambda: classify(39, 1)[0], False, failures)

    # 2) End-to-end against a throwaway repo (file detection + R plumbing + waiver + inert).
    tmp = tempfile.mkdtemp(prefix="batchsize-selftest-")
    try:
        for c in (["init", "-q", tmp], ["-C", tmp, "config", "user.email", "t@t"],
                  ["-C", tmp, "config", "user.name", "t"]):
            subprocess.run(["git", *c], check=True, capture_output=True)
        tdir = os.path.join(tmp, "games", "g", "translated")
        os.makedirs(os.path.join(tdir, "test"))
        # A baseline committed routine that CALLS an as-yet-untranslated 0x9000 (keeps R>0).
        open(os.path.join(tdir, "loc_1000.js"), "w").write("export function loc_1000(m){ m.call(0x9000); }\n")
        subprocess.run(["git", "-C", tmp, "add", "-A"], check=True, capture_output=True)
        subprocess.run(["git", "-C", tmp, "commit", "-qm", "base"], check=True, capture_output=True)
        REPO, WAIVERS = tmp, os.path.join(tmp, ".batchsize-waivers")

        # (a) stage a doc change only -> inert PASS
        open(os.path.join(tmp, "README"), "w").write("hi\n")
        subprocess.run(["git", "-C", tmp, "add", "README"], check=True, capture_output=True)
        _case("e2e: non-routine commit inert", lambda: cmd_check(None), 0, failures)
        subprocess.run(["git", "-C", tmp, "reset", "-q"], check=True, capture_output=True)

        # (b) add 2 routines, both leaving 0x9000 uncovered -> R>0, small -> BLOCK
        for a in ("2000", "2001"):
            open(os.path.join(tdir, f"loc_{a}.js"), "w").write(f"export function loc_{a}(m){{}}\n")
        subprocess.run(["git", "-C", tmp, "add", "-A"], check=True, capture_output=True)
        _case("e2e: small batch + open frontier BLOCKS", lambda: cmd_check(None), 1, failures)

        # (c) same staged diff + a waiver -> PASS
        did = diff_id(staged_diff())
        os.makedirs(WAIVERS, exist_ok=True)
        json.dump({"diff_id": did, "reason": "selftest"}, open(waiver_path(did), "w"))
        _case("e2e: waiver clears the block", lambda: cmd_check(None), 0, failures)

        # (d) now ALSO add loc_9000.js (covers the only target) -> R==0 -> PASS even though small
        os.remove(waiver_path(did))
        open(os.path.join(tdir, "loc_9000.js"), "w").write("export function loc_9000(m){}\n")
        subprocess.run(["git", "-C", tmp, "add", "-A"], check=True, capture_output=True)
        _case("e2e: closing the frontier passes", lambda: cmd_check(None), 0, failures)

        # (e) POSITIVE CONTROL for export-crediting: a NEW target 0xd000 covered ONLY by a SECONDARY
        # export inside a differently-named multi-routine file. Filename-only coverage would miss it
        # (R>0, small -> BLOCK); crediting the export closes it -> PASS.
        open(os.path.join(tdir, "loc_c000.js"), "w").write("export function loc_c000(m){ m.call(0xd000); }\n")
        open(os.path.join(tdir, "loc_e000.js"), "w").write(
            "export function loc_e000(m){}\nexport function loc_d000(m){}\n")
        subprocess.run(["git", "-C", tmp, "add", "-A"], check=True, capture_output=True)
        _case("e2e: secondary export in a multi-routine file covers the target", lambda: cmd_check(None), 0, failures)
    finally:
        REPO, WAIVERS = saved
        shutil.rmtree(tmp, ignore_errors=True)

    if failures:
        for f in failures:
            print(f"  {f}", file=sys.stderr)
        print("batch_size_gate selftest: FAIL", file=sys.stderr)
        return 1
    print("batch_size_gate selftest: OK (rule + controls: small-open blocks, big/closed/waiver/inert pass)")
    return 0


try:
    REPO = repo_root()
except GitError:
    REPO = None
WAIVERS = os.path.join(REPO, ".batchsize-waivers") if REPO else None


def main():
    p = argparse.ArgumentParser(description="Batch-size gate — refuse a too-small translation batch")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("id")
    sub.add_parser("check")
    sub.add_parser("install")
    sub.add_parser("selftest")
    pl = sub.add_parser("plan")
    pl.add_argument("--game", required=True)
    w = sub.add_parser("waive")
    w.add_argument("--reason", required=True, help="why this small ADD is legitimate")
    args = p.parse_args()
    if REPO is None:
        sys.stderr.write("COMMIT BLOCKED — batch_size_gate: not inside a git work tree (failing closed).\n")
        return 1
    try:
        return {"id": cmd_id, "check": cmd_check, "plan": cmd_plan, "waive": cmd_waive,
                "install": cmd_install, "selftest": cmd_selftest}[args.cmd](args)
    except GitError as e:
        sys.stderr.write(f"COMMIT BLOCKED — batch_size_gate git error (failing closed): {e}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
