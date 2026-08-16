#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Register-elimination gate - the idiomatic layer names its data flow, not the CPU.

Runbook goal: "all CPU registers gone from the idiomatic layer (named vars/params/returns),
enforced by a gate." A finished module never touches the raw Z80 register file (`regs.a`,
`m.regs.hl`) nor its flag-carrying ALU helpers (`regs.cp(v)`, `regs.daa()`).

FAIL-CLOSED by default: `check` enumerates EVERY `games/*/idiomatic/` and holds each to an implicit
budget of 0 unless it appears in the allowlist (tools/register-budget.txt) — so a NEW game is refused
from its first module. The allowlist is a shrinking set of grandfathered exceptions only: a game
mid-burndown (budget tightening toward 0) and legacy games (frozen at their count). It blocks when a
game's STAGED count EXCEEDS its budget. Fail-closed on a missing/malformed allowlist. Scope:
`games/<game>/idiomatic/*.js`, minus names.js, the test/ subdir, and the two declared-exempt register
forms — a param-default on a signature (`fn(m, x = m.regs.a)`, incoming) and a register write that
rides a `return` (`return (m.regs.a = v)`, load-bearing outgoing); every other body `regs.` is debt.

Subcommands: worklist (per-module worklist + histogram), check (the ratchet), selftest.
"""
import argparse
import glob
import os
import re
import subprocess
import sys

BUDGET_FILE = "tools/register-budget.txt"

# `regs.<name>`/`m.regs.<name>` - a data register OR an ALU-op helper method; both are machine
# surface. `const { regs, mem8 } = m;` has no dot after regs and is never matched.
REF = re.compile(r"\b(?:m\.)?regs\.([A-Za-z][A-Za-z0-9]*)")

# A named-function signature line. Register refs here are PARAMETER DEFAULTS (`fn(m, x = m.regs.a)`)
# - the runbook's prescribed input-register form AND the load-bearing bridge for register-based
# `m.call` dispatch from the frozen translated layer, which can never pass named args. Exempt.
SIG = re.compile(r"\bfunction\s+\w+\s*\(")
RET = re.compile(r"\breturn\b")
# A register WRITE that rides a `return` (`return (m.regs.a = v)` / `return [m.regs.a=x, m.regs.hl=y]`)
# is the sanctioned load-bearing OUTGOING form; exempt the written register, still count reads.
WRITE = re.compile(r"\b(?:m\.)?regs\.[A-Za-z][A-Za-z0-9]*\s*=(?!=)")


def ref_hits(text):
    """Register names in a body, minus the declared-exempt forms: param-defaults (a signature line)
    and register writes that ride a `return` EXPRESSION (the load-bearing outgoing form). A write that
    merely shares a line with a later `return` (`regs.hl = x; return f(m)`) is still debt."""
    hits = []
    for line in text.splitlines():
        if SIG.search(line):
            continue
        m = RET.search(line)
        if m:  # exempt `regs.X =` writes only in the return expression (after the keyword)
            line = line[:m.end()] + WRITE.sub("", line[m.end():])
        hits.extend(REF.findall(line))
    return hits

# Data registers; everything else `regs.` exposes is an ALU-op helper. Split only for reporting.
DATA_REGS = {
    "a", "f", "b", "c", "d", "e", "h", "l", "i", "r",
    "af", "bc", "de", "hl", "ix", "iy", "sp", "pc",
    "af_", "bc_", "de_", "hl_",
}


def scan(game):
    """Working-tree scan for the burndown view. Returns (per_module, histogram)."""
    idir = os.path.join("games", game, "idiomatic")
    per_module = {}
    histogram = {}
    for path in sorted(glob.glob(os.path.join(idir, "*.js"))):
        if os.path.basename(path) == "names.js":
            continue
        hits = ref_hits(open(path, encoding="utf-8").read())
        if hits:
            per_module[os.path.basename(path)] = hits
            for r in hits:
                histogram[r] = histogram.get(r, 0) + 1
    return per_module, histogram


class GitError(RuntimeError):
    """A git invocation failed - callers turn this into a BLOCK (fail closed)."""


def git(args):
    r = subprocess.run(["git", *args], capture_output=True, text=True)
    if r.returncode != 0:
        raise GitError(r.stderr.strip() or f"git {' '.join(args)} failed")
    return r.stdout


def count_in_index(game):
    """Count register references in the STAGED (index) content, matching the other gates."""
    total = 0
    idir = f"games/{game}/idiomatic"
    listing = git(["ls-files", f"{idir}/*.js"])
    for path in listing.splitlines():
        if not path or os.path.basename(path) == "names.js":
            continue
        # git pathspec '*' spans '/', so drop idiomatic/test/**; the layer is the top-level modules.
        if os.path.dirname(path) != idir:
            continue
        try:
            blob = git(["show", f":{path}"])
        except GitError:
            continue
        total += len(ref_hits(blob))
    return total


def read_budgets():
    """Parse tools/register-budget.txt -> {game: max_allowed}. Fail closed if missing/malformed."""
    path = BUDGET_FILE
    if not os.path.exists(path):
        raise GitError(f"{path} missing - the register ratchet cannot run (fail closed)")
    budgets = {}
    for ln in open(path, encoding="utf-8"):
        ln = ln.split("#", 1)[0].strip()
        if not ln:
            continue
        parts = ln.split()
        if len(parts) != 2 or not parts[1].isdigit():
            raise GitError(f"{path}: malformed line {ln!r}")
        budgets[parts[0]] = int(parts[1])
    return budgets


def total_of(per_module):
    return sum(len(v) for v in per_module.values())


def print_worklist(per_module, histogram):
    total = total_of(per_module)
    print(f"register-elimination: {total} references across {len(per_module)} modules")
    if not total:
        return
    print("\n  register histogram (data | alu-op helper):")
    for r, c in sorted(histogram.items(), key=lambda kv: -kv[1]):
        kind = "data" if r in DATA_REGS else "alu "
        print(f"    {kind} regs.{r:<5} {c}")
    print("\n  per-module worklist (heaviest first):")
    for m, hits in sorted(per_module.items(), key=lambda kv: -len(kv[1])):
        distinct = {}
        for r in hits:
            distinct[r] = distinct.get(r, 0) + 1
        detail = " ".join(f"{r}:{n}" for r, n in sorted(distinct.items(), key=lambda kv: -kv[1]))
        print(f"    {len(hits):3}  {m}   {detail}")


def selftest():
    """Fixtures: the REF pattern matches every register/helper shape and nothing else."""
    should_match = [
        "regs.a = 1;", "  m.regs.hl = x;", "return regs.cp(v);", "regs.daa();",
        "if (regs.fC) {", "x = m.regs.ix + 2;", "regs.dec8('b');",
    ]
    should_not = [
        "const { regs, mem8 } = m;", "// regs are gone here", "registry.add(x);",
        "const regsBudget = 0;", "m.regsdump();",
    ]
    ok = True
    for s in should_match:
        if not REF.search(s):
            print(f"selftest FAIL: expected match: {s!r}", file=sys.stderr); ok = False
    for s in should_not:
        if REF.search(s):
            print(f"selftest FAIL: unexpected match: {s!r}", file=sys.stderr); ok = False
    if "a" not in DATA_REGS or "cp" in DATA_REGS:
        print("selftest FAIL: DATA_REGS membership wrong", file=sys.stderr); ok = False
    # ref_hits exempts param-defaults on a signature line but counts body refs (even multi on a line)
    if ref_hits("export function f(m, x = m.regs.a, y = m.regs.hl) {") != []:
        print("selftest FAIL: signature param-defaults not exempt", file=sys.stderr); ok = False
    if ref_hits("  regs.a = 1;\n  x = m.regs.hl;") != ["a", "hl"]:
        print("selftest FAIL: body refs miscounted", file=sys.stderr); ok = False
    # a register WRITE riding a `return` is the exempt outgoing form; reads on a return still count
    if ref_hits("return (m.regs.a = value);") != []:
        print("selftest FAIL: return-assignment not exempt", file=sys.stderr); ok = False
    if ref_hits("return [ m.regs.a = foo, m.regs.hl = bar ];") != []:
        print("selftest FAIL: multi return-assignment not exempt", file=sys.stderr); ok = False
    if ref_hits("return regs.a;") != ["a"] or ref_hits("if (m.regs.a === b) return x;") != ["a"]:
        print("selftest FAIL: a return-read / comparison must still count", file=sys.stderr); ok = False
    if ref_hits("regs.hl = x; return f(m);") != ["hl"]:  # a write BEFORE a return is still debt
        print("selftest FAIL: pre-return write wrongly exempted", file=sys.stderr); ok = False
    print("selftest OK" if ok else "selftest FAILED")
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser(description="Register-elimination gate for the idiomatic layer.")
    ap.add_argument("cmd", choices=("worklist", "check", "selftest"))
    ap.add_argument("--game", default="frogger")
    args = ap.parse_args()

    if args.cmd == "selftest":
        return selftest()

    if args.cmd == "worklist":
        per_module, histogram = scan(args.game)
        print_worklist(per_module, histogram)
        return 0

    # Enumerate EVERY game with an idiomatic layer; a game absent from the allowlist is held at an
    # implicit budget of 0 (fail-closed), so a new game must be born registers-as-params.
    try:
        budgets = read_budgets()
        worst = 0
        for gd in sorted(glob.glob("games/*/idiomatic")):
            game = os.path.basename(os.path.dirname(gd))
            budget = budgets.get(game, 0)
            count = count_in_index(game)
            worst = max(worst, count - budget)
            flag = "OK " if count <= budget else "OVER"
            tag = "" if game in budgets else " (implicit 0)"
            print(f"  [{flag}] {game}: {count} register refs (budget {budget}{tag})")
    except GitError as e:
        print(f"BLOCK: register gate failed closed: {e}", file=sys.stderr)
        return 1
    if worst > 0:
        print(f"\nBLOCK: a game's idiomatic layer holds CPU-register references above its budget. "
              f"The runbook requires them authored as named params/vars/returns from module one, "
              f"never added; a game absent from {BUDGET_FILE} is held at 0. Convert them, or (only if "
              f"you genuinely reduced a mid-burndown game) tighten its allowlist line.",
              file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
