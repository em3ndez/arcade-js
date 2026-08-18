#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Idiomatic gate — the idiomatic layer must be truly idiomatic, with no old CPU/memory cruft.

Runbook goal (§5 definition of done): a finished idiomatic module names its data and control flow,
never the machine. Six kinds of cruft are counted, all of which must reach 0 for a game to be
IDIOMATIC (a hard done requirement):
  - REGISTERS: `regs.a` / ALU helpers, minus two exempt bridges — a param-default (`fn(m, x=m.regs.a)`)
    and a write riding a return (`return (m.regs.a=v)`).
  - m.call(...) — dissolve to a direct JS call (or `yield*`). m.push16/* — Z80 stack trampolines.
  - raw 0xHHHH — a bare address; use a named import from names.js.
  - mem.read8/write8/read16/write16(...) — the low-level API; idiomatic is the indexed view `mem8[addr]`.
  - a redundant width-mask on a mem assignment (`mem8[x]=..&0xff` / `mem16[x]=..&0xffff`): the write already
    truncates, so it's noise. Counted with it: a non-canonical `const foo=m.mem8` alias that would hide one.
The last five are counted in CODE ONLY (comments stripped) and have NO exemptions.

FAIL-CLOSED ratchet: `check` enumerates EVERY games/*/idiomatic/ and holds each to a budget
(tools/idiomatic-budget.txt), implicit 0 for a game not listed — so a NEW game is born idiomatic. It
blocks when a game's STAGED count EXCEEDS its budget (no NEW cruft; the allowlist only shrinks).
Fail-closed on a missing/malformed allowlist. Scope: games/<game>/idiomatic/*.js, minus names.js and
the test/ subdir.

COMPLETENESS: `check` also enforces the game-local `idiomaticComplete: true` flag (manifest) — a game may
declare it only at 0 total cruft. Rationale: docs/comment-gate.md.

Subcommands: worklist (per-module, per-category), check (the ratchet), selftest.
"""
import argparse
import glob
import os
import re
import subprocess
import sys

BUDGET_FILE = "tools/idiomatic-budget.txt"

# --- registers (data registers + ALU-op helpers); both are machine surface ---
REF = re.compile(r"\b(?:m\.)?regs\.([A-Za-z][A-Za-z0-9]*)")
SIG = re.compile(r"\bfunction\s+\w+\s*\(")          # param-defaults on a signature line are exempt
RET = re.compile(r"\breturn\b")
WRITE = re.compile(r"\b(?:m\.)?regs\.[A-Za-z][A-Za-z0-9]*\s*=(?!=)")  # write riding a return is exempt

# --- control/stack/address cruft, counted in comment-stripped CODE, no exemptions ---
CALL = re.compile(r"\bm\.call\(")
PUSH = re.compile(r"\bm\.push\w*\(")
ADDR = re.compile(r"0x[0-9a-fA-F]{4}\b")
MEM = re.compile(r"\bmem\.(?:read|write)(?:8|16)\(")  # low-level machine API; idiomatic form is mem8[addr]
# Redundant width-mask on a mem assignment: mem8[..]=..&0xff (write8 truncates) / mem16[..]=..&0xffff
# (write16 truncates). The mask must be the outermost op on the RHS (right before `;`), width-matched.
MASK8 = re.compile(r"\bmem8\[[^\]]*\]\s*=[^;=]*&\s*0x[fF][fF]\s*;")
MASK16 = re.compile(r"\bmem16\[[^\]]*\]\s*=[^;=]*&\s*0x[fF]{4}\s*;")
# A non-canonical whole-view alias (`const foo = m.mem8;`) would hide `foo[x]=..&0xff` masks; forbid it.
# The `const {mem8,mem16} = m` destructure and byte reads `const v = m.mem8[x]` do not match.
ALIAS = re.compile(r"\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*m\.mem(?:8|16)\s*;")

CATEGORIES = ("registers", "calls", "pushes", "addrs", "mem", "masks")


def strip_comments(text):
    """Drop /* ... */ (incl. /** docstrings) and // line comments so cruft in prose is not counted.
    String/template-literal-unaware (a naive regex): a // or /* occurring INSIDE a string strips the
    code after it on that line — a narrow false-negative the ratchet tolerates, since idiomatic cruft
    is not authored behind an in-string comment marker."""
    text = re.sub(r"/\*[\s\S]*?\*/", "", text)
    text = re.sub(r"//[^\n]*", "", text)
    return text


def register_hits(text):
    """Register names, minus a param-default (signature line) and a `regs.X =` write after the first
    `return` on a line (the exempt outgoing bridge `return (m.regs.a = v)`)."""
    hits = []
    for line in text.splitlines():
        if SIG.search(line):
            continue
        m = RET.search(line)
        if m:
            line = line[:m.end()] + WRITE.sub("", line[m.end():])
        hits.extend(REF.findall(line))
    return hits


def counts(text):
    """Per-category cruft counts for one module's source text."""
    code = strip_comments(text)
    return {
        "registers": len(register_hits(text)),
        "calls": len(CALL.findall(code)),
        "pushes": len(PUSH.findall(code)),
        "addrs": len(ADDR.findall(code)),
        "mem": len(MEM.findall(code)),
        "masks": (len(MASK8.findall(code)) + len(MASK16.findall(code))
                  + sum(1 for n in ALIAS.findall(code) if n not in ("mem8", "mem16"))),
    }


def total(c):
    return sum(c[k] for k in CATEGORIES)


class GitError(RuntimeError):
    """A git invocation failed — callers turn this into a BLOCK (fail closed)."""


def git(args):
    r = subprocess.run(["git", *args], capture_output=True, text=True)
    if r.returncode != 0:
        raise GitError(r.stderr.strip() or f"git {' '.join(args)} failed")
    return r.stdout


def _modules_in_index(game):
    """Staged (index) idiomatic module paths for a game, minus names.js and the test/ subdir."""
    idir = f"games/{game}/idiomatic"
    out = []
    for path in git(["ls-files", f"{idir}/*.js"]).splitlines():
        if not path or os.path.basename(path) == "names.js":
            continue
        if os.path.dirname(path) != idir:  # git pathspec '*' spans '/'; keep only top-level modules
            continue
        out.append(path)
    return out


def count_in_index(game):
    """Total cruft in the STAGED content, matching the other gates. Returns (total, per_category)."""
    agg = {k: 0 for k in CATEGORIES}
    for path in _modules_in_index(game):
        try:
            blob = git(["show", f":{path}"])
        except GitError:
            continue
        for k, v in counts(blob).items():
            agg[k] += v
    return total(agg), agg


def read_budgets():
    """Parse tools/idiomatic-budget.txt -> {game: max_allowed}. Fail closed if missing/malformed."""
    if not os.path.exists(BUDGET_FILE):
        raise GitError(f"missing allowlist {BUDGET_FILE}")
    budgets = {}
    for raw in open(BUDGET_FILE, encoding="utf-8"):
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        parts = line.split()
        if len(parts) != 2 or not parts[1].isdigit():
            raise GitError(f"malformed allowlist line: {raw.rstrip()}")
        budgets[parts[0]] = int(parts[1])
    return budgets


def all_games():
    return sorted(
        os.path.basename(os.path.dirname(d))
        for d in glob.glob("games/*/idiomatic")
    )


# --- reachability closure: a reachable routine still served by the translated oracle is cruft too ---
# reachable (translated `_registry.generated.js`, graph-closed) - overridden (idiomatic ROUTINES) -
# boundary = the still-frozen routines, counted alongside CPU cruft so the total can't reach 0 while
# anything reachable is oracle-served. Only ENROLLED games are counted; legacy opts in when worked.
CLOSURE_GAMES = {"frogger"}
BOUNDARY_FILE = "tools/idiomatic-boundaries.txt"
REG_ENTRY = re.compile(r"^\s*\[\s*0x([0-9a-fA-F]+)\s*,")     # _registry.generated.js address->fn rows
ROUTINE_KEY = re.compile(r"^\s*0x([0-9a-fA-F]+)\s*:\s*\{")   # names.js ROUTINES map keys

# The game-local CLEANUP flag (manifest); enforced below so it can't be set at nonzero cruft. Line-anchored
# so a commented-out flag does not match. docs/comment-gate.md.
COMPLETE_RE = re.compile(r"(?m)^\s*idiomaticComplete\s*:\s*true\b")


def declares_complete(game):
    try:
        return bool(COMPLETE_RE.search(git(["show", f":games/{game}/manifest.js"])))
    except GitError:
        return False


def is_completeness_violation(declares, tot):
    """A game may not declare idiomaticComplete while any cruft (tot, incl. unlifted) remains."""
    return declares and tot != 0


def _read(path, from_index):
    """Read a tracked file's STAGED (index) content to match the ratchet, or the working tree."""
    if from_index:
        return git(["show", f":{path}"])
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def _registry_addrs(game, from_index):
    text = _read(f"games/{game}/translated/_registry.generated.js", from_index)
    return {int(m.group(1), 16) for m in map(REG_ENTRY.match, text.splitlines()) if m}


def _override_addrs(game, from_index):
    text = _read(f"games/{game}/idiomatic/names.js", from_index)
    out, in_routines = set(), False
    for line in text.splitlines():
        if "export const ROUTINES" in line:
            in_routines = True
        if in_routines:
            m = ROUTINE_KEY.match(line)
            if m:
                out.add(int(m.group(1), 16))
    return out


def boundary_dispositions(game):
    """`{addr: disposition}` from tools/idiomatic-boundaries.txt for one game (dead / boundary + reason).
    Every entry is a REVIEWED decision that a reachable routine legitimately stays translated (a genuine
    oracle boundary) or is dead (callers dissolved). Fail closed on a malformed line."""
    out = {}
    if not os.path.exists(BOUNDARY_FILE):
        return out
    for raw in open(BOUNDARY_FILE, encoding="utf-8"):
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        parts = line.split()
        if len(parts) < 3 or not parts[1].startswith("0x") or parts[2] not in ("dead", "boundary"):
            raise GitError(f"malformed boundary line: {raw.rstrip()}")
        if parts[0] == game:
            out[int(parts[1], 16)] = parts[2]
    return out


def unlifted_addrs(game, from_index):
    """Reachable routines with no idiomatic override and no boundary disposition — the frozen worklist."""
    if game not in CLOSURE_GAMES:
        return []
    return sorted(_registry_addrs(game, from_index)
                  - _override_addrs(game, from_index)
                  - set(boundary_dispositions(game)))


def check():
    """Ratchet: no game's staged idiomatic layer may exceed its budget. Returns process exit code."""
    try:
        budgets = read_budgets()
    except GitError as e:
        print(f"idiomatic_gate: BLOCK — {e}")
        return 1
    worst = 0
    rows = []
    lied = []  # games that declare idiomaticComplete while cruft remains
    for game in all_games():
        try:
            tot, per = count_in_index(game)
            unl = len(unlifted_addrs(game, True))
        except GitError as e:
            print(f"idiomatic_gate: BLOCK — {game}: {e}")
            return 1
        tot += unl  # a reachable routine still served by the oracle is cruft (closure-enrolled games)
        budget = budgets.get(game, 0)
        worst = max(worst, tot - budget)
        flag = "OK " if tot <= budget else "OVER"
        tag = "" if game in budgets else " (implicit 0)"
        brk = " ".join(f"{k[:4]}={per[k]}" for k in CATEGORIES)
        if game in CLOSURE_GAMES:
            brk += f" unlifted={unl}"
        complete = declares_complete(game)
        if is_completeness_violation(complete, tot):
            lied.append((game, tot))
        rows.append(f"  [{flag}] {game}: {tot} cruft (budget {budget}{tag})  [{brk}]"
                    + ("  <- IDIOMATIC" if tot == 0 else "")
                    + ("  [idiomaticComplete]" if complete else ""))
    for r in rows:
        print(r)
    if lied:
        for game, tot in lied:
            print(f"\nBLOCK: {game}/manifest.js declares idiomaticComplete: true but its idiomatic layer "
                  f"still holds {tot} cruft (a complete port must be 0). Finish the port or drop the flag.")
        return 1
    if worst > 0:
        print("\nBLOCK: a game's idiomatic layer holds MORE CPU/memory cruft (registers, m.call, "
              "m.push*, raw 0xHHHH) than its budget. The allowlist only shrinks — dissolve the new "
              f"cruft or it does not land. Over budget by {worst}.")
        return 1
    return 0


def worklist(game):
    """Per-module, per-category breakdown from the WORKING TREE (the burndown view)."""
    idir = os.path.join("games", game, "idiomatic")
    rows = []
    for path in sorted(glob.glob(os.path.join(idir, "*.js"))):
        if os.path.basename(path) == "names.js":
            continue
        per = counts(open(path, encoding="utf-8").read())
        if total(per):
            rows.append((total(per), os.path.basename(path), per))
    rows.sort(reverse=True)
    grand = {k: 0 for k in CATEGORIES}
    for tot, name, per in rows:
        for k in CATEGORIES:
            grand[k] += per[k]
        print(f"  {tot:4}  {name:44}  " + " ".join(f"{k[:4]}={per[k]}" for k in CATEGORIES))
    unl = unlifted_addrs(game, False)
    if game in CLOSURE_GAMES:
        disp = boundary_dispositions(game)  # noqa: F841 (kept for a future disposition column)
        print(f"\n  UNLIFTED — {len(unl)} reachable routine(s) still served by the translated oracle:")
        for a in unl:
            print(f"    loc_{a:04x}")
    gtot = total(grand) + len(unl)
    brk = " ".join(f"{k}={grand[k]}" for k in CATEGORIES)
    if game in CLOSURE_GAMES:
        brk += f" unlifted={len(unl)}"
    print(f"\n  {game}: total {gtot}  [{brk}]")
    return 0


def selftest():
    """Positive controls: each category is counted; register exemptions and comment-stripping hold."""
    ok = True

    def want(label, got, exp):
        nonlocal ok
        if got != exp:
            ok = False
            print(f"  FAIL {label}: got {got}, expected {exp}")

    # registers: 2 body refs; a param-default and a return-write are exempt
    reg = "function f(m, x = m.regs.a) {\n  const y = m.regs.b + regs.c;\n  return (m.regs.hl = y);\n}"
    want("registers", counts(reg)["registers"], 2)
    # m.call + m.push* counted; a coroutine yield* is not
    ctl = "function g(m) { m.push16(0x0232); m.call(0x1a55); yield* h(m); }"
    c = counts(ctl)
    want("calls", c["calls"], 1)
    want("pushes", c["pushes"], 1)
    # raw 0xHHHH counted in code; a 2-digit value and a hex in a comment are not
    adr = "const K = 0x8040; // see 0x1234 and 0x2673\nmem8[0xa808] = 0x0f;"
    a = counts(adr)
    want("addrs", a["addrs"], 2)  # 0x8040 + 0xa808; 0x0f is 2-digit; the comment ones stripped
    # closure parsing: a translated-registry row and a ROUTINES key are recognised; a plain const is not
    want("registry-row", bool(REG_ENTRY.match("  [0x0ff1, loc_0ff1],")), True)
    want("routine-key", bool(ROUTINE_KEY.match('  0x0ff1: { name: "renderX" },')), True)
    want("not-a-routine-key", bool(ROUTINE_KEY.match("  const K = 0x8040;")), False)
    # idiomaticComplete flag parsing: only a `: true` declaration counts (false/absent do not)
    want("complete-true", bool(COMPLETE_RE.search("  idiomaticComplete: true,")), True)
    want("complete-false", bool(COMPLETE_RE.search("  idiomaticComplete: false,")), False)
    want("complete-absent", bool(COMPLETE_RE.search('  runtime: "idiomatic",')), False)
    want("complete-commented", bool(COMPLETE_RE.search("  // idiomaticComplete: true")), False)
    want("lie: complete+cruft", is_completeness_violation(True, 5), True)
    want("lie: complete+clean", is_completeness_violation(True, 0), False)
    want("lie: dirty+unflagged", is_completeness_violation(False, 5), False)
    if ok:
        print("idiomatic_gate selftest: OK")
    return 0 if ok else 1


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("check")
    w = sub.add_parser("worklist")
    w.add_argument("game")
    sub.add_parser("selftest")
    args = p.parse_args()
    if args.cmd == "check":
        return check()
    if args.cmd == "worklist":
        return worklist(args.game)
    if args.cmd == "selftest":
        return selftest()
    return 2


if __name__ == "__main__":
    sys.exit(main())
