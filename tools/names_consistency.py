#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Names-consistency gate — names.js is the SINGLE source of truth for whether a work-RAM
cell is named; no prose may contradict it.

The boundary (see docs/names-registry.md "One source per fact"): a cell's name, role, and
confidence live in ONE place — games/<game>/idiomatic/names.js. games/<game>/mechanisms.md
describes MECHANISMS (and tags mechanism *claims*), and routine-file comments describe the
routine — NEITHER re-states a cell's registry status. The specific, drift-prone violation
this gate forbids: prose that calls a names.js-NAMED work-RAM address "unnamed / no names.js
name / not in names.js / stays hex / kept hex / stays local". Such a claim must be TRUE — the
address it is about must genuinely be ABSENT from names.js.

Why a gate: 2026-07-31, after 31 cells were promoted into names.js, dozens of routine comments
still read "0x8083 … has no names.js name yet / stays hex" — a stale second copy of a fact
names.js already owns. THREE separate sync bugs this session traced to the same duplicated-fact
root (a mechanisms.md tag contradicting names.js, a stale "backups stay hex" note, the comment
drift). Memory and docs can't enforce single-source; a fail-closed hook can.

Precision (block- then clause-scoped, name-acknowledged carve-out). Comment/prose wraps constantly,
so a per-LINE scan misses a claim split across a wrap ("... 0x8055 is\n the count (unnamed)"). The
gate first JOINS each run of consecutive relevant lines — a comment block, or a blank-line-delimited
paragraph — into one string, then splits THAT into clauses on ';' or a sentence end ('. '); 'names.js'
survives the split (no space after its dot). Within a hex-claim clause, a NAMED address is a violation
only if that clause does NOT also spell the address's registry name. Three consequences: (1) a claim
wrapped across a line-break is caught; (2) a hex-claim about a genuinely-unnamed cell riding beside a
named sibling ("the facing 0x8092 has no name and stays hex; the position byte is ENEMY_WORK_Y
(0x8086)") passes — the clause split isolates it; (3) honestly acknowledging a deliberate raw /
different-role use passes ("0x8057 is BOARD_MODE, reused raw here"), while the bare false "0x8057 stays
hex" does not.

Scope. Runs per game touched by the commit; reads the STAGED (index) content so it binds to
exactly what will be committed. Checks the game's mechanisms.md (all lines) and its idiomatic
routine files (comment lines only). Fail-closed: any git error blocks the commit.

WORK-RAM WINDOW: DERIVED PER GAME, NOT HARDCODED. The gate only cares about WORK-RAM cells, so it
needs each game's work-RAM range. That range has exactly one source of truth already — the board's
address map, `boards/<board>/memory.js`, which exports WORK_RAM_BASE and WORK_RAM_SIZE — and the
game's manifest names its board. So the window is read from there (games/<game>/manifest.js
`board:` -> boards/<board>/memory.js), and there is no second copy to drift.

Why this is called out: the window was hardcoded `0x8000-0x87FF` with an address regex of
`0x8[0-9a-f]{3}`, which is THE PIT's work RAM. Donkey Kong's is 0x6000-0x6BFF, so for DK this gate
matched no addresses at all and had been exiting 0 on every DK commit while inspecting nothing — a
gate that cannot fail is not a gate. Adding a second magic range would have left the same trap for
game #3, so the range is derived instead.

Subcommands:  check   exit 0 iff no staged clause contradicts names.js (the hook calls this)

KNOWN LIMITATIONS — a green from this gate means less than it looks like. Recorded here
because "names gate clean" has been over-reported off this tool before:

  * VACUOUS WHEN NO games/ FILE IS STAGED. games_touched() reads the staged name list; a
    commit touching only tools/ or docs/ makes it empty and check() returns 0 having
    inspected NOTHING. Running it against an unstaged working tree is likewise vacuous.
    Green here is evidence only when a games/<game>/ file is in the index.
  * TRAILING COMMENTS ESCAPE ENTIRELY. is_comment() matches only lines whose FIRST
    non-space characters are '//', '*' or '/*', so `const v = m.read8(0x601a); // 0x601a
    stays hex` is never scanned, while the identical sentence as a leading comment is
    caught. Verified 2026-08-02.
  * ADDR matches the first four hex digits of a LONGER literal, so a 5+ digit constant can
    present as an in-window address.

The first is a property of binding to the index and is intended; the last two are real
holes, left for a change that can carry its own negative test rather than riding along here.
"""
import re
import subprocess
import sys


class GitError(RuntimeError):
    """A git invocation failed — callers turn this into a BLOCK (fail closed)."""


def git(args):
    r = subprocess.run(["git", *args], capture_output=True, text=True)
    if r.returncode != 0:
        raise GitError(r.stderr.strip() or f"git {' '.join(args)} failed")
    return r.stdout


def repo_root():
    r = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True)
    if r.returncode != 0 or not r.stdout.strip():
        raise GitError(r.stderr.strip() or "not inside a git work tree")
    return r.stdout.strip()


def blob(ref, path):
    """Staged (ref=':0' — stage 0 of the index) or committed (ref='HEAD') content, or '' if absent.
    Note ':0' not ':' — the f-string below would turn a bare ':' into a broken '::path'."""
    r = subprocess.run(["git", "show", f"{ref}:{path}"], capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else ""


HEX_CLAIM = re.compile(
    r"no names\.?js name|not in names\.?js|stays? hex|kept? hex|keep (?:it|them) hex|stays? local|unnamed",
    re.I,
)
ADDR = re.compile(r"0x[0-9a-f]{4}", re.I)
# re.I is LOAD-BEARING, not tidiness: without it a cell declared with an uppercase hex
# digit (`export const FRAME = 0x601A;`) does not match, so the gate treats it as UNNAMED
# and every false "0x601a stays hex" about it passes. Measured 2026-08-02: 33 of Donkey
# Kong's 168 registry cells (20%) were invisible this way, including FRAME. ADDR below
# always had re.I, so the two regexes disagreed about what an address looks like — the
# gate read a SMALLER registry than the one it was checking prose against.
#
# 168, not the 184 `export const NAME = 0x…;` lines in names.js: 16 of those are FIELD OFFSETS
# (SPRITE_X = 0x00, OBJ_ACTIVE = 0x00, OBJ_WALK_PTR_HI = 0x1b …), not addresses. They
# fall outside the work-RAM window and neither regex ever matched them. Counting them
# as cells is the offset-namespace confusion this codebase keeps re-committing.
EXPORT = re.compile(r"^export const ([A-Z_0-9]+) = (0x[0-9a-f]{4});", re.M | re.I)

BOARD = re.compile(r"^\s*board:\s*[\"']([A-Za-z0-9_]+)[\"']", re.M)
RAM_BASE = re.compile(r"^export const WORK_RAM_BASE = (0x[0-9a-f]+);", re.M | re.I)
RAM_SIZE = re.compile(r"^export const WORK_RAM_SIZE = (0x[0-9a-f]+);", re.M | re.I)


def workram_window(game):
    """(lo, hi) inclusive work-RAM bounds for `game`, read from its board's address map.

    games/<game>/manifest.js names the board; boards/<board>/memory.js is the single place the
    address map lives (WORK_RAM_BASE / WORK_RAM_SIZE, which AddressSpace itself decodes with).
    Returns None when either file cannot be read or does not declare the pair — the caller then
    SKIPS that game rather than silently inspecting the wrong range, and says so.
    """
    manifest = blob(":0", f"games/{game}/manifest.js") or blob("HEAD", f"games/{game}/manifest.js")
    m = BOARD.search(manifest or "")
    if not m:
        return None
    mem = blob(":0", f"boards/{m.group(1)}/memory.js") or blob("HEAD", f"boards/{m.group(1)}/memory.js")
    base, size = RAM_BASE.search(mem or ""), RAM_SIZE.search(mem or "")
    if not (base and size):
        return None
    lo = int(base.group(1), 16)
    return (lo, lo + int(size.group(1), 16) - 1)


def named_workram(ram_text, window):
    """{addr_int: NAME} for every names.js const inside this game's work-RAM window."""
    lo, hi = window
    out = {}
    for name, addr in EXPORT.findall(ram_text):
        a = int(addr, 16)
        if lo <= a <= hi:
            out[a] = name
    return out


def is_comment(line):
    s = line.lstrip()
    return s.startswith("*") or s.startswith("//") or s.startswith("/*")


def _mentions(name, text):
    return re.search(rf"(?<![A-Za-z0-9_]){re.escape(name)}(?![A-Za-z0-9_])", text) is not None


COMMENT_MARK = re.compile(r"^\s*(?:/\*+|\*/|\*|//)\s?")


def scan(text, named, comments_only):
    """Violations: a hex-claim clause that calls a names.js-NAMED address hex/unnamed WITHOUT
    spelling that address's registry name in the same clause.

    Acknowledging the name is allowed ("BOARD_MODE (0x8057) is used raw here, kept hex") — the
    address is honestly labelled. What is forbidden is the bare "0x8057 stays hex", which reads
    as "0x8057 is unnamed" and contradicts names.js.

    BLOCK-scoped, then clause-scoped. Comment/prose wraps constantly ("... 0x8055 is\n the count
    (unnamed)"), so a per-LINE scan misses a claim split across a wrap. So we first join each run
    of consecutive relevant lines (a comment block, or a blank-line-delimited paragraph) into one
    string — stripping comment markers — then split it into clauses on ';' or a sentence end ('. ';
    'names.js' survives, no space after its dot). A named address is flagged only if its clause does
    NOT also spell its registry name — so a hex-claim about a genuinely-unnamed sibling, or an
    honest name-acknowledged raw use, both pass."""
    hits = []
    lines = text.splitlines()
    n = len(lines)
    i = 0
    while i < n:
        relevant = is_comment(lines[i]) if comments_only else bool(lines[i].strip())
        if not relevant:
            i += 1
            continue
        block_start = i  # 0-based index of the block's first line
        parts = []
        while i < n and (is_comment(lines[i]) if comments_only else bool(lines[i].strip())):
            parts.append(COMMENT_MARK.sub("", lines[i]) if comments_only else lines[i])
            i += 1
        block = " ".join(parts)
        if not HEX_CLAIM.search(block):
            continue
        for clause in re.split(r";|\.\s", block):
            if not HEX_CLAIM.search(clause):
                continue
            bad = [int(a, 16) for a in ADDR.findall(clause)
                   if int(a, 16) in named and not _mentions(named[int(a, 16)], clause)]
            if bad:
                # point at the block line that actually holds the first flagged address
                tok = "0x%04x" % bad[0]
                srcline = next((j + 1 for j in range(block_start, i) if tok in lines[j].lower()), block_start + 1)
                hits.append((srcline, bad, clause.strip()))
    return hits


def games_touched():
    out = git(["diff", "--cached", "--name-only"])
    gs = set()
    for p in out.splitlines():
        m = re.match(r"^games/([^/]+)/", p)
        if m:
            gs.add(m.group(1))
    return gs


def check():
    games = games_touched()
    if not games:
        return 0
    failures = []
    unwindowed = []
    for game in sorted(games):
        window = workram_window(game)
        if window is None:
            # Do NOT fall back to a guessed range: inspecting the wrong window is what made this
            # gate vacuous for DK. Report it instead so the omission is visible.
            unwindowed.append(game)
            continue
        ram = blob(":0", f"games/{game}/idiomatic/names.js") or blob("HEAD", f"games/{game}/idiomatic/names.js")
        named = named_workram(ram, window)
        if not named:
            continue
        # mechanisms.md (all lines) + every idiomatic routine file (comment lines), from the index.
        targets = [(f"games/{game}/mechanisms.md", False)]
        listing = git(["ls-files", "--", f"games/{game}/idiomatic/"]).splitlines()
        for p in listing:
            if p.endswith(".js") and not p.endswith("/names.js"):
                targets.append((p, True))
        for path, comments_only in targets:
            text = blob(":0", path) or blob("HEAD", path)
            if not text:
                continue
            for ln, addrs, clause in scan(text, named, comments_only):
                names = ", ".join(f"{named[a]} (0x{a:04x})" for a in addrs)
                failures.append(f"    {path}:{ln}  calls {names} hex/unnamed — but names.js names it.\n        “{clause}”")
    if unwindowed:
        sys.stderr.write(
            "COMMIT BLOCKED — names-consistency gate: could not derive the work-RAM window for "
            + ", ".join(unwindowed)
            + ".\n  Expected games/<game>/manifest.js to declare `board: \"<name>\"` and\n"
            "  boards/<name>/memory.js to export WORK_RAM_BASE and WORK_RAM_SIZE.\n"
            "  Failing closed rather than inspecting a guessed address range.\n"
        )
        return 1
    if failures:
        sys.stderr.write(
            "\nCOMMIT BLOCKED — names-consistency gate (tools/names_consistency.py):\n"
            "  names.js is the single source of truth for whether a cell is named; prose must not\n"
            "  contradict it. These clauses call a names.js-NAMED address unnamed/hex:\n\n"
            + "\n".join(failures)
            + "\n\n  Fix the prose to name the cell (or, if it is really unnamed, name it in names.js).\n"
            "  Do NOT --no-verify around this.\n\n"
        )
        return 1
    return 0


def main():
    try:
        repo_root()
    except GitError:
        sys.stderr.write("COMMIT BLOCKED — names-consistency gate: not in a git work tree (failing closed).\n")
        return 1
    if len(sys.argv) < 2 or sys.argv[1] != "check":
        sys.stderr.write("usage: names_consistency.py check\n")
        return 2
    try:
        return check()
    except GitError as e:
        sys.stderr.write(f"COMMIT BLOCKED — names-consistency gate git error (failing closed): {e}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
