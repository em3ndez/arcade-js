#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Find each routine's EXIT addresses, so a unit-equivalence pair can be captured.

The MAME oracle can sample the machine at any instruction (see lua/unit_capture.lua),
but to sample a routine's RESULT you have to know where the routine ends. That is a
static question about the ROM, and this answers it: walk the control flow from an
entry address and collect the `ret` sites.

WHY A STATIC WALK AND NOT THE LISTING HEADERS. Every file in translated/ carries an
assembly listing in its header comment, and the last line is usually the `ret`. Those
headers came from a slicer that is known to have been wrong four ways (truncated
listings, listings that ran past the routine's end into the next one, slices cut short
at branch boundaries). Reading the exit out of the artifact under test would let a bad
slice certify itself. The ROM image is the only thing that cannot be wrong here.

WHAT COUNTS AS AN EXIT. Every `ret`, conditional or not.

A read tap fires during the opcode fetch, BEFORE the flags are consulted, so a tap on
`ret cc` by itself cannot tell "returned" from "fell through". Offering only the
unconditional `ret` (0xC9) was the first cut, and it was much too lossy: five routines
in the 0x48xx-0x49xx block executed 5164 times each during attract and left through a
conditional ret EVERY time, so their unconditional ret never fired and they came out
untested. The fix is not to guess -- the Lua side reads the opcode byte the tap hands
it, decodes the condition, and evaluates it against F at that instant, so a
fall-through is discarded exactly and a taken return is captured exactly.

WALK RULES.
  call/rst      follow the FALL-THROUGH only. The callee returns; its body is not
                part of this routine's extent, and its `ret` is not this routine's exit.
  jp/jr         follow the target. An unconditional jump to another routine is a TAIL
                jump -- whatever that code finally `ret`s to is OUR caller -- so its
                `ret` genuinely is this routine's exit. It does mean the tested unit is
                bigger than the file, which `tail_jump` records.
  jr cc/jp cc/djnz   follow both arms.
  rst 0x30      STOP. On this board RST 0x30 is an inline jump-table dispatch
                (pop hl / rst 0x10 / ex de,hl / jp (hl)), so the bytes that follow are
                a word table, not instructions. Decoding them yields fictional code and
                fictional `ret`s -- exactly the decode-overlap trap that made the static
                tracer untrustworthy on this ROM.
  jp (hl)       STOP, target unknown.
  rst 0x00      STOP, that is the reset vector.

Output is the spec lua/unit_capture.lua reads: "<entry> <exit>[,<exit>...]" -- bare
addresses, since the Lua decodes the ret's condition from the ROM byte itself -- plus a
JSON sidecar carrying the walk facts (extent, tail_jump, unresolved sites) so the
report can say WHY a routine was not testable instead of just omitting it.
"""

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "tools"))
import z80_decode as z  # noqa: E402

ROM_END = 0x5FFF

RST30 = 0xF7  # inline jump-table dispatch: the following bytes are DATA
RST00 = 0xC7  # reset vector


def walk(rom: bytes, entry: int, max_instrs: int = 20000) -> dict:
    """Control-flow walk from `entry`. See the module docstring for the rules."""
    seen: set[int] = set()
    rets: list[int] = []
    cond_rets: list[int] = []
    unresolved: list[dict] = []
    tail_jumps: list[int] = []
    work = [entry]
    n = 0

    while work:
        a = work.pop()
        while True:
            if a in seen:
                break
            if a < 0 or a > ROM_END:
                unresolved.append({"at": a, "why": "flow left ROM"})
                break
            if n >= max_instrs:
                unresolved.append({"at": a, "why": f"walk exceeded {max_instrs} instructions"})
                break
            seen.add(a)
            n += 1

            op = rom[a]
            if op == RST30:
                unresolved.append({"at": a, "why": "rst 0x30 -- inline jump table, rest is data"})
                break
            if op == RST00:
                unresolved.append({"at": a, "why": "rst 0x00 -- reset vector"})
                break

            ins = z.decode(rom, a)
            k = ins.kind

            if k == z.RET:
                rets.append(a)
                break
            if k == z.RET_COND:
                cond_rets.append(a)
                a = ins.end
                continue
            if k == z.JUMP:
                if ins.target is None:
                    unresolved.append({"at": a, "why": "unconditional jump, target unknown"})
                    break
                if not (entry <= ins.target <= entry + 0x400):
                    tail_jumps.append(a)
                a = ins.target
                continue
            if k == z.JUMP_COND:
                if ins.target is None:
                    unresolved.append({"at": a, "why": "conditional jump, target unknown"})
                else:
                    work.append(ins.target)
                a = ins.end
                continue
            if k == z.JUMP_INDIRECT:
                unresolved.append({"at": a, "why": "jp (hl) -- target unknown"})
                break
            if k == z.HALT:
                unresolved.append({"at": a, "why": "halt"})
                break
            # call / call cc / rst / everything else: the callee returns, keep going.
            a = ins.end
            continue

    return {
        "entry": entry,
        "rets": sorted(set(rets)),
        "cond_rets": sorted(set(cond_rets)),
        "unresolved": unresolved,
        "tail_jumps": sorted(set(tail_jumps)),
        "instructions": len(seen),
        "lo": min(seen) if seen else entry,
        "hi": max(seen) if seen else entry,
    }


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--rom", required=True, help="maincpu image (24KB)")
    p.add_argument("--entries", required=True,
                   help="file of entry addresses, one bare hex address per line")
    p.add_argument("--spec", required=True, help="write the unit_capture.lua spec here")
    p.add_argument("--json", required=True, help="write the walk facts here")
    args = p.parse_args()

    rom = open(args.rom, "rb").read()
    if len(rom) != ROM_END + 1:
        p.error(f"expected a {ROM_END + 1}-byte ROM, got {len(rom)}")

    entries = []
    for line in open(args.entries):
        line = line.strip()
        if line and not line.startswith("#"):
            entries.append(int(line, 16))

    facts = {}
    spec_lines = []
    for e in sorted(set(entries)):
        w = walk(rom, e)
        facts[f"{e:04X}"] = w
        exits = sorted(set(w["rets"]) | set(w["cond_rets"]))
        if exits:
            spec_lines.append(f"{e:04X} " + ",".join(f"{r:04X}" for r in exits))

    with open(args.spec, "w") as fh:
        fh.write("\n".join(spec_lines) + "\n")
    with open(args.json, "w") as fh:
        json.dump(facts, fh, indent=1)
        fh.write("\n")

    no_ret = [k for k, v in facts.items() if not (v["rets"] or v["cond_rets"])]
    print(f"[extents] {len(facts)} entries walked, {len(spec_lines)} with at least one ret")
    if no_ret:
        print(f"[extents] no reachable ret at all: {' '.join(sorted(no_ret))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
