#!/usr/bin/env python3
"""Reachability-driven 6502 disassembly listing for a game, in the same on-disk
format tools/trace.py emits for Z80/8080 games (loc_<addr> labels, instruction
lines `    <text>  ; ADDR bytes`, `; ==== UNREACHED ... ====` data spans), so
gen_ca_contrib.py and the CA gloss slicer consume it unchanged.

6502 recursive descent, seeded from the three hardware vectors (NMI/RESET/IRQ)
AND every named routine entry in the game's names.js -- the latter supplies the
indexed-JMP / jump-table targets a purely-static walk cannot resolve (the same
role tools/trace.py's entrypoints.json plays for DK). Uses the round-trip- and
positive-control-verified tools/m6502_decode.

TEETH: the traced code-address set is cross-checked against the port's OWN
disassembly (the `// ADDR mnem` comments in translated/loc_*.js). A byte I walk
as code that the port treats as data (a JSR-inline-data idiom, a mis-seed) or a
port instruction I never reach is reported -- a silent mis-trace corrupts the doc.

Usage: trace6502.py <game> [--out games/<game>/out/dk.asm]
"""
import argparse
import glob
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from m6502_decode import decode  # noqa: E402
from z80_decode import CALL, JUMP, JUMP_COND, JUMP_INDIRECT, RET  # noqa: E402

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def rom_range(game):
    """(lo, hi_exclusive) of the maincpu ROM in the CPU address space, from the
    manifest's rom.images.maincpu.size and the board's memory map. Centiped maps
    its 0x2000-byte image at 0x2000-0x3FFF."""
    # The centiped image is 0x2000 bytes at 0x2000. Kept explicit per game; a new
    # 6502 game adds its base here rather than guessing from the image size.
    bases = {"centiped": 0x2000}
    manifest = open(os.path.join(REPO, "games", game, "manifest.js")).read()
    m = re.search(r"maincpu:\s*\{.*?size:\s*(0x[0-9a-fA-F]+)", manifest, re.S)
    size = int(m.group(1), 16)
    base = bases[game]
    return base, base + size


def load_mem(game, lo, hi):
    rom = open(os.path.join(REPO, "games", game, "rom", "maincpu.bin"), "rb").read()
    mem = bytearray(0x10000)
    mem[lo:lo + len(rom)] = rom
    return mem


def routine_entries(game, lo, hi):
    """Routine entry addresses in [lo,hi): the translated/loc_<addr>.js filenames.
    These are the port's actual routine entries -- including the indexed-JMP /
    dispatch-table targets a static walk cannot resolve -- NOT arbitrary hex
    constants (data-cell addresses) that a names.js grep would wrongly seed."""
    addrs = set()
    for fn in glob.glob(os.path.join(REPO, "games", game, "translated", "loc_*.js")):
        m = re.search(r"loc_([0-9a-f]{4})\.js$", fn)
        if m:
            a = int(m.group(1), 16)
            if lo <= a < hi:
                addrs.add(a)
    return addrs


def port_code_addrs(game, lo, hi):
    """The port's own reachable-instruction address set -- the trace's cross-check
    oracle. Derived from the `m.step(0xNNNN, cyc)` calls (emitted on EVERY
    translated instruction, whose first arg is a reachable NEXT-instruction
    address: fall-through AND branch/jump/return targets) unioned with the
    loc_<addr>.js entry addresses. This is complete, unlike the `// ADDR mnem`
    comments, which the port does not attach to every instruction line."""
    addrs = set()
    for fn in glob.glob(os.path.join(REPO, "games", game, "translated", "loc_*.js")):
        m = re.search(r"loc_([0-9a-f]{4})\.js$", fn)
        if m and lo <= int(m.group(1), 16) < hi:
            addrs.add(int(m.group(1), 16))
        text = open(fn).read()
        # m.step (fall-through + branch/jump targets) and m.call (routine entries)
        # are true instruction starts. NOT m.push16 -- on the 6502 a JSR pushes
        # PC+2 (the JSR's last byte), so a push16 arg is return-minus-one.
        for sm in re.finditer(r"m\.(?:step|call)\(0x([0-9a-f]{4})", text):
            a = int(sm.group(1), 16)
            if lo <= a < hi:
                addrs.add(a)
    return addrs


class Tracer:
    def __init__(self, mem, lo, hi):
        self.mem, self.lo, self.hi = mem, lo, hi
        self.instrs = {}
        self.call_targets = set()
        self.jump_targets = set()
        self.entries = []

    def _in_rom(self, a):
        return self.lo <= a < self.hi

    def seed(self, addr, why):
        self.entries.append((addr, why))

    def run(self):
        work = [a for a, _ in self.entries if self._in_rom(a)]
        while work:
            pc = work.pop()
            while self._in_rom(pc) and pc not in self.instrs:
                ins = decode(self.mem, pc)
                self.instrs[pc] = ins
                if ins.kind == CALL:
                    if ins.target is not None and self._in_rom(ins.target):
                        self.call_targets.add(ins.target)
                        work.append(ins.target)
                    pc = ins.end  # JSR returns to the following instruction
                elif ins.kind == JUMP_COND:
                    if ins.target is not None and self._in_rom(ins.target):
                        self.jump_targets.add(ins.target)
                        work.append(ins.target)
                    pc = ins.end
                elif ins.kind == JUMP:
                    if ins.target is not None and self._in_rom(ins.target):
                        self.jump_targets.add(ins.target)
                        work.append(ins.target)
                    break  # unconditional -- terminates this fall-through run
                elif ins.kind in (RET, JUMP_INDIRECT):
                    break
                else:
                    pc = ins.end


def write_listing(tr, game, path):
    labels = {}
    for a in sorted(tr.call_targets | tr.jump_targets):
        if a in tr.instrs:
            labels[a] = f"loc_{a:04x}"
    for a, _why in tr.entries:
        if a in tr.instrs:
            labels[a] = f"loc_{a:04x}"

    code_bytes = sum(ins.length for ins in tr.instrs.values())
    total = tr.hi - tr.lo
    lines = [
        f"; {game} maincpu - reachability-driven 6502 disassembly",
        "; Generated by tools/trace6502.py. Do not edit by hand.",
        f"; coverage: {round(100.0 * code_bytes / total, 2)}% of {total} bytes reachable "
        f"from {len(tr.entries)} entry point(s)",
        ";",
        "; UNREACHED spans are data (tables, graphics indices, text) or code not yet exercised.",
        "",
    ]
    a = tr.lo
    while a < tr.hi:
        ins = tr.instrs.get(a)
        if ins is None:
            start = a
            while a < tr.hi and a not in tr.instrs:
                a += 1
            lines.append("")
            lines.append(f"; ==== UNREACHED 0x{start:04x}-0x{a - 1:04x} ({a - start} bytes) ====")
            for row in range(start, a, 16):
                chunk = tr.mem[row:min(row + 16, a)]
                hexes = ",".join(f"0x{b:02x}" for b in chunk)
                lines.append(f"    ; {row:04x}:  defb {hexes}")
            lines.append("")
            continue
        if a in labels:
            lines.append("")
            lines.append(f"{labels[a]}:")
        lines.append(f"    {ins.text:<28} ; {a:04x}  {ins.hexdump()}")
        a = ins.end
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")


def prune_to_port(tr, game):
    """Bound the static trace by the port's MAME-validated reachability (the runbook
    cross-check: a static recursive descent over-reads data through a
    dynamically-dead fall-through -- e.g. the fall-through of a branch that is
    always taken lands in a data table). The port ran the full golden + gameplay
    and translates 100% of executable code, so any address it never executed is
    data. Prune those over-reads to data spans and report them (never silently)."""
    port = port_code_addrs(game, tr.lo, tr.hi)
    mine = set(tr.instrs)
    over = sorted(mine - port)
    under = sorted(a for a in port - mine if tr._in_rom(a))
    print(f"cross-check vs port (MAME-validated) reachability: port={len(port)} code addrs, traced={len(mine)}")
    if under:
        # A port-executed instruction the trace never reached => a real gap (a
        # missing seed / an edge the decoder classified wrong). This must be zero.
        print(f"  ERROR: {len(under)} port-reached instruction(s) NOT traced -- a real coverage gap:")
        for a in under[:20]:
            print(f"    0x{a:04x}")
        return False
    print(f"  pruning {len(over)} static over-read(s) into data (dynamically-dead fall-through into data):")
    for a in over:
        print(f"    0x{a:04x}  {tr.instrs[a].text}")
        del tr.instrs[a]
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("game")
    ap.add_argument("--out")
    args = ap.parse_args()
    lo, hi = rom_range(args.game)
    mem = load_mem(args.game, lo, hi)
    tr = Tracer(mem, lo, hi)
    # Hardware vectors (6502: NMI@FFFA, RESET@FFFC, IRQ@FFFE -- mirrored to the top
    # of the mapped ROM at hi-6..hi-1).
    for off, why in ((6, "NMI vector"), (4, "RESET vector"), (2, "IRQ/BRK vector")):
        v = mem[hi - off] | (mem[hi - off + 1] << 8)
        if tr._in_rom(v):
            tr.seed(v, why)
    for a in sorted(routine_entries(args.game, lo, hi)):
        tr.seed(a, "routine entry")
    tr.run()
    ok = prune_to_port(tr, args.game)
    out = args.out or os.path.join(REPO, "games", args.game, "out", "dk.asm")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    write_listing(tr, args.game, out)
    print(f"wrote {out}  ({len(tr.instrs)} instructions, {len(tr.entries)} seeds)")
    print("trace6502:", "OK" if ok else "FAIL -- a real coverage gap; resolve before emitting")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
