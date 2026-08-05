#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Check every recorded (from-PC, to-PC, T-states) transition against the ROM.

Input is the distinct-transition set produced by tools/steptrace.js. For each
transition this decodes the instruction at from-PC out of the ROM image and asks two
questions the frame state diff cannot ask:

  1. IS to-PC A LEGAL SUCCESSOR?  For a normal instruction the only legal successor is
     the next instruction; for a branch it is the next instruction or the branch target;
     for a `call`/`rst` it is the callee's entry. Anything else means the translated
     source stepped somewhere the hardware would not have gone -- into the middle of an
     instruction, past a byte, or to a stale address.

  2. ARE THE T-STATES RIGHT?  Charged per the standard Z80 timings, with the taken and
     not-taken variants distinguished by which successor was actually stepped to. A
     wrong count is invisible to a RAM diff until it drifts a write across a frame
     boundary, at which point the diff blames the wrong frame.

WHAT IT CANNOT SEE. A step that was never emitted at all leaves no transition, so the
chain simply skips a link -- and a skipped link shows up here as an ILLEGAL SUCCESSOR
only if the two instructions are not adjacent. Adjacent-instruction omissions (the
classic missing not-taken `jr`) are caught, because from-PC then names an instruction
whose successor is two instructions along. It also says nothing about paths the
recorded run never took.

  node games/timeplt/tools/steptrace.js --frames 300 --out games/timeplt/out/steps.txt
  python3 games/timeplt/tools/stepaudit.py games/timeplt/out/steps.txt
"""
import os
import sys

sys.path.insert(0, os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))))), "tools"))
import z80_decode as z  # noqa: E402

ROM_END = 0x5FFF
NMI_VECTOR = 0x0066

# ---------------------------------------------------------------- timing tables
# Unprefixed opcodes. A tuple means (taken, not taken) for a conditional.
_B = [4] * 256
for _i, _v in {
    0x01: 10, 0x02: 7, 0x03: 6, 0x06: 7, 0x08: 4, 0x09: 11, 0x0A: 7, 0x0B: 6, 0x0E: 7,
    0x11: 10, 0x12: 7, 0x13: 6, 0x16: 7, 0x18: 12, 0x19: 11, 0x1A: 7, 0x1B: 6, 0x1E: 7,
    0x21: 10, 0x22: 16, 0x23: 6, 0x26: 7, 0x29: 11, 0x2A: 16, 0x2B: 6, 0x2E: 7,
    0x31: 10, 0x32: 13, 0x33: 6, 0x34: 11, 0x35: 11, 0x36: 10, 0x39: 11, 0x3A: 13,
    0x3B: 6, 0x3E: 7,
    0xC1: 10, 0xC3: 10, 0xC5: 11, 0xC6: 7, 0xC7: 11, 0xC9: 10, 0xCD: 17, 0xCE: 7, 0xCF: 11,
    0xD1: 10, 0xD3: 11, 0xD5: 11, 0xD6: 7, 0xD7: 11, 0xDB: 11, 0xDE: 7, 0xDF: 11,
    0xE1: 10, 0xE3: 19, 0xE5: 11, 0xE6: 7, 0xE7: 11, 0xEB: 4, 0xEE: 7, 0xEF: 11,
    0xF1: 10, 0xF5: 11, 0xF6: 7, 0xF7: 11, 0xF9: 6, 0xFE: 7, 0xFF: 11,
    0xC2: 10, 0xCA: 10, 0xD2: 10, 0xDA: 10, 0xE2: 10, 0xEA: 10, 0xF2: 10, 0xFA: 10,
    0xE9: 4,
}.items():
    _B[_i] = _v
for _i in range(0x40, 0x80):          # ld r,r'
    _B[_i] = 7 if (_i & 0x07) == 6 or (_i & 0x38) == 0x30 else 4
_B[0x76] = 4                          # halt
for _i in range(0x80, 0xC0):          # alu a,r
    _B[_i] = 7 if (_i & 0x07) == 6 else 4
_COND_JR = {0x20: (12, 7), 0x28: (12, 7), 0x30: (12, 7), 0x38: (12, 7)}
_COND_JP = {0xC2: (10, 10), 0xCA: (10, 10), 0xD2: (10, 10), 0xDA: (10, 10),
            0xE2: (10, 10), 0xEA: (10, 10), 0xF2: (10, 10), 0xFA: (10, 10)}
_COND_CALL = {0xC4: (17, 10), 0xCC: (17, 10), 0xD4: (17, 10), 0xDC: (17, 10),
              0xE4: (17, 10), 0xEC: (17, 10), 0xF4: (17, 10), 0xFC: (17, 10)}
_COND_RET = {0xC0: (11, 5), 0xC8: (11, 5), 0xD0: (11, 5), 0xD8: (11, 5),
             0xE0: (11, 5), 0xE8: (11, 5), 0xF0: (11, 5), 0xF8: (11, 5)}
_DJNZ = (13, 8)

_ED = {0x44: 8, 0x45: 14, 0x4D: 14, 0x46: 8, 0x56: 8, 0x5E: 8,
       0x47: 9, 0x4F: 9, 0x57: 9, 0x5F: 9, 0x67: 18, 0x6F: 18,
       0xA0: 16, 0xA1: 16, 0xA8: 16, 0xA9: 16,
       0xA2: 16, 0xA3: 16, 0xAA: 16, 0xAB: 16}
for _i in (0x42, 0x52, 0x62, 0x72, 0x4A, 0x5A, 0x6A, 0x7A):   # sbc/adc hl,rr
    _ED[_i] = 15
for _i in (0x43, 0x53, 0x63, 0x73, 0x4B, 0x5B, 0x6B, 0x7B):   # ld (nn),rr / ld rr,(nn)
    _ED[_i] = 20
for _i in (0x40, 0x48, 0x50, 0x58, 0x60, 0x68, 0x78,          # in r,(c)
           0x41, 0x49, 0x51, 0x59, 0x61, 0x69, 0x79):         # out (c),r
    _ED[_i] = 12
_ED_REPEAT = {0xB0: (21, 16), 0xB1: (21, 16), 0xB8: (21, 16), 0xB9: (21, 16),
              0xB2: (21, 16), 0xB3: (21, 16), 0xBA: (21, 16), 0xBB: (21, 16)}

# DD/FD-prefixed opcodes that are NOT a plain `base + 4`.
_IDX = {0x09: 15, 0x19: 15, 0x29: 15, 0x39: 15, 0x21: 14, 0x22: 20, 0x2A: 20,
        0x23: 10, 0x2B: 10, 0x34: 23, 0x35: 23, 0x36: 19,
        0x24: 8, 0x25: 8, 0x2C: 8, 0x2D: 8, 0x26: 11, 0x2E: 11,
        0xE1: 14, 0xE5: 15, 0xE3: 23, 0xE9: 8, 0xF9: 10}


def timing(rom, a, to):
    """(cycles, legal_successors, why) for the instruction at `a`."""
    op = rom[a]
    ins = z.decode(rom, a)
    nxt = ins.end

    if op == 0xCB:
        sub = rom[a + 1]
        if (sub & 0x07) == 6:                       # (hl) form
            cyc = 12 if 0x40 <= sub < 0x80 else 15  # bit n,(hl) is 12
        else:
            cyc = 8
        return cyc, {nxt}, None
    if op == 0xED:
        sub = rom[a + 1]
        if sub in _ED_REPEAT:
            # repeating: 21 while it loops back onto itself, 16 on the last pass
            return _ED_REPEAT[sub][0] if to == a else _ED_REPEAT[sub][1], {a, nxt}, None
        if sub in _ED:
            return _ED[sub], {nxt}, None
        return None, {nxt}, f"ed {sub:02x}: no timing in table"
    if op in (0xDD, 0xFD):
        sub = rom[a + 1]
        if sub == 0xCB:
            k = rom[a + 3]
            return (20 if 0x40 <= k < 0x80 else 23), {nxt}, None
        if sub in _IDX:
            return _IDX[sub], {nxt}, None
        # 0x40-0xBF: 19 T-states only when the (hl) slot is used, i.e. the operand is
        # really (ix+d). Otherwise the prefix just renames H/L to IXH/IXL -- the
        # undocumented register forms, which cost the base 4 plus 4 for the prefix.
        if 0x40 <= sub < 0xC0:
            indexed = (sub & 0x07) == 6 or (0x40 <= sub < 0x80 and (sub & 0x38) == 0x30)
            return (19 if indexed else 8), {nxt}, None
        return _B[sub] + 4, {nxt}, None

    if op == 0x10:                                   # djnz
        t = ins.target
        return (_DJNZ[0] if to == t else _DJNZ[1]), {t, nxt}, None
    if op in _COND_JR:
        t = ins.target
        return (_COND_JR[op][0] if to == t else _COND_JR[op][1]), {t, nxt}, None
    if op in _COND_JP:
        t = ins.target
        return (_COND_JP[op][0] if to == t else _COND_JP[op][1]), {t, nxt}, None
    if op in _COND_CALL:
        t = ins.target
        return (_COND_CALL[op][0] if to == t else _COND_CALL[op][1]), {t, nxt}, None
    if op in _COND_RET:
        # taken lands anywhere (the popped address); not taken falls through
        return (_COND_RET[op][1] if to == nxt else _COND_RET[op][0]), None, None
    if op == 0xC9:                                   # ret
        return 10, None, None
    if op == 0xE9:                                   # jp (hl)
        return 4, None, None
    if op == 0xF7:                                   # rst 0x30 -- inline table dispatch
        return 11, {0x0030}, None
    if op == 0xC3:                                   # jp nn
        return 10, {ins.target}, None
    if op == 0x18:                                   # jr
        return 12, {ins.target}, None
    if op == 0xCD:                                   # call nn
        return 17, {ins.target}, None
    if (op & 0xC7) == 0xC7:                          # rst p
        return 11, {op & 0x38}, None
    return _B[op], {nxt}, None


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "games/timeplt/out/steps.txt"
    romp = "games/timeplt/rom/maincpu.bin"
    rom = open(romp, "rb").read()

    bad_succ, bad_cyc, unknown, skipped = [], [], [], 0
    n = 0
    for line in open(path):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        f, t, c = line.split()
        f, t, c = int(f, 16), int(t, 16), int(c)
        n += 1
        if t == NMI_VECTOR and c == 11:
            skipped += 1          # the vblank NMI can interrupt anywhere
            continue
        if f > ROM_END:
            skipped += 1
            continue
        cyc, succ, why = timing(rom, f, t)
        if why:
            unknown.append((f, t, c, why))
            continue
        if succ is not None and t not in succ:
            bad_succ.append((f, t, c, succ))
            continue
        if cyc is not None and c != cyc:
            bad_cyc.append((f, t, c, cyc))

    print(f"[stepaudit] {n} distinct transitions, {skipped} skipped (NMI entry / non-ROM)")
    for f, t, c, succ in bad_succ:
        ins = z.decode(rom, f)
        print(f"  ILLEGAL SUCCESSOR  {f:04x} -> {t:04x} ({c}T)   {ins.text:<24} "
              f"legal: {' '.join(f'{s:04x}' for s in sorted(succ))}")
    for f, t, c, want in bad_cyc:
        ins = z.decode(rom, f)
        print(f"  WRONG T-STATES     {f:04x} -> {t:04x}   charged {c}, want {want}   {ins.text}")
    for f, t, c, why in unknown:
        print(f"  NO TIMING          {f:04x} -> {t:04x} ({c}T)   {why}")
    # An UNTIMED transition was skipped by BOTH checks, so it is not evidence of anything.
    # Printing CLEAN beside it and still exiting 0 let a caller reading $? treat a partial
    # audit as a full one -- the word and the status have to agree with the coverage.
    total = len(bad_succ) + len(bad_cyc)
    verdict = str(total) + " DEFECT(S)" if total else ("CLEAN" if not unknown else "INCOMPLETE")
    print(f"[stepaudit] {verdict}"
          + (f", {len(unknown)} untimed (NOT audited)" if unknown else ""))
    return 1 if (total or unknown) else 0


if __name__ == "__main__":
    sys.exit(main())
