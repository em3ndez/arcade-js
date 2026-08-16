#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Names-consistency gate - names.js is the single source of truth for whether a work-RAM
cell is named; no prose may contradict it. Two rules, both under `check`:

  (A) PROSE-vs-registry: no staged clause may call a names.js-NAMED work-RAM cell hex/unnamed.
      Binds to the INDEX, runs per staged game; checks mechanisms.md (all lines) and idiomatic
      routine files (comment lines only). Block- then clause-scoped: a run of relevant lines is
      joined (so a claim wrapped across a line-break is caught), split into clauses, and a named
      address is flagged only if its clause does NOT also spell that address's registry name (so
      an honest raw/different-role use ("BOARD_MODE (0x8057), reused raw") passes). The work-RAM
      window is DERIVED per game (manifest board -> boards/<board>/memory.js WORK_RAM_BASE/SIZE),
      never hardcoded: a hardcoded 0x8000-0x87FF once matched nothing for DK (0x6000-0x6BFF) and
      the gate passed while inspecting nothing.

  (B) IDIOMATIC loc_ CELL rule (reviewer-rules.md R31): loc_<addr> is the translated layer's
      identifier and is NEVER a valid idiomatic CELL const name, so every top-level
      `export const loc_<hex> = 0x<hex>;` in a game's names.js is a violation. Scans the WORKING
      TREE across ALL games (not just staged); routine modules and ROUTINES-map entries are out
      of scope. Existing debt is grandfathered by an enumerated allowlist in tools/names-debt.txt
      - each non-blank, non-`#` line exactly `<game> 0x<addr>`, a shrinking set; fail-closed if
      that file is missing or malformed.

Fail-closed on any git error. VACUOUS when no games/ file is staged; trailing comments escape
is_comment() so are never scanned. Subcommands: check (the hook), selftest (fixtures for rule B).
"""
import glob
import os
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
    """Staged (ref=':0') or committed (ref='HEAD') content, or '' if absent. Use ':0' not ':' - a bare ':' would make a broken '::path'."""
    r = subprocess.run(["git", "show", f"{ref}:{path}"], capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else ""


HEX_CLAIM = re.compile(
    r"no names\.?js name|not in names\.?js|stays? hex|kept? hex|keep (?:it|them) hex|stays? local|unnamed",
    re.I,
)
ADDR = re.compile(r"0x[0-9a-f]{4}", re.I)
# re.I on EXPORT is load-bearing: without it an uppercase-hex cell decl (`= 0x601A`) is missed,
# read as UNNAMED, and every false "0x601a stays hex" about it then passes. ADDR always had re.I.
EXPORT = re.compile(r"^export const ([A-Z_0-9]+) = (0x[0-9a-f]{4});", re.M | re.I)

# Rule (B): a top-level idiomatic CELL const `loc_<hex>`. Anchored (re.M) so only decls match - not
# a comment mention or a ROUTINES-map key - and NOT address-windowed (loc_ is invalid at any addr).
EXPORT_LOC = re.compile(r"^export const (loc_[0-9a-f]+)\s*=\s*(0x[0-9a-f]+)\s*;", re.M | re.I)

BOARD = re.compile(r"^\s*board:\s*[\"']([A-Za-z0-9_]+)[\"']", re.M)
RAM_BASE = re.compile(r"^export const WORK_RAM_BASE = (0x[0-9a-f]+);", re.M | re.I)
RAM_SIZE = re.compile(r"^export const WORK_RAM_SIZE = (0x[0-9a-f]+);", re.M | re.I)


def workram_window(game):
    """(lo, hi) inclusive work-RAM bounds for `game`, from its board's memory.js; None if unreadable (caller SKIPS, never guesses)."""
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
    """Violations: a hex-claim clause that calls a names.js-NAMED address hex/unnamed WITHOUT also
    spelling that address's registry name in the same clause (an honest name-acknowledged raw use passes)."""
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


NAMING_DEBT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "names-debt.txt")


def load_naming_debt(path=NAMING_DEBT_FILE):
    """{(game, addr_int)} grandfathered loc_ cell consts from tools/names-debt.txt. Each non-blank,
    non-`#` line must be exactly `<game> 0x<addr>`; a missing or malformed file raises GitError (fail-closed)."""
    try:
        text = open(path, encoding="utf-8").read()
    except OSError as e:
        raise GitError(f"cannot read naming-debt allowlist {path}: {e}")
    debt = set()
    for i, raw in enumerate(text.splitlines(), 1):
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        parts = line.split()
        if len(parts) != 2 or not re.fullmatch(r"0x[0-9a-f]+", parts[1], re.I):
            raise GitError(f"malformed naming-debt line {i} in {path}: {raw!r}")
        debt.add((parts[0], int(parts[1], 16)))
    return debt


def loc_cell_violations_in_text(game, text, allowlist):
    """[(identifier, addr_int, lineno)] for each top-level `export const loc_<hex> = 0x<hex>;` whose (game, addr) is not grandfathered."""
    hits = []
    for m in EXPORT_LOC.finditer(text):
        addr = int(m.group(2), 16)
        if (game, addr) in allowlist:
            continue
        lineno = text.count("\n", 0, m.start()) + 1
        hits.append((m.group(1), addr, lineno))
    return hits


def loc_cell_check():
    """Rule (B): no un-grandfathered idiomatic loc_ CELL const anywhere in the WORKING TREE (all games, not the index)."""
    root = repo_root()
    debt = load_naming_debt()
    failures = []
    for f in sorted(glob.glob(os.path.join(root, "games", "*", "idiomatic", "names.js"))):
        rel = os.path.relpath(f, root)
        game = rel.split(os.sep)[1]
        try:
            text = open(f, encoding="utf-8").read()
        except OSError as e:
            raise GitError(f"cannot read {rel}: {e}")
        for name, addr, ln in loc_cell_violations_in_text(game, text, debt):
            failures.append(f"    {rel}:{ln}  {name} = 0x{addr:04x}  (game {game})")
    if failures:
        sys.stderr.write(
            "\nCOMMIT BLOCKED — names-consistency gate, idiomatic loc_ cell rule\n"
            "  (docs/runbook.md \"A cell earns its DESCRIPTIVE identifier…\" / reviewer-rules.md R31):\n"
            "  `loc_<addr>` is the TRANSLATED layer's identifier and is never a valid idiomatic CELL const\n"
            "  name. A confidently-read cell owes a DESCRIPTIVE name; an unknown-role cell is keep-hex (a\n"
            "  bare literal, no const). These idiomatic names.js cell consts are named loc_ and are NOT\n"
            "  grandfathered in tools/names-debt.txt:\n\n"
            + "\n".join(failures)
            + "\n\n  Fix: rename each to a DESCRIPTIVE name (value-identical — the address never changes) and\n"
            "  update its importers, or drop the const and keep-hex the literal if the role is unknown.\n"
            "  Do NOT add it to names-debt.txt — that set only SHRINKS. Do NOT --no-verify around this.\n\n"
        )
        return 1
    return 0


def check():
    # Rule (B) first: it scans the whole tree and must NOT sit behind the `if not games` early-return below.
    rc = loc_cell_check()
    games = games_touched()
    if not games:
        return rc
    failures = []
    unwindowed = []
    for game in sorted(games):
        window = workram_window(game)
        if window is None:
            # No guessed fallback range: inspecting the wrong window is what made this gate vacuous for DK.
            unwindowed.append(game)
            continue
        ram = blob(":0", f"games/{game}/idiomatic/names.js") or blob("HEAD", f"games/{game}/idiomatic/names.js")
        named = named_workram(ram, window)
        if not named:
            continue
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
    return rc  # rule (A) clean; propagate rule (B)'s result


def selftest():
    """Synthetic fixtures for rule (B); loc_cell_violations_in_text is the pure, tree-independent core."""
    G = "selftestgame"
    failures = []

    hits = loc_cell_violations_in_text(G, "export const loc_1234 = 0x1234;\n", set())
    if [(n, a) for n, a, _ in hits] != [("loc_1234", 0x1234)]:
        failures.append(f"un-listed loc_ cell: want [('loc_1234', 0x1234)], got {[(n, a) for n, a, _ in hits]}")

    if loc_cell_violations_in_text(G, "export const loc_1234 = 0x1234;\n", {(G, 0x1234)}):
        failures.append("allowlisted loc_ cell must PASS")

    if not loc_cell_violations_in_text("othergame", "export const loc_1234 = 0x1234;\n", {(G, 0x1234)}):
        failures.append("allowlist must be per-game: loc_1234 in othergame must FAIL when only (selftestgame,0x1234) is listed")

    if loc_cell_violations_in_text(G, "export const HIGH_SCORE = 0x83ef;\n", set()):
        failures.append("descriptive-named cell must PASS")

    routine = (
        'export const ROUTINES = {\n'
        '  0x1234: { name: "loc_1234", cert: "code" },\n'
        '};\n'
        '// loc_5678 masks this against 2\n'
    )
    if loc_cell_violations_in_text(G, routine, set()):
        failures.append("ROUTINES-map entry / comment loc_ mention must PASS (not a cell const)")

    multi = "// header\nexport const HIGH_SCORE = 0x83ef;\nexport const loc_9abc = 0x9abc;\n"
    if loc_cell_violations_in_text(G, multi, set()) != [("loc_9abc", 0x9abc, 3)]:
        failures.append(f"line attribution: want [('loc_9abc', 0x9abc, 3)], got {loc_cell_violations_in_text(G, multi, set())}")

    if not loc_cell_violations_in_text(G, "export const loc_130b = 0x130b;\n", set()):
        failures.append("a loc_ cell at a ROM address must FAIL (rule B is not work-RAM-windowed)")

    try:
        debt = load_naming_debt()
        if not all(isinstance(g, str) and isinstance(a, int) for g, a in debt):
            failures.append("names-debt.txt parsed to a non (str, int) tuple")
    except GitError as e:
        failures.append(f"names-debt.txt failed to parse: {e}")

    if failures:
        sys.stderr.write("names_consistency selftest: FAIL\n")
        for f in failures:
            sys.stderr.write(f"  {f}\n")
        return 1
    sys.stdout.write("names_consistency selftest: PASS (7 rule-(B) cases: teeth, allowlist, per-game, absent, scope, line#, ROM addr, debt-file well-formed)\n")
    return 0


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ("check", "selftest"):
        sys.stderr.write("usage: names_consistency.py {check|selftest}\n")
        return 2
    # selftest is pure-logic (synthetic fixtures + the debt file); no git tree, so it runs before repo_root.
    if sys.argv[1] == "selftest":
        return selftest()
    try:
        repo_root()
    except GitError:
        sys.stderr.write("COMMIT BLOCKED — names-consistency gate: not in a git work tree (failing closed).\n")
        return 1
    try:
        return check()
    except GitError as e:
        sys.stderr.write(f"COMMIT BLOCKED — names-consistency gate git error (failing closed): {e}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
