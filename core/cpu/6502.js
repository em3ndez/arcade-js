// SPDX-License-Identifier: GPL-3.0-only
/**
 * MOS 6502 (NMOS) register file + ALU/flag helpers — the CPU layer for the Atari Centipede
 * board. MIRRORS core/cpu/8080.js's SHAPE and call surface: this is NOT an emulator. There is
 * no fetch/decode loop, no opcode dispatch, and no memory here; decompiled ROM routines are
 * plain JS that CALL these helpers, and step()/tick()/cycles, addressing, push/pull/stack, and
 * the RESET/IRQ/NMI vectors all live in the per-game Machine and the board's AddressSpace.
 *
 * FLAGS (P byte, bit7..0): N V - B D I Z C. Bit5 (U) has no flip-flop and reads 1; B (bit4) is
 * likewise not a stored flag — it only appears set in a status byte PUSHED by PHP/BRK (clear
 * when pushed by IRQ/NMI, which the Machine masks). So P is stored as the six real flags and the
 * `p` getter forces U and B set (the PHP/read-back form), the way 8080.js's `af` forces its
 * fixed bits; the setter (PLP/RTI/clone) ignores B and U.
 *
 * ★ VERIFY-VS-MAME (m6502) later — flagged inline: the NMOS decimal-mode N/V/Z quirks for adc,
 * and that sbc's N/V/Z/C come from the BINARY subtraction in decimal mode. The values here are
 * the documented-NMOS first draft; the boot-first equivalence gate pins them.
 */

export const F_C = 0x01; // carry
export const F_Z = 0x02; // zero
export const F_I = 0x04; // IRQ disable
export const F_D = 0x08; // decimal mode
export const F_B = 0x10; // break — only set in a PUSHED status byte, not a real flag
export const F_U = 0x20; // unused — reads as 1
export const F_V = 0x40; // overflow
export const F_N = 0x80; // negative

// REG_FIELDS: the diffable register bytes (equivalence.js firstRegDiff / Machine.clone read this).
// No pc -- control flow is JS, not a program counter (as in z80/8080). This is our internal
// JS-vs-JS convention; it need not match MAME's register names.
export const REG_FIELDS = ["a", "x", "y", "p", "s"];

export class Regs {
  /**
   * Power-on defaults; the Machine overwrites reset state after `new Regs()` (as the board's
   * reset does on hardware). S is the 8-bit stack pointer (page 1 lives at the Machine layer);
   * I starts set. A/X/Y are indeterminate on real silicon — zeroed here for a defined start.
   */
  constructor() {
    this.a = 0;
    this.x = 0;
    this.y = 0;
    this.s = 0xfd;
    this._p = F_I; // raw flag bits; only the six real flags are meaningful
  }

  /** Overwrite every REG_FIELD from another Regs. Returns this. */
  copyFrom(other) {
    for (const k of REG_FIELDS) this[k] = other[k];
    return this;
  }

  /** P as a byte: the six real flags with U and B forced set (PHP / read-back form). */
  get p() {
    return (this._p | F_U | F_B) & 0xff;
  }
  set p(v) {
    this._p = v & 0xff; // B and U are ignored on read-back; storing them is harmless
  }

  // ---- flag accessors + branch predicates (the idiomatic flag-out bridge) ----------------
  get fC() { return (this._p & F_C) !== 0; }
  set fC(v) { this._p = v ? this._p | F_C : this._p & ~F_C; }
  get fZ() { return (this._p & F_Z) !== 0; }
  set fZ(v) { this._p = v ? this._p | F_Z : this._p & ~F_Z; }
  get fI() { return (this._p & F_I) !== 0; }
  set fI(v) { this._p = v ? this._p | F_I : this._p & ~F_I; }
  get fD() { return (this._p & F_D) !== 0; }
  set fD(v) { this._p = v ? this._p | F_D : this._p & ~F_D; }
  get fV() { return (this._p & F_V) !== 0; }
  set fV(v) { this._p = v ? this._p | F_V : this._p & ~F_V; }
  get fN() { return (this._p & F_N) !== 0; }
  set fN(v) { this._p = v ? this._p | F_N : this._p & ~F_N; }
  get fNZ() { return (this._p & F_Z) === 0; }
  get fNC() { return (this._p & F_C) === 0; }
  get fPl() { return (this._p & F_N) === 0; } // N clear -> plus
  get fNV() { return (this._p & F_V) === 0; }

  // ---- flag setters (CLC/SEC/CLI/SEI/CLD/SED/CLV) ---------------------------------------
  clc() { this.fC = false; }
  sec() { this.fC = true; }
  cli() { this.fI = false; }
  sei() { this.fI = true; }
  cld() { this.fD = false; }
  sed() { this.fD = true; }
  clv() { this.fV = false; }

  /** N and Z from a value (LDA/LDX/LDY/TAX/TAY/TXA/TYA/TSX and every result below). */
  setNZ(v) {
    v &= 0xff;
    this.fZ = v === 0;
    this.fN = (v & 0x80) !== 0;
  }

  // ---- add/subtract into A (ADC/SBC), binary + NMOS decimal -----------------------------
  /**
   * ADC — A += v + C. Binary sets N V Z C the usual way. Decimal (D set) is the NMOS BCD add:
   * the accumulator is nibble-corrected, Z is taken from the BINARY sum, and N and V from the
   * high-nibble sum BEFORE the +0x60 correction (the documented NMOS quirk). ★ verify vs MAME.
   */
  adc(v) {
    const a = this.a;
    const c = this.fC ? 1 : 0;
    if (this.fD) {
      let al = (a & 0x0f) + (v & 0x0f) + c;
      if (al > 9) al = ((al + 6) & 0x0f) + 0x10;
      let sum = (a & 0xf0) + (v & 0xf0) + al;
      this.fN = (sum & 0x80) !== 0;
      this.fV = (~(a ^ v) & (a ^ sum) & 0x80) !== 0;
      this.fZ = ((a + v + c) & 0xff) === 0;
      if (sum >= 0xa0) sum += 0x60;
      this.fC = sum >= 0x100;
      this.a = sum & 0xff;
    } else {
      const sum = a + v + c;
      const res = sum & 0xff;
      this.fC = sum > 0xff;
      this.fV = (~(a ^ v) & (a ^ res) & 0x80) !== 0;
      this.a = res;
      this.setNZ(res);
    }
  }

  /**
   * SBC — A -= v + (1-C). On the NMOS 6502 the flags N V Z C are ALWAYS the binary-subtraction
   * result, even in decimal mode; only the accumulator VALUE is BCD-corrected there. ★ verify.
   */
  sbc(v) {
    const a = this.a;
    const c = this.fC ? 1 : 0;
    const diff = a - v - (1 - c);
    const res = diff & 0xff;
    this.fC = diff >= 0;
    this.fV = ((a ^ v) & (a ^ res) & 0x80) !== 0;
    this.setNZ(res);
    if (this.fD) {
      let al = (a & 0x0f) - (v & 0x0f) - (1 - c);
      if (al < 0) al = ((al - 6) & 0x0f) - 0x10;
      let sum = (a & 0xf0) - (v & 0xf0) + al;
      if (sum < 0) sum -= 0x60;
      this.a = sum & 0xff;
    } else {
      this.a = res;
    }
  }

  // ---- logical (AND/ORA/EOR) -- N,Z only ------------------------------------------------
  and(v) {
    this.a = (this.a & v) & 0xff;
    this.setNZ(this.a);
  }
  ora(v) {
    this.a = (this.a | v) & 0xff;
    this.setNZ(this.a);
  }
  eor(v) {
    this.a = (this.a ^ v) & 0xff;
    this.setNZ(this.a);
  }

  // ---- compares (CMP/CPX/CPY) -- N,Z,C; C = no borrow (reg >= v unsigned) ---------------
  cmp(v) { this._compare(this.a, v); }
  cpx(v) { this._compare(this.x, v); }
  cpy(v) { this._compare(this.y, v); }
  _compare(reg, v) {
    reg &= 0xff;
    v &= 0xff;
    this.fC = reg >= v;
    this.setNZ((reg - v) & 0xff);
  }

  /** BIT — Z from (A & v); N = bit7 of v; V = bit6 of v. A is unchanged. */
  bit(v) {
    this.fZ = (this.a & v) === 0;
    this.fN = (v & 0x80) !== 0;
    this.fV = (v & 0x40) !== 0;
  }

  // ---- INC/DEC (INC/DEC mem + INX/DEX/INY/DEY) -- N,Z only, carry untouched -------------
  inc8(v) {
    const r = (v + 1) & 0xff;
    this.setNZ(r);
    return r;
  }
  dec8(v) {
    const r = (v - 1) & 0xff;
    this.setNZ(r);
    return r;
  }

  // ---- shifts/rotates (ASL/LSR/ROL/ROR) -- take a value, return the result, set N,Z,C ---
  // The caller applies the result to A or to memory; carry is bit 7 (left) or bit 0 (right).
  asl(v) {
    this.fC = (v & 0x80) !== 0;
    const r = (v << 1) & 0xff;
    this.setNZ(r);
    return r;
  }
  lsr(v) {
    this.fC = (v & 0x01) !== 0;
    const r = (v >> 1) & 0xff;
    this.setNZ(r);
    return r;
  }
  rol(v) {
    const cin = this.fC ? 1 : 0;
    this.fC = (v & 0x80) !== 0;
    const r = ((v << 1) | cin) & 0xff;
    this.setNZ(r);
    return r;
  }
  ror(v) {
    const cin = this.fC ? 0x80 : 0;
    this.fC = (v & 0x01) !== 0;
    const r = ((v >> 1) | cin) & 0xff;
    this.setNZ(r);
    return r;
  }
}
