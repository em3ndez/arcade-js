#!/usr/bin/env python3
"""Scan for the exact-shape divergence pin ("inverted gates").

A candidate is a `deepEqual` whose MEASURED side looks like a register-divergence
expression and whose EXPECTED side resolves to a list of Z80 register names. Both
sides are filtered, so this does NOT accept any left-hand side -- an earlier draft
of this docstring said it did, and `DIVERGENCE_LHS` is exactly what loses `0ce8`.

MEASURED, not asserted, against a clean checkout of a805666:
  - keying on the expected side being a literal array finds 10 rows, of which 9
    are in the class of 73. The tenth is 0ce8:399, which DIVERGENCE_LHS hides
    separately -- so "10 of the 73" cannot be right, and said so for two rounds.
  - the dominant form names a const, which is why `register_set` resolves one

★ What this docstring does NOT claim. The plan's account of an earlier scan --
that it required the LHS to be the bare identifier `moved` and so returned 27 --
does not reproduce: that mechanism yields 13 pins, of which ZERO are in the class.
A previous draft repeated it here as fact. Whatever produced 27 was something
else, and this file no longer pretends to know what.

Prints, because a scan's output is a lower bound wearing the costume of a count
(R35):
  1. the pins, classified in-class vs structural-only
  2. an INDEPENDENT symptom count over several phrasings
  3. the reconciliation, which is what says whether the batch is ready
  4. its own untracked-file exposure and its selector contribution

KNOWN BLIND SPOTS, all measured today, none silent-by-design:
  a. `PIN` is DOTALL with a non-greedy left side, so a preceding non-matching
     `deepEqual` can swallow the following pin. LINE NUMBERS ARE THEREFORE
     APPROXIMATE -- 2cbc's pin reports ~17 lines early. Positive control run:
     exactly one swallowed site, and it is the same assertion, so no pin is lost
     TODAY. A future file with two pins under one swallow would lose the second.
  b. FIXED, and it had already bitten. `register_set` used to return a bare None
     for several shapes -- the mechanism that hid the six shadow gates. It hid two
     more the whole time: `deepEqual([...r.moved], [EXCLUDED], ...)` in 0ce8:355
     and 181d:333, an identifier INSIDE the array, so no string literal is found.
     Both are exact pins; both have EXCLUDED = "sp", so the class of 73 is
     unaffected but STRUCTURAL-ONLY IS 34 BY SCAN PLUS THOSE 2. Every failure path
     now reports instead of dropping. It was disclosed as inert while live.
  c. `PIN` requires a message argument after the expected side, so a message-less
     `deepEqual` cannot match. There is exactly ONE in the timeplt gates,
     0f11:334, and it is not a register pin. (An earlier draft said 98 here. That
     figure was transcribed from a review rather than measured, in the disclosure
     block of the instrument this campaign exists to stop trusting.)
"""
import re
import subprocess
import sys
from pathlib import Path
from collections import Counter

# The tree to scan. Takes an argument so a CLEAN CHECKOUT can be measured -- the
# pre-batch figures reproduce only against the commit they were taken at, and with
# this hardcoded to $HOME the plan's own "read a clean checkout" instruction was
# impossible to follow.  usage: scan-inverted-gates.py [repo-root]
ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.home() / "arcade-js"
TESTDIR = ROOT / "games/timeplt/idiomatic/test"

# READ the vocabulary, never hand-author it. A hand-written list omitted the eight
# shadow names and silently dropped every gate whose set mentioned one -- the drop
# is invisible, so the scan reported a smaller class and looked healthy doing it.
Z80 = (ROOT / "core/cpu/z80.js").read_text()
_m = re.search(r"export const REG_FIELDS = \[(.*?)\];", Z80, re.DOTALL)
if not _m:
    sys.exit("REG_FIELDS not found in core/cpu/z80.js -- refusing to guess")
REGS = set(re.findall(r'"([^"]+)"', _m.group(1)))

# The "cannot shrink" exemption covers exactly two registers, and for stated
# reasons: nothing models flags, so `f` can never leave a set; `withOmittedRet`
# always moves `sp`. EVERY OTHER register in REG_FIELDS can be preserved by a
# better rewrite, shadow registers included -- so the class is the complement.
STRUCTURAL = {"f", "sp"}
GENERAL = REGS - STRUCTURAL

# assert.deepEqual( <anything> , <expected> , ... -- the expected side is EITHER a
# literal array OR a bare identifier naming one. Keying on the literal alone found
# 10 rows, 9 in-class: the dominant form is `deepEqual(<measured>, EXCLUDED, ...)`.
PIN = re.compile(
    r"assert\.deepEqual\(\s*(?P<lhs>.*?),\s*(?P<exp>\[[^\[\]]*\]|[A-Za-z_$][A-Za-z0-9_$]*)\s*,",
    re.DOTALL,
)
STRLIT = re.compile(r"""["']([A-Za-z0-9_]+)["']""")
CONSTDEF = r"const\s+{}\s*=\s*(\[[^\[\]]*\])"


def register_set(expr, src):
    """Resolve `expr` to a list of register names, or None if it is not one.

    Returns ("unresolved", ident) when the expected side names a const this
    scan cannot find -- reported rather than dropped, because a case the
    instrument silently discards looks exactly like a case that is not there.
    """
    expr = expr.strip()
    if not expr.startswith("["):
        m = re.search(CONSTDEF.format(re.escape(expr)), src)
        if not m:
            return ("unresolved", expr)
        expr = m.group(1)
    body = expr[1:-1].strip()
    if not body:
        return None  # the subset form: deepEqual(unexpected, []) -- genuinely not a pin
    names = STRLIT.findall(body)
    # ★ EVERY REMAINING WAY OF FAILING IS REPORTED, NOT DROPPED. Returning a bare
    # None here is the exact mechanism that hid the six shadow gates, and it hid
    # two more (`[EXCLUDED]`, an identifier inside the array) while sitting in a
    # comment that listed the drops. A silent drop is indistinguishable from an
    # absent case, so the only safe failure is a loud one.
    if not names:
        return ("unresolved", f"array holds no string literal: [{body}]")
    if len(names) != len([t for t in body.split(",") if t.strip()]):
        return ("unresolved", f"mixed literal and non-literal elements: [{body}]")
    if not all(n in REGS for n in names):
        return ("unresolved", f"element outside REG_FIELDS: [{body}]")
    return names


# A site is a CANDIDATE when its measured (left) side is a register-divergence
# expression. Keying on the expected side alone drags in every
# `deepEqual(x, someVar, "msg")` in the corpus; keying on the left side is what
# the construct actually is -- "the set of registers that differ".
DIVERGENCE_LHS = re.compile(
    r"REG_FIELDS|\bregs\[|\bmoved\b|\bmovedRegisters\b|\.moved\b", re.IGNORECASE
)


# SECOND SELECTOR. It contributes ZERO unique PIN rows -- but it is NOT inert: it
# uniquely supplies three UNRESOLVED rows (15b6:188, 2a57:455, 50ee:445), and
# deleting it loses them from hand judgement. Two of those three are half of the
# four-file SYMPTOM-BUT-NO-PIN residue the plan enumerates.
# ★ This comment said "contributes nothing" through FOUR review rounds, because the
# contribution counter could not see unresolved rows at all -- they `continue`d
# before it. The count read zero while three such rows printed a few lines below.
# The counter now spans both buckets, so the claim is measured rather than assumed;
# `sed`-ing this pattern to something unmatchable and diffing the output is the
# control that catches it.
# It was added believing it recovered `0ce8`, `1253` and `2bef`. It recovers none:
# `0ce8`'s message reads "the set of unmeasurable registers moved", and `1253` and
# `2bef` are lost further down, to the PIN regex and to const resolution.
MESSAGE_SELECTOR = re.compile(r"changed shape|excluded (register )?set", re.IGNORECASE)


def scan_pins():
    rows, unresolved = [], []
    for path in sorted(TESTDIR.glob("*.test.js")):
        src = path.read_text()
        for m in PIN.finditer(src):
            lhs_raw = m.group("lhs")
            tail = src[m.end(): m.end() + 200]
            by_lhs = bool(DIVERGENCE_LHS.search(lhs_raw))
            by_msg = bool(MESSAGE_SELECTOR.search(tail))
            if not (by_lhs or by_msg):
                continue
            got = register_set(m.group("exp"), src)
            if got is None:
                continue
            line = src[: m.start()].count("\n") + 1
            lhs = " ".join(m.group("lhs").split())
            sel = ("lhs" if by_lhs else "") + ("+msg" if by_msg else "")
            if isinstance(got, tuple):
                # ★ UNRESOLVED ROWS CARRY THEIR SELECTOR TOO. They used to `continue`
                # before the contribution counter saw them, so a row supplied ONLY by
                # the message selector was invisible to the very line that reports what
                # that selector contributes -- and the count read zero while three such
                # rows were being printed. A tripwire blind in the region it guards.
                unresolved.append({"file": path.name, "line": line,
                                   "ident": got[1], "sel": sel})
                continue
            rows.append({
                "file": path.name,
                "line": line,
                "set": got,
                "general": sorted(set(got) & GENERAL),
                "lhs": lhs[:90],
                "via": "const" if not m.group("exp").strip().startswith("[") else "literal",
                "sel": sel,
            })
    return rows, unresolved


def symptom_counts():
    """Independent of the scan above: count the FAILURE MESSAGE, several ways.

    Loosest phrasing first. If these disagree with the pin count by more than a
    rounding error, the scan is the thing that is wrong.
    """
    patterns = [
        "changed shape",
        "excluded set changed shape",
        "the excluded set changed shape",
        "excluded register set changed shape",
    ]
    out = {}
    for pat in patterns:
        r = subprocess.run(
            ["grep", "-rl", "-F", pat, str(TESTDIR)],
            capture_output=True, text=True,
        )
        files = [f for f in r.stdout.split("\n") if f]
        out[pat] = set(Path(f).name for f in files)
    return out


def main():
    rows, unresolved = scan_pins()
    gp = [r for r in rows if r["general"]]
    struct = [r for r in rows if not r["general"]]

    print(f"scanning {ROOT}")
    untracked = subprocess.run(
        ["git", "-C", str(ROOT), "ls-files", "--others", "--exclude-standard",
         "games/timeplt/idiomatic/test"],
        capture_output=True, text=True,
    ).stdout.split()
    if untracked:
        print(f"!! {len(untracked)} UNTRACKED gate files are in this scan. The class figure "
              f"below counts them.\n   Measuring mid-authoring folds uncommitted gates into "
              f"'the class'; scan a clean checkout to compare against a landed batch.")
    print()

    # Counted over EVERY printed row, pins and unresolved alike -- see scan_pins.
    pin_sel = Counter(r["sel"] for r in rows)
    unr_sel = Counter(r["sel"] for r in unresolved)
    print(f"selector contribution over PINS      : both={pin_sel.get('lhs+msg', 0)}  "
          f"lhs-only={pin_sel.get('lhs', 0)}  msg-only={pin_sel.get('+msg', 0)}")
    print(f"selector contribution over UNRESOLVED: both={unr_sel.get('lhs+msg', 0)}  "
          f"lhs-only={unr_sel.get('lhs', 0)}  msg-only={unr_sel.get('+msg', 0)}")
    # Derived, never asserted: a static "it is 0 for pins and nonzero for unresolved"
    # would contradict the numbers above it in precisely the case the tripwire exists
    # to catch.
    uniq = pin_sel.get("+msg", 0) + unr_sel.get("+msg", 0)
    if uniq:
        print(f"   the message selector uniquely supplies {uniq} row(s)"
              f" ({pin_sel.get('+msg', 0)} pin, {unr_sel.get('+msg', 0)} unresolved) --"
              f" deleting it loses them from hand judgement")
    else:
        print("   the message selector uniquely supplies nothing in this tree")
    print()

    if unresolved:
        print(f"!! {len(unresolved)} deepEqual sites whose expected side names a const "
              f"this scan could not resolve -- judge each by hand:")
        for u in unresolved:
            print(f"      {u['file']}:{u['line']}  {u['ident']}")
        print()

    print("=" * 78)
    print("PINS FOUND (expected side is a literal array of register names)")
    print("=" * 78)
    print(f"  {len(rows):4d}  total exact pins")
    print(f"  {len(gp):4d}  contain a GENERAL-PURPOSE register  <- THE CLASS")
    print(f"  {len(struct):4d}  structural-only")
    print()
    print("  structural-only breakdown:",
          dict(Counter(",".join(r["set"]) for r in struct)))
    print()
    print("  most common general-purpose shapes:")
    for shape, n in Counter(",".join(r["set"]) for r in gp).most_common(8):
        print(f"      {n:3d}  [{shape}]")
    print()

    print("=" * 78)
    print("THE WORKLIST -- one line per gate still carrying the defect")
    print("=" * 78)
    for r in sorted(gp, key=lambda r: r["file"]):
        print(f"  {r['file']}:{r['line']:<5} [{','.join(r['set'])}]")
        print(f"      lhs: {r['lhs']}")
    print()

    print("=" * 78)
    print("INDEPENDENT SYMPTOM COUNT (files carrying the failure message)")
    print("=" * 78)
    sym = symptom_counts()
    for pat, files in sym.items():
        print(f"  {len(files):4d}  files  \"{pat}\"")
    loosest = sym["changed shape"]
    print()

    print("=" * 78)
    print("RECONCILIATION -- a batch whose two numbers disagree is not ready")
    print("=" * 78)
    pin_files = set(r["file"] for r in gp)
    all_pin_files = set(r["file"] for r in rows)
    print(f"  {len(pin_files):4d}  files with a general-purpose pin")
    print(f"  {len(all_pin_files):4d}  files with ANY exact pin")
    print(f"  {len(loosest):4d}  files with the loosest symptom string")
    only_sym = sorted(loosest - all_pin_files)
    only_pin = sorted(all_pin_files - loosest)
    print()
    print(f"  SYMPTOM BUT NO PIN ({len(only_sym)}) -- already converted, or a shape "
          f"the scan cannot see:")
    for f in only_sym:
        print(f"      {f}")
    print()
    print(f"  PIN BUT NO SYMPTOM ({len(only_pin)}) -- a different failure message:")
    for f in only_pin:
        print(f"      {f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
