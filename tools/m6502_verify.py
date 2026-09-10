#!/usr/bin/env python3
"""Verify tools/m6502_decode.py against the centiped ROM. Two independent teeth:

  1. ROUND-TRIP (byte-identity over the FULL ROM): a linear decode of every byte
     0x2000-0x3FFF, each instruction re-assembled from its TEXT, must reproduce
     the ROM byte-for-byte. Catches any opcode whose length/operand extraction is
     wrong (a mis-length desyncs the tiling; a mis-operand fails the re-assemble).
  2. POSITIVE CONTROL (semantic): every instruction the port independently
     disassembled -- the `// ADDR mnem operand` comments in translated/loc_*.js --
     must decode to the SAME mnemonic+operand here. Catches a consistent-but-wrong
     opcode->mnemonic mapping that round-trip alone cannot see.

Exit 0 iff both pass. A silent mis-decode corrupts the whole CA doc, so this runs
before the disassembly is emitted."""
import glob
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from m6502_decode import assemble, decode  # noqa: E402

REPO = os.path.expanduser("~/arcade-js")
ROM = os.path.join(REPO, "games/centiped/rom/maincpu.bin")
LOC_GLOB = os.path.join(REPO, "games/centiped/translated/loc_*.js")
ROM_BASE = 0x2000


def load_mem():
    rom = open(ROM, "rb").read()
    mem = bytearray(0x10000)
    mem[ROM_BASE:ROM_BASE + len(rom)] = rom
    return mem, ROM_BASE, ROM_BASE + len(rom)


def canon(s):
    return re.sub(r"\s+", " ", s.strip().lower()).replace("$", "0x")


def strip_annot(t):
    """Drop the port's trailing flow annotations -- ` (fall)`, ` (taken -> rts)`,
    ` (loc_20b8)` -- which follow the operand. Preserve a real indirect-operand
    paren (`(0x2000)`, `(0x8a,x)`), whose content is hex."""
    prev = None
    while prev != t:
        prev = t
        m = re.search(r"\s+\(([^()]*)\)$", t)  # a trailing (...) annotation, unless it is an operand
        if m:
            inside = m.group(1).strip().lower().replace("$", "0x")
            if not re.fullmatch(r"0x[0-9a-f]+(,x)?", inside):
                t = t[:m.start()]
                continue
        m = re.search(r"\s+->.*$", t)  # a trailing unparenthesized ` -> 2b12 rts` flow note
        if m:
            t = t[:m.start()]
    return t


def roundtrip(mem, lo, hi):
    recon = bytearray(0x10000)
    pos = lo
    n = 0
    while pos < hi:
        ins = decode(mem, pos)
        asm = assemble(ins.text, pos)
        if asm != ins.raw:
            print(f"ROUND-TRIP FAIL @ 0x{pos:04x}: text={ins.text!r} -> {asm.hex()} != rom {ins.raw.hex()}")
            return False
        recon[pos:pos + ins.length] = ins.raw
        pos += ins.length
        n += 1
    if recon[lo:hi] != mem[lo:hi]:
        print("ROUND-TRIP FAIL: reconstruction != ROM over 0x%04x-0x%04x" % (lo, hi - 1))
        return False
    print(f"round-trip: OK -- {n} instructions over 0x{lo:04x}-0x{hi - 1:04x} re-assemble byte-identical")
    return True


def positive_control(mem):
    """Compare decode() to the port's own disassembly comments."""
    pairs = {}  # addr -> port text (dedup; loc files don't overlap)
    files = 0
    for fn in glob.glob(LOC_GLOB):
        files += 1
        for ln in open(fn):
            _, sep, comment = ln.partition("//")
            if not sep:
                continue
            m = re.match(r"\s*([0-9a-f]{4})\s+([a-z][a-z0-9]{1,3}(?:\s.*)?)\s*$", comment)
            if not m:
                continue
            pairs[int(m.group(1), 16)] = m.group(2).strip()
    checked = 0
    mismatches = []
    underspecified = 0
    for addr, port_text in sorted(pairs.items()):
        mine = decode(mem, addr).text
        ptext = strip_annot(port_text)
        checked += 1
        if canon(ptext) == canon(mine):
            continue
        # Port sometimes writes just the mnemonic (target left as an annotation it
        # then stripped). Accept a mnemonic-only match -- the opcode is still confirmed.
        if " " not in ptext.strip() and ptext.strip() == mine.split(None, 1)[0]:
            underspecified += 1
            continue
        mismatches.append((addr, port_text, mine))
    print(f"positive-control: {checked} port-disassembled instructions across {files} loc_ files, "
          f"{len(mismatches)} mismatch(es) ({underspecified} mnemonic-only accepted)")
    for addr, p, mine in mismatches[:25]:
        print(f"  MISMATCH @ 0x{addr:04x}: port={p!r}  decode={mine!r}")
    return not mismatches


def main():
    mem, lo, hi = load_mem()
    ok1 = roundtrip(mem, lo, hi)
    ok2 = positive_control(mem)
    if ok1 and ok2:
        print("m6502_verify: OK -- decoder round-trips AND matches the port's disassembly")
        return 0
    print("m6502_verify: FAIL")
    return 1


if __name__ == "__main__":
    sys.exit(main())
