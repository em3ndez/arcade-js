#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Names-consistency gate — ram.js is the SINGLE source of truth for whether a work-RAM
cell is named; no prose may contradict it.

The boundary (see docs/names-registry.md "One source per fact"): a cell's name, role, and
confidence live in ONE place — games/<game>/idiomatic/ram.js. games/<game>/mechanisms.md
describes MECHANISMS (and tags mechanism *claims*), and routine-file comments describe the
routine — NEITHER re-states a cell's registry status. The specific, drift-prone violation
this gate forbids: prose that calls a ram.js-NAMED work-RAM address "unnamed / no ram.js
name / not in ram.js / stays hex / kept hex / stays local". Such a claim must be TRUE — the
address it is about must genuinely be ABSENT from ram.js.

Why a gate: 2026-07-31, after 31 cells were promoted into ram.js, dozens of routine comments
still read "0x8083 … has no ram.js name yet / stays hex" — a stale second copy of a fact
ram.js already owns. THREE separate sync bugs this session traced to the same duplicated-fact
root (a mechanisms.md tag contradicting ram.js, a stale "backups stay hex" note, the comment
drift). Memory and docs can't enforce single-source; a fail-closed hook can.

Precision (block- then clause-scoped, name-acknowledged carve-out). Comment/prose wraps constantly,
so a per-LINE scan misses a claim split across a wrap ("... 0x8055 is\n the count (unnamed)"). The
gate first JOINS each run of consecutive relevant lines — a comment block, or a blank-line-delimited
paragraph — into one string, then splits THAT into clauses on ';' or a sentence end ('. '); 'ram.js'
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

Subcommands:  check   exit 0 iff no staged clause contradicts ram.js (the hook calls this)
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
    r"no ram\.?js name|not in ram\.?js|stays? hex|kept? hex|keep (?:it|them) hex|stays? local|unnamed",
    re.I,
)
ADDR = re.compile(r"0x8[0-9a-f]{3}", re.I)
EXPORT = re.compile(r"^export const ([A-Z_0-9]+) = (0x8[0-9a-f]{3});", re.M)


def named_workram(ram_text):
    """{addr_int: NAME} for every ram.js const in the work-RAM window 0x8000-0x87ff."""
    out = {}
    for name, addr in EXPORT.findall(ram_text):
        a = int(addr, 16)
        if 0x8000 <= a <= 0x87FF:
            out[a] = name
    return out


def is_comment(line):
    s = line.lstrip()
    return s.startswith("*") or s.startswith("//") or s.startswith("/*")


def _mentions(name, text):
    return re.search(rf"(?<![A-Za-z0-9_]){re.escape(name)}(?![A-Za-z0-9_])", text) is not None


COMMENT_MARK = re.compile(r"^\s*(?:/\*+|\*/|\*|//)\s?")


def scan(text, named, comments_only):
    """Violations: a hex-claim clause that calls a ram.js-NAMED address hex/unnamed WITHOUT
    spelling that address's registry name in the same clause.

    Acknowledging the name is allowed ("BOARD_MODE (0x8057) is used raw here, kept hex") — the
    address is honestly labelled. What is forbidden is the bare "0x8057 stays hex", which reads
    as "0x8057 is unnamed" and contradicts ram.js.

    BLOCK-scoped, then clause-scoped. Comment/prose wraps constantly ("... 0x8055 is\n the count
    (unnamed)"), so a per-LINE scan misses a claim split across a wrap. So we first join each run
    of consecutive relevant lines (a comment block, or a blank-line-delimited paragraph) into one
    string — stripping comment markers — then split it into clauses on ';' or a sentence end ('. ';
    'ram.js' survives, no space after its dot). A named address is flagged only if its clause does
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
    for game in sorted(games):
        ram = blob(":0", f"games/{game}/idiomatic/ram.js") or blob("HEAD", f"games/{game}/idiomatic/ram.js")
        named = named_workram(ram)
        if not named:
            continue
        # mechanisms.md (all lines) + every idiomatic routine file (comment lines), from the index.
        targets = [(f"games/{game}/mechanisms.md", False)]
        listing = git(["ls-files", "--", f"games/{game}/idiomatic/"]).splitlines()
        for p in listing:
            if p.endswith(".js") and not p.endswith("/ram.js"):
                targets.append((p, True))
        for path, comments_only in targets:
            text = blob(":0", path) or blob("HEAD", path)
            if not text:
                continue
            for ln, addrs, clause in scan(text, named, comments_only):
                names = ", ".join(f"{named[a]} (0x{a:04x})" for a in addrs)
                failures.append(f"    {path}:{ln}  calls {names} hex/unnamed — but ram.js names it.\n        “{clause}”")
    if failures:
        sys.stderr.write(
            "\nCOMMIT BLOCKED — names-consistency gate (tools/names_consistency.py):\n"
            "  ram.js is the single source of truth for whether a cell is named; prose must not\n"
            "  contradict it. These clauses call a ram.js-NAMED address unnamed/hex:\n\n"
            + "\n".join(failures)
            + "\n\n  Fix the prose to name the cell (or, if it is really unnamed, name it in ram.js).\n"
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
