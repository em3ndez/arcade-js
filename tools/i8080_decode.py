# SPDX-License-Identifier: GPL-3.0-only
"""Intel 8080 instruction decoder.

Same Instr shape + control-flow classification as tools/z80_decode.py, so trace.py can drive the
recursive-descent walk on 8080 ROMs (Space Invaders). Built from the x/y/z/p/q decomposition of the
opcode byte, so all 256 values decode (a data region becomes garbage instructions, never an exception).

    opcode = 0b xx yyy zzz     p = y >> 1     q = y & 1

The 8080 has NO prefix bytes: the values Z80 uses for CB/ED/DD/FD and for EX-AF/DJNZ/JR (0x08 0x10
0x18 0x20 0x28 0x30 0x38 0xCB 0xD9 0xDD 0xED 0xFD) are single-byte 8080 ops (undocumented NOP/JMP/
CALL/RET aliases). Mnemonics are 8080-style (MOV/MVI/LXI/JMP/CALL/...) for a faithful listing; trace.py
keys on `kind`/`target`, not the text.
"""

import argparse
import os
import sys
from dataclasses import dataclass, field

NORMAL = "normal"
JUMP = "jump"
JUMP_COND = "jump_cond"
CALL = "call"
CALL_COND = "call_cond"
RST = "rst"
RET = "ret"
RET_COND = "ret_cond"
JUMP_INDIRECT = "jump_indirect"  # PCHL -- unresolved, terminates
HALT = "halt"

TERMINAL = {JUMP, RET, JUMP_INDIRECT}


# MAME i8080 cycle table -- lut_cycles_8080[256] copied VERBATIM from
# mame-src/src/devices/cpu/i8085/i8085.cpp. It is the BASE states charged for each opcode
# (execute_one: m_icount -= lut_cycles[opcode]). Conditional CALL/RET add +6 WHEN TAKEN
# (so the table's value is the not-taken cost: CALL 11->17, RET 5->11); an UNCONDITIONAL
# call is always +6 (op_call(1)); conditional/unconditional JMP is +0. See that file's
# "special cases" note (op_ret +6, op_jmp +0, op_call +6 for 8080).
CYCLES_8080 = [
    4, 10, 7, 5, 5, 5, 7, 4, 4, 10, 7, 5, 5, 5, 7, 4,   # 0x
    4, 10, 7, 5, 5, 5, 7, 4, 4, 10, 7, 5, 5, 5, 7, 4,   # 1x
    4, 10, 16, 5, 5, 5, 7, 4, 4, 10, 16, 5, 5, 5, 7, 4,  # 2x
    4, 10, 13, 5, 10, 10, 10, 4, 4, 10, 13, 5, 5, 5, 7, 4,  # 3x
    5, 5, 5, 5, 5, 5, 7, 5, 5, 5, 5, 5, 5, 5, 7, 5,     # 4x
    5, 5, 5, 5, 5, 5, 7, 5, 5, 5, 5, 5, 5, 5, 7, 5,     # 5x
    5, 5, 5, 5, 5, 5, 7, 5, 5, 5, 5, 5, 5, 5, 7, 5,     # 6x
    7, 7, 7, 7, 7, 7, 7, 7, 5, 5, 5, 5, 5, 5, 7, 5,     # 7x  (0x76 HLT=7)
    4, 4, 4, 4, 4, 4, 7, 4, 4, 4, 4, 4, 4, 4, 7, 4,     # 8x
    4, 4, 4, 4, 4, 4, 7, 4, 4, 4, 4, 4, 4, 4, 7, 4,     # 9x
    4, 4, 4, 4, 4, 4, 7, 4, 4, 4, 4, 4, 4, 4, 7, 4,     # Ax
    4, 4, 4, 4, 4, 4, 7, 4, 4, 4, 4, 4, 4, 4, 7, 4,     # Bx
    5, 10, 10, 10, 11, 11, 7, 11, 5, 10, 10, 10, 11, 11, 7, 11,  # Cx
    5, 10, 10, 10, 11, 11, 7, 11, 5, 10, 10, 10, 11, 11, 7, 11,  # Dx
    5, 10, 10, 18, 11, 11, 7, 11, 5, 5, 10, 4, 11, 11, 7, 11,    # Ex
    5, 10, 10, 4, 11, 11, 7, 11, 5, 5, 10, 4, 11, 11, 7, 11,     # Fx
]
assert len(CYCLES_8080) == 256


def cyc_annotation(opcode, kind):
    """T-states for `opcode` as a listing string, using the decoder's `kind` to apply the
    +6-when-taken rule: conditional CALL/RET show "notTaken/taken", an unconditional CALL is
    base+6, everything else is the base charge. This is the T-state authority the §3 lift
    charges via m.step(addr, T)."""
    base = CYCLES_8080[opcode & 0xff]
    if kind in (CALL_COND, RET_COND):
        return f"{base}/{base + 6}"
    if kind == CALL:
        return str(base + 6)
    return str(base)


@dataclass
class Instr:
    addr: int
    length: int
    text: str
    kind: str = NORMAL
    target: int | None = None
    raw: bytes = field(default=b"", repr=False)

    @property
    def end(self) -> int:
        return self.addr + self.length

    def hexdump(self) -> str:
        return " ".join(f"{b:02x}" for b in self.raw)

    @property
    def cyc(self) -> str:
        """MAME-i8080 T-states as a listing string ("4", "10", "11/17" for a cond CALL)."""
        return cyc_annotation(self.raw[0], self.kind) if self.raw else ""


# 8080 register / condition / pair tables (note the 8080 mnemonic register letters).
R = ["b", "c", "d", "e", "h", "l", "m", "a"]        # MOV/INR/DCR/MVI/ALU operand (m = memory via HL)
RP = ["b", "d", "h", "sp"]                          # LXI/DAD/INX/DCX pair (named by its high reg / sp)
RP2 = ["b", "d", "h", "psw"]                        # PUSH/POP pair
CC = ["nz", "z", "nc", "c", "po", "pe", "p", "m"]   # condition codes (same order as Z80)
ALU = ["add", "adc", "sub", "sbb", "ana", "xra", "ora", "cmp"]      # register-form ALU
ALUI = ["adi", "aci", "sui", "sbi", "ani", "xri", "ori", "cpi"]     # immediate-form ALU
ACC = ["rlc", "rrc", "ral", "rar", "daa", "cma", "stc", "cmc"]      # x=0,z=7 accumulator/flag ops


def _u8(mem, a):
    a &= 0xFFFF
    return mem[a] if a < len(mem) else 0x00


def _u16(mem, a):
    return _u8(mem, a) | (_u8(mem, a + 1) << 8)


def _nn(v):
    return f"0x{v:04x}"


def _n(v):
    return f"0x{v:02x}"


def _mk(mem, addr, length, text, kind=NORMAL, target=None):
    raw = bytes(_u8(mem, addr + i) for i in range(length))
    return Instr(addr=addr, length=length, text=text, kind=kind, target=target, raw=raw)


def decode(mem, addr):
    """Decode one 8080 instruction at `addr`. Never raises."""
    op = _u8(mem, addr)
    x, y, z = op >> 6, (op >> 3) & 7, op & 7
    p, q = y >> 1, y & 1
    nn = _u16(mem, addr + 1)
    n = _u8(mem, addr + 1)

    if x == 0:
        if z == 0:
            return _mk(mem, addr, 1, "nop")  # 0x00 + undoc 0x08/10/18/20/28/30/38
        if z == 1:
            if q == 0:
                return _mk(mem, addr, 3, f"lxi {RP[p]},{_nn(nn)}")
            return _mk(mem, addr, 1, f"dad {RP[p]}")
        if z == 2:
            if q == 0:
                if p == 0: return _mk(mem, addr, 1, "stax b")
                if p == 1: return _mk(mem, addr, 1, "stax d")
                if p == 2: return _mk(mem, addr, 3, f"shld {_nn(nn)}")
                return _mk(mem, addr, 3, f"sta {_nn(nn)}")
            if p == 0: return _mk(mem, addr, 1, "ldax b")
            if p == 1: return _mk(mem, addr, 1, "ldax d")
            if p == 2: return _mk(mem, addr, 3, f"lhld {_nn(nn)}")
            return _mk(mem, addr, 3, f"lda {_nn(nn)}")
        if z == 3:
            return _mk(mem, addr, 1, f"{'inx' if q == 0 else 'dcx'} {RP[p]}")
        if z == 4:
            return _mk(mem, addr, 1, f"inr {R[y]}")
        if z == 5:
            return _mk(mem, addr, 1, f"dcr {R[y]}")
        if z == 6:
            return _mk(mem, addr, 2, f"mvi {R[y]},{_n(n)}")
        # z == 7
        return _mk(mem, addr, 1, ACC[y])

    if x == 1:
        if y == 6 and z == 6:
            return _mk(mem, addr, 1, "hlt", HALT)
        return _mk(mem, addr, 1, f"mov {R[y]},{R[z]}")

    if x == 2:
        return _mk(mem, addr, 1, f"{ALU[y]} {R[z]}")

    # x == 3
    if z == 0:
        return _mk(mem, addr, 1, f"r{CC[y]}", RET_COND)  # conditional RET (rnz/rz/rnc/...)
    if z == 1:
        if q == 0:
            return _mk(mem, addr, 1, f"pop {RP2[p]}")
        if p == 0: return _mk(mem, addr, 1, "ret", RET)
        if p == 1: return _mk(mem, addr, 1, "ret", RET)  # undoc 0xD9
        if p == 2: return _mk(mem, addr, 1, "pchl", JUMP_INDIRECT)
        return _mk(mem, addr, 1, "sphl")
    if z == 2:
        return _mk(mem, addr, 3, f"j{CC[y]} {_nn(nn)}", JUMP_COND, nn)  # conditional JMP
    if z == 3:
        if y == 0: return _mk(mem, addr, 3, f"jmp {_nn(nn)}", JUMP, nn)
        if y == 1: return _mk(mem, addr, 3, f"jmp {_nn(nn)}", JUMP, nn)  # undoc 0xCB
        if y == 2: return _mk(mem, addr, 2, f"out {_n(n)}")
        if y == 3: return _mk(mem, addr, 2, f"in {_n(n)}")
        if y == 4: return _mk(mem, addr, 1, "xthl")
        if y == 5: return _mk(mem, addr, 1, "xchg")
        if y == 6: return _mk(mem, addr, 1, "di")
        return _mk(mem, addr, 1, "ei")
    if z == 4:
        return _mk(mem, addr, 3, f"c{CC[y]} {_nn(nn)}", CALL_COND, nn)  # conditional CALL
    if z == 5:
        if q == 0:
            return _mk(mem, addr, 1, f"push {RP2[p]}")
        # q == 1: CALL nn (p=0) + undoc CALL (0xDD/ED/FD)
        return _mk(mem, addr, 3, f"call {_nn(nn)}", CALL, nn)
    if z == 6:
        return _mk(mem, addr, 2, f"{ALUI[y]} {_n(n)}")
    # z == 7: RST y -> fixed page-zero address y*8
    return _mk(mem, addr, 1, f"rst {y}", RST, y * 8)


# ---------------------------------------------------------------------------
# selftest -- grounds the decoder against MAME's i8080 core, not against itself.
# ---------------------------------------------------------------------------

KINDS = {NORMAL, JUMP, JUMP_COND, CALL, CALL_COND, RST, RET, RET_COND,
         JUMP_INDIRECT, HALT}

# lut_cycles_8080[256], copied VERBATIM from the AUTHORITY --
# mame-src/src/devices/cpu/i8085/i8085.cpp lines 158-173. Kept independent of
# CYCLES_8080 so the check re-derives from MAME rather than mirroring the module.
MAME_LUT_CYCLES_8080 = [
    4, 10, 7, 5, 5, 5, 7, 4, 4, 10, 7, 5, 5, 5, 7, 4,
    4, 10, 7, 5, 5, 5, 7, 4, 4, 10, 7, 5, 5, 5, 7, 4,
    4, 10, 16, 5, 5, 5, 7, 4, 4, 10, 16, 5, 5, 5, 7, 4,
    4, 10, 13, 5, 10, 10, 10, 4, 4, 10, 13, 5, 5, 5, 7, 4,
    5, 5, 5, 5, 5, 5, 7, 5, 5, 5, 5, 5, 5, 5, 7, 5,
    5, 5, 5, 5, 5, 5, 7, 5, 5, 5, 5, 5, 5, 5, 7, 5,
    5, 5, 5, 5, 5, 5, 7, 5, 5, 5, 5, 5, 5, 5, 7, 5,
    7, 7, 7, 7, 7, 7, 7, 7, 5, 5, 5, 5, 5, 5, 7, 5,
    4, 4, 4, 4, 4, 4, 7, 4, 4, 4, 4, 4, 4, 4, 7, 4,
    4, 4, 4, 4, 4, 4, 7, 4, 4, 4, 4, 4, 4, 4, 7, 4,
    4, 4, 4, 4, 4, 4, 7, 4, 4, 4, 4, 4, 4, 4, 7, 4,
    4, 4, 4, 4, 4, 4, 7, 4, 4, 4, 4, 4, 4, 4, 7, 4,
    5, 10, 10, 10, 11, 11, 7, 11, 5, 10, 10, 10, 11, 11, 7, 11,
    5, 10, 10, 10, 11, 11, 7, 11, 5, 10, 10, 10, 11, 11, 7, 11,
    5, 10, 10, 18, 11, 11, 7, 11, 5, 5, 10, 4, 11, 11, 7, 11,
    5, 10, 10, 4, 11, 11, 7, 11, 5, 5, 10, 4, 11, 11, 7, 11,
]


def _selftest() -> int:
    """Prove the decoder classifies control flow and charges T-states as MAME does.

    Grounding authorities (cited per case): the i8080 cycle table and the
    conditional-branch +6 rule live in mame-src/src/devices/cpu/i8085/i8085.cpp
    (lut_cycles_8080, and op_ret/op_jmp/op_call with ret_taken=6, jmp_taken=0,
    call_taken=6 for the I8080 subclass -- see the "special cases" note there).
    """
    bad = []

    # 1) Every one of the 256 opcode values decodes from a 3-byte buffer without
    #    raising, with a sane length and a known kind. A data region must become
    #    garbage instructions, never an exception (see module docstring).
    for op in range(256):
        mem = bytes([op, 0x34, 0x12])
        try:
            ins = decode(mem, 0)
        except Exception as e:               # pragma: no cover -- the bug we guard
            bad.append(f"opcode 0x{op:02x} raised {type(e).__name__}: {e}")
            continue
        if not (1 <= ins.length <= 3):
            bad.append(f"opcode 0x{op:02x} length {ins.length} out of 1..3")
        if ins.kind not in KINDS:
            bad.append(f"opcode 0x{op:02x} kind {ins.kind!r} not in known set")

    # 2) Control-flow KIND for one representative of each class. A wrong-wired
    #    decoder (e.g. RST read as NORMAL, or PCHL not terminating) fails here.
    kind_cases = {
        0xC3: JUMP, 0xC2: JUMP_COND, 0xCD: CALL, 0xC4: CALL_COND,
        0xC9: RET, 0xC0: RET_COND, 0xCF: RST, 0xE9: JUMP_INDIRECT,
        0x76: HALT, 0x00: NORMAL,
    }
    for op, want in kind_cases.items():
        got = decode(bytes([op, 0, 0]), 0).kind
        if got != want:
            bad.append(f"opcode 0x{op:02x} kind {got!r}, want {want!r}")

    # 3a) The module's cycle table must equal MAME's lut_cycles_8080 element for
    #     element (re-derived above, not mirrored from CYCLES_8080).
    if list(CYCLES_8080) != MAME_LUT_CYCLES_8080:
        for i, (a, b) in enumerate(zip(CYCLES_8080, MAME_LUT_CYCLES_8080)):
            if a != b:
                bad.append(f"CYCLES_8080[0x{i:02x}]={a}, MAME lut_cycles_8080={b}")

    # 3b) cyc annotation strings, incl. the +6-when-taken rule for conditional
    #     CALL/RET and the always-+6 on unconditional CALL, while JMP gets +0.
    cyc_cases = {
        0x00: "4",     # NOP base
        0xC3: "10",    # JMP +0 (op_jmp jmp_taken=0) -- NOT 16
        0xCD: "17",    # CALL base 11 +6 always (op_call call_taken=6)
        0xC4: "11/17", # cond CALL: not-taken 11 / taken +6
        0xC0: "5/11",  # cond RET: not-taken 5 / taken +6 (ret_taken=6)
        0xC9: "10",    # unconditional RET base
        0xCF: "11",    # RST base
        0xE9: "5",     # PCHL base
        0x3E: "7",     # MVI A,n
        0x01: "10",    # LXI B,nnnn
        0x32: "13",    # STA nnnn
        0x7E: "7",     # MOV A,M
        0x34: "10",    # INR M
        0xE3: "18",    # XTHL
        0xEB: "4",     # XCHG
    }
    for op, want in cyc_cases.items():
        got = decode(bytes([op, 0, 0]), 0).cyc
        if got != want:
            bad.append(f"opcode 0x{op:02x} cyc {got!r}, want {want!r}")

    # 3c) Mutation teeth: assert the +6 RELATIONSHIP so an impl that dropped the
    #     rule (or misapplied it to JMP) would fail even if the table were right.
    base_call, base_cc = CYCLES_8080[0xCD], CYCLES_8080[0xC4]
    if decode(bytes([0xCD, 0, 0]), 0).cyc != str(base_call + 6):
        bad.append("unconditional CALL is not base+6")
    if decode(bytes([0xC4, 0, 0]), 0).cyc.split("/")[1] != str(base_cc + 6):
        bad.append("cond CALL taken side is not base+6")
    if decode(bytes([0xC3, 0, 0]), 0).cyc != str(CYCLES_8080[0xC3]):
        bad.append("JMP wrongly charged a taken bonus")

    # 4) Real ROM boot, if present (gitignored -- SKIP when absent, never fail).
    #    Space Invaders resets to nop;nop;nop;jmp 0x18d4 (00 00 00 c3 d4 18).
    rom_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            "..", "games", "invaders", "rom", "maincpu.bin")
    boot = "SKIP (rom absent)"
    if os.path.exists(rom_path):
        with open(rom_path, "rb") as f:
            rom = f.read()
        a, texts, last = 0, [], None
        for _ in range(4):
            last = decode(rom, a)
            texts.append(last.text)
            a = last.end
        if texts != ["nop", "nop", "nop", "jmp 0x18d4"]:
            bad.append(f"ROM boot decoded {texts}, want nop;nop;nop;jmp 0x18d4")
        elif last.kind != JUMP or last.target != 0x18D4:
            bad.append(f"ROM boot jmp kind/target {last.kind}/{last.target:#06x}")
        else:
            boot = "OK (nop;nop;nop;jmp 0x18d4)"

    if bad:
        for b in bad:
            print(f"selftest FAIL: {b}")
        return 1
    print(f"selftest: 256/256 opcodes decode (len 1..3, known kind); "
          f"{len(kind_cases)} control-flow kinds + {len(cyc_cases)} cycle "
          f"annotations match i8085.cpp lut_cycles_8080; boot={boot}")
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true",
                    help="ground the decoder against MAME's i8080 core, then exit")
    args = ap.parse_args()
    if args.selftest:
        sys.exit(_selftest())
    ap.error("nothing to do (this module is a library; try --selftest)")


if __name__ == "__main__":
    main()
