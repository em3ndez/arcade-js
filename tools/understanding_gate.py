#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Understanding-completeness gate — make the MECHANISMS-with-renames rule MECHANICAL.

The recipe rule (docs/decompiler-pipeline.md, the mechanisms doc): an understanding pass
rewrites the game's mechanisms.md in the SAME landable unit as the renames, and the
map must reference only names that exist in the code. Prose can't enforce that — an
agent (or a lead) under a "correctness gates are green -> commit" reflex ships the
renames and leaves the map stale. Every gate we DO follow has teeth; this gives the
recipe teeth too. The pre-commit hook refuses a commit that breaks it.

Two checks, per game with staged changes, computed on the STAGED (index) content so
they bind to exactly what will be committed:

  A. same-landable-unit — if the commit renames idiomatic routine files OR changes the
     ram.js export set for game G, then games/G/mechanisms.md must ALSO be staged. A
     understanding pass that renames without touching the map is half-done.

  B. no-retired-names — games/G/mechanisms.md must contain NONE of the names this commit
     retired: idiomatic routine files removed, or ram.js exports removed, between HEAD
     and the index. A retired name still in the map is a dangling reference the renames
     left behind (this is what caught the stale CLIMB_GATE / ANIM_RAND).

FAIL CLOSED: any git error blocks the commit rather than being read as "nothing to check".
'git commit --no-verify' bypasses it — that is the exact rule it enforces; do not.
"""
import hashlib  # noqa: F401  (kept for parity with review_gate's toolset; unused today)
import os
import re
import subprocess
import sys


class GitError(RuntimeError):
    """A git invocation failed — callers turn this into a BLOCK (fail closed)."""


def repo_root():
    r = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True)
    if r.returncode != 0 or not r.stdout.strip():
        raise GitError(r.stderr.strip() or "not inside a git work tree")
    return r.stdout.strip()


def git(args, allow_fail=False):
    r = subprocess.run(["git", *args], capture_output=True, text=True, cwd=REPO)
    if r.returncode != 0 and not allow_fail:
        raise GitError(f"`git {' '.join(args)}` failed (exit {r.returncode}): {r.stderr.strip()}")
    return r.stdout


REPO = None
try:
    REPO = repo_root()
except GitError:
    pass


ROUTINE_RE = re.compile(r"^games/([^/]+)/idiomatic/([^/]+)\.js$")
EXPORT_RE = re.compile(r"export\s+const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=")


def is_routine(path):
    """games/<G>/idiomatic/<name>.js — a top-level routine file (not ram.js, not test/)."""
    m = ROUTINE_RE.match(path)
    if not m:
        return None
    name = m.group(2)
    if name == "ram" or "/" in path[len(f"games/{m.group(1)}/idiomatic/"):]:
        return None
    return m.group(1), name  # (game, routine-name)


def staged_name_status():
    """[(status, oldpath, newpath)] for the staged diff, rename-detected."""
    out = git(["diff", "--cached", "-M", "--name-status", "--no-color"])
    rows = []
    for line in out.splitlines():
        parts = line.split("\t")
        if not parts or not parts[0]:
            continue
        status = parts[0]
        if status.startswith("R") and len(parts) == 3:
            rows.append((status, parts[1], parts[2]))
        elif len(parts) >= 2:
            rows.append((status, parts[1], parts[1]))
    return rows


def blob(ref, path):
    """Contents of <path> at a ref ('HEAD', or ':' for the index stage-0); '' if absent.

    Index syntax is a SINGLE leading colon (`git show :path`) — building `f"{ref}:{path}"`
    with ref=':' yields `::path`, an invalid rev that returns empty and makes every HEAD
    name look retired. Handle the index case explicitly.
    """
    spec = f":{path}" if ref == ":" else f"{ref}:{path}"
    return git(["show", spec], allow_fail=True)


def exports_of(text):
    return set(EXPORT_RE.findall(text))


def routine_names(ref, game):
    """Set of routine names present in games/<game>/idiomatic/ at a ref (HEAD or index)."""
    if ref == ":":
        out = git(["ls-files", "--", f"games/{game}/idiomatic/"])
    else:
        out = git(["ls-tree", "-r", "--name-only", ref, "--", f"games/{game}/idiomatic/"])
    names = set()
    for p in out.splitlines():
        r = is_routine(p)
        if r and r[0] == game:
            names.add(r[1])
    return names


def games_touched(rows):
    gs = set()
    for _s, old, new in rows:
        for p in (old, new):
            m = re.match(r"^games/([^/]+)/", p)
            if m:
                gs.add(m.group(1))
    return gs


def check():
    rows = staged_name_status()
    if not rows:
        return 0  # nothing staged with content — not our business (review_gate handles empties)
    staged_paths = {new for _s, _o, new in rows} | {old for _s, old, _n in rows}
    failures = []

    for game in sorted(games_touched(rows)):
        mech = f"games/{game}/mechanisms.md"
        mech_head = blob("HEAD", mech)
        mech_index = blob(":", mech)
        mech_exists = bool(mech_head or mech_index)
        mech_staged = mech in staged_paths

        # --- what did this commit rename/retire for this game? ---
        renamed_routines = any(
            s.startswith("R") and (is_routine(o) or is_routine(n)) and game in (
                (is_routine(o) or ("",))[0], (is_routine(n) or ("",))[0])
            for s, o, n in rows
        )
        head_exports = exports_of(blob("HEAD", f"games/{game}/idiomatic/ram.js"))
        index_exports = exports_of(blob(":", f"games/{game}/idiomatic/ram.js"))
        exports_changed = head_exports != index_exports

        retired_routines = routine_names("HEAD", game) - routine_names(":", game)
        retired_exports = head_exports - index_exports
        retired = retired_routines | retired_exports

        understanding_change = renamed_routines or exports_changed

        # CHECK A — same landable unit
        if understanding_change and mech_exists and not mech_staged:
            failures.append(
                f"[{game}] this commit renames routines / changes ram.js exports but does NOT "
                f"stage {mech}. An understanding pass rewrites the map in the same commit."
            )

        # CHECK B — no retired names left in the (staged) map
        map_text = mech_index if mech_staged else mech_head
        if map_text and retired:
            hits = []
            for name in sorted(retired):
                for i, line in enumerate(map_text.splitlines(), 1):
                    if re.search(rf"(?<![A-Za-z0-9_]){re.escape(name)}(?![A-Za-z0-9_])", line):
                        hits.append(f"    {mech}:{i}  references retired name `{name}`")
                        break
            if hits:
                failures.append(
                    f"[{game}] {mech} still references names this commit retired:\n" + "\n".join(hits)
                )

    if failures:
        sys.stderr.write(
            "\nCOMMIT BLOCKED — understanding-completeness gate (tools/understanding_gate.py):\n"
            "  the renames landed but the game map (mechanisms.md) is out of sync.\n\n"
            + "\n".join("  " + f for f in failures)
            + "\n\n  Rewrite the game's mechanisms.md from the current code, in THIS commit "
            "(do not --no-verify).\n\n"
        )
        return 1
    return 0


def main():
    if REPO is None:
        sys.stderr.write("COMMIT BLOCKED — understanding gate: not inside a git work tree (failing closed).\n")
        return 1
    if len(sys.argv) < 2 or sys.argv[1] != "check":
        sys.stderr.write("usage: understanding_gate.py check\n")
        return 2
    try:
        return check()
    except GitError as e:
        sys.stderr.write(f"COMMIT BLOCKED — understanding gate git error (failing closed): {e}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
