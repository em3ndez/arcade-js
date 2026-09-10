# SPDX-License-Identifier: GPL-3.0-only
"""MOS 6502 instruction decoder.

Same Instr contract and control-flow classification as z80_decode (imported
below), so the CA disassembly tooling (gen_ca_contrib.py) and a recursive-descent
tracer can consume either CPU through one interface.

Operand text uses the SAME `0x`-hex style as z80_decode (e.g. `lda 0x0c00`,
`and #0x20`, `bcc 0x2015`) rather than the classic `$` assembler style, because
the CA emitter's cross-reference and memory-token regexes match `0x`. A branch's
operand is the ABSOLUTE target (addr + 2 + signed displacement), not the raw
displacement byte.

VERIFICATION (tools/m6502_verify.py):
  1. round-trip -- a linear decode of the whole ROM re-assembles byte-identical;
  2. positive control -- every reachable instruction's text matches the port's
     own independently-derived disassembly (the `// ADDR mnem` comments in
     games/centiped/translated/loc_*.js).
A silent mis-decode corrupts the whole CA doc, so neither check is optional.
"""

from z80_decode import (  # noqa: E402  -- reuse the exact Instr shape + flow enums
    CALL,
    Instr,
    JUMP,
    JUMP_COND,
    JUMP_INDIRECT,
    NORMAL,
    RET,
)

# --------------------------------------------------------------------------- #
# Addressing modes: (operand length in bytes, a formatter, a re-assembler).
# The formatter renders operand text from the operand bytes (+ the instruction
# address, for relative branches). Modes drive both decode and byte length.
# --------------------------------------------------------------------------- #
IMP = "imp"  # implied            (1 byte total)
ACC = "acc"  # accumulator        rol a
IMM = "imm"  # immediate          #0x20
ZP = "zp"    # zero page          0x8a
ZPX = "zpx"  # zero page,X        0x8a,x
ZPY = "zpy"  # zero page,Y        0x8a,y
ABS = "abs"  # absolute           0x0c00
ABX = "abx"  # absolute,X         0x0c00,x
ABY = "aby"  # absolute,Y         0x0c00,y
IND = "ind"  # indirect           (0x2000)      -- JMP only
IZX = "izx"  # (indirect,X)       (0x8a,x)
IZY = "izy"  # (indirect),Y       (0x8a),y
REL = "rel"  # relative branch    0x2015        -- absolute target

OPERAND_LEN = {
    IMP: 0, ACC: 0, IMM: 1, ZP: 1, ZPX: 1, ZPY: 1,
    ABS: 2, ABX: 2, ABY: 2, IND: 2, IZX: 1, IZY: 1, REL: 1,
}

# The 151 legal NMOS 6502 opcodes: opcode -> (mnemonic, mode). Every other byte
# is an undocumented/illegal opcode and decodes as a 1-byte `.byte 0xNN` datum,
# so a data region walked as code round-trips instead of raising.
OPCODES = {
    # ADC
    0x69: ("adc", IMM), 0x65: ("adc", ZP), 0x75: ("adc", ZPX), 0x6D: ("adc", ABS),
    0x7D: ("adc", ABX), 0x79: ("adc", ABY), 0x61: ("adc", IZX), 0x71: ("adc", IZY),
    # AND
    0x29: ("and", IMM), 0x25: ("and", ZP), 0x35: ("and", ZPX), 0x2D: ("and", ABS),
    0x3D: ("and", ABX), 0x39: ("and", ABY), 0x21: ("and", IZX), 0x31: ("and", IZY),
    # ASL
    0x0A: ("asl", ACC), 0x06: ("asl", ZP), 0x16: ("asl", ZPX), 0x0E: ("asl", ABS), 0x1E: ("asl", ABX),
    # branches
    0x90: ("bcc", REL), 0xB0: ("bcs", REL), 0xF0: ("beq", REL), 0x30: ("bmi", REL),
    0xD0: ("bne", REL), 0x10: ("bpl", REL), 0x50: ("bvc", REL), 0x70: ("bvs", REL),
    # BIT
    0x24: ("bit", ZP), 0x2C: ("bit", ABS),
    # BRK
    0x00: ("brk", IMP),
    # flag clears/sets
    0x18: ("clc", IMP), 0xD8: ("cld", IMP), 0x58: ("cli", IMP), 0xB8: ("clv", IMP),
    0x38: ("sec", IMP), 0xF8: ("sed", IMP), 0x78: ("sei", IMP),
    # CMP / CPX / CPY
    0xC9: ("cmp", IMM), 0xC5: ("cmp", ZP), 0xD5: ("cmp", ZPX), 0xCD: ("cmp", ABS),
    0xDD: ("cmp", ABX), 0xD9: ("cmp", ABY), 0xC1: ("cmp", IZX), 0xD1: ("cmp", IZY),
    0xE0: ("cpx", IMM), 0xE4: ("cpx", ZP), 0xEC: ("cpx", ABS),
    0xC0: ("cpy", IMM), 0xC4: ("cpy", ZP), 0xCC: ("cpy", ABS),
    # DEC / DEX / DEY
    0xC6: ("dec", ZP), 0xD6: ("dec", ZPX), 0xCE: ("dec", ABS), 0xDE: ("dec", ABX),
    0xCA: ("dex", IMP), 0x88: ("dey", IMP),
    # EOR
    0x49: ("eor", IMM), 0x45: ("eor", ZP), 0x55: ("eor", ZPX), 0x4D: ("eor", ABS),
    0x5D: ("eor", ABX), 0x59: ("eor", ABY), 0x41: ("eor", IZX), 0x51: ("eor", IZY),
    # INC / INX / INY
    0xE6: ("inc", ZP), 0xF6: ("inc", ZPX), 0xEE: ("inc", ABS), 0xFE: ("inc", ABX),
    0xE8: ("inx", IMP), 0xC8: ("iny", IMP),
    # JMP / JSR
    0x4C: ("jmp", ABS), 0x6C: ("jmp", IND), 0x20: ("jsr", ABS),
    # LDA / LDX / LDY
    0xA9: ("lda", IMM), 0xA5: ("lda", ZP), 0xB5: ("lda", ZPX), 0xAD: ("lda", ABS),
    0xBD: ("lda", ABX), 0xB9: ("lda", ABY), 0xA1: ("lda", IZX), 0xB1: ("lda", IZY),
    0xA2: ("ldx", IMM), 0xA6: ("ldx", ZP), 0xB6: ("ldx", ZPY), 0xAE: ("ldx", ABS), 0xBE: ("ldx", ABY),
    0xA0: ("ldy", IMM), 0xA4: ("ldy", ZP), 0xB4: ("ldy", ZPX), 0xAC: ("ldy", ABS), 0xBC: ("ldy", ABX),
    # LSR
    0x4A: ("lsr", ACC), 0x46: ("lsr", ZP), 0x56: ("lsr", ZPX), 0x4E: ("lsr", ABS), 0x5E: ("lsr", ABX),
    # NOP
    0xEA: ("nop", IMP),
    # ORA
    0x09: ("ora", IMM), 0x05: ("ora", ZP), 0x15: ("ora", ZPX), 0x0D: ("ora", ABS),
    0x1D: ("ora", ABX), 0x19: ("ora", ABY), 0x01: ("ora", IZX), 0x11: ("ora", IZY),
    # stack
    0x48: ("pha", IMP), 0x08: ("php", IMP), 0x68: ("pla", IMP), 0x28: ("plp", IMP),
    # ROL / ROR
    0x2A: ("rol", ACC), 0x26: ("rol", ZP), 0x36: ("rol", ZPX), 0x2E: ("rol", ABS), 0x3E: ("rol", ABX),
    0x6A: ("ror", ACC), 0x66: ("ror", ZP), 0x76: ("ror", ZPX), 0x6E: ("ror", ABS), 0x7E: ("ror", ABX),
    # RTI / RTS
    0x40: ("rti", IMP), 0x60: ("rts", IMP),
    # SBC
    0xE9: ("sbc", IMM), 0xE5: ("sbc", ZP), 0xF5: ("sbc", ZPX), 0xED: ("sbc", ABS),
    0xFD: ("sbc", ABX), 0xF9: ("sbc", ABY), 0xE1: ("sbc", IZX), 0xF1: ("sbc", IZY),
    # STA / STX / STY
    0x85: ("sta", ZP), 0x95: ("sta", ZPX), 0x8D: ("sta", ABS), 0x9D: ("sta", ABX),
    0x99: ("sta", ABY), 0x81: ("sta", IZX), 0x91: ("sta", IZY),
    0x86: ("stx", ZP), 0x96: ("stx", ZPY), 0x8E: ("stx", ABS),
    0x84: ("sty", ZP), 0x94: ("sty", ZPX), 0x8C: ("sty", ABS),
    # transfers
    0xAA: ("tax", IMP), 0xA8: ("tay", IMP), 0xBA: ("tsx", IMP),
    0x8A: ("txa", IMP), 0x9A: ("txs", IMP), 0x98: ("tya", IMP),
}

# Reverse table for the re-assembler (round-trip teeth): (mnemonic, mode) -> opcode.
ENCODE = {(m, mode): op for op, (m, mode) in OPCODES.items()}

# Flow classification per mnemonic (6502 has no conditional call and no RST).
_BRANCHES = {"bcc", "bcs", "beq", "bmi", "bne", "bpl", "bvc", "bvs"}


def _u8(mem, a):
    a &= 0xFFFF
    return mem[a] if a < len(mem) else 0x00


def _u16(mem, a):
    return _u8(mem, a) | (_u8(mem, a + 1) << 8)


def _fmt(mode, operand, addr):
    """Operand text for a mode + its operand integer (little-endian already
    assembled). `addr` is the instruction start (for a relative target)."""
    if mode == IMP:
        return ""
    if mode == ACC:
        return "a"
    if mode == IMM:
        return "#0x%02x" % operand
    if mode == ZP:
        return "0x%02x" % operand
    if mode == ZPX:
        return "0x%02x,x" % operand
    if mode == ZPY:
        return "0x%02x,y" % operand
    if mode == ABS:
        return "0x%04x" % operand
    if mode == ABX:
        return "0x%04x,x" % operand
    if mode == ABY:
        return "0x%04x,y" % operand
    if mode == IND:
        return "(0x%04x)" % operand
    if mode == IZX:
        return "(0x%02x,x)" % operand
    if mode == IZY:
        return "(0x%02x),y" % operand
    if mode == REL:
        disp = operand - 256 if operand & 0x80 else operand
        return "0x%04x" % ((addr + 2 + disp) & 0xFFFF)
    raise AssertionError(mode)


def decode(mem, addr):
    """Decode one instruction at `addr`. Never raises: an illegal opcode becomes
    a 1-byte `.byte 0xNN` datum so a data region walked as code decodes to junk
    rather than blowing up the caller."""
    op = _u8(mem, addr)
    ent = OPCODES.get(op)
    if ent is None:
        return Instr(addr, 1, ".byte 0x%02x" % op, NORMAL, None, bytes([op]))
    mnem, mode = ent
    olen = OPERAND_LEN[mode]
    operand = 0
    if olen == 1:
        operand = _u8(mem, addr + 1)
    elif olen == 2:
        operand = _u16(mem, addr + 1)
    length = 1 + olen
    text = (mnem + " " + _fmt(mode, operand, addr)).strip()

    kind, target = NORMAL, None
    if mnem == "jmp":
        kind, target = (JUMP_INDIRECT, None) if mode == IND else (JUMP, operand)
    elif mnem == "jsr":
        kind, target = CALL, operand
    elif mnem in ("rts", "rti"):
        kind = RET
    elif mnem in _BRANCHES:
        disp = operand - 256 if operand & 0x80 else operand
        kind, target = JUMP_COND, (addr + 2 + disp) & 0xFFFF

    return Instr(addr, length, text, kind, target, bytes(mem[addr:addr + length]))


# --------------------------------------------------------------------------- #
# Re-assembler -- the round-trip tooth. Parse the operand TEXT back to a mode +
# operand value, look the opcode up in the reverse table, and re-emit the bytes.
# Independent of decode()'s opcode->text direction, so a wrong table entry that
# decode and this both share would still be caught by the positive control.
# --------------------------------------------------------------------------- #
import re  # noqa: E402


def _parse_operand(mnem, operand_text, addr):
    """(mode, [operand bytes]) for an operand text produced by _fmt."""
    t = operand_text.strip()
    if t == "":
        return IMP, []
    if t == "a":
        return ACC, []
    m = re.fullmatch(r"#0x([0-9a-f]{2})", t)
    if m:
        return IMM, [int(m.group(1), 16)]
    m = re.fullmatch(r"0x([0-9a-f]{2})", t)
    if m:
        return REL if mnem in _BRANCHES else ZP, [int(m.group(1), 16)]
    m = re.fullmatch(r"0x([0-9a-f]{2}),x", t)
    if m:
        return ZPX, [int(m.group(1), 16)]
    m = re.fullmatch(r"0x([0-9a-f]{2}),y", t)
    if m:
        return ZPY, [int(m.group(1), 16)]
    m = re.fullmatch(r"0x([0-9a-f]{4})", t)
    if m:
        if mnem in _BRANCHES:
            disp = (int(m.group(1), 16) - (addr + 2)) & 0xFF
            return REL, [disp]
        return ABS, [int(m.group(1), 16) & 0xFF, int(m.group(1), 16) >> 8]
    m = re.fullmatch(r"0x([0-9a-f]{4}),x", t)
    if m:
        return ABX, [int(m.group(1), 16) & 0xFF, int(m.group(1), 16) >> 8]
    m = re.fullmatch(r"0x([0-9a-f]{4}),y", t)
    if m:
        return ABY, [int(m.group(1), 16) & 0xFF, int(m.group(1), 16) >> 8]
    m = re.fullmatch(r"\(0x([0-9a-f]{4})\)", t)
    if m:
        return IND, [int(m.group(1), 16) & 0xFF, int(m.group(1), 16) >> 8]
    m = re.fullmatch(r"\(0x([0-9a-f]{2}),x\)", t)
    if m:
        return IZX, [int(m.group(1), 16)]
    m = re.fullmatch(r"\(0x([0-9a-f]{2})\),y", t)
    if m:
        return IZY, [int(m.group(1), 16)]
    raise ValueError(f"cannot parse operand {operand_text!r} for {mnem}")


def assemble(text, addr):
    """Assemble one instruction's text (`mnem [operand]`) at `addr` back to bytes.
    A `.byte 0xNN` datum re-emits its literal byte. Raises on anything the mode
    table cannot express -- which is the point: a lossy decode fails here."""
    parts = text.split(None, 1)
    mnem = parts[0]
    operand_text = parts[1] if len(parts) > 1 else ""
    if mnem == ".byte":
        return bytes([int(operand_text.strip(), 16)])
    mode, obytes = _parse_operand(mnem, operand_text, addr)
    op = ENCODE.get((mnem, mode))
    if op is None:
        raise ValueError(f"no opcode for ({mnem}, {mode})")
    return bytes([op] + obytes)
