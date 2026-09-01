// Intel 8080 ALU + register-file model, the CPU layer for Midway/Taito 8080 games
// (Space Invaders). MIRRORS core/cpu/z80.js's SHAPE and call surface -- the pipeline has
// no bytecode interpreter; the ROM is decompiled to JS whose routines CALL these helpers,
// and correctness is driven boot-first by the whole-machine state diff vs MAME (runbook §2).
//
// 8080 vs Z80 (why this is not just z80.js):
//   - FLAGS: 8080 PSW = S Z 0 AC 0 P 1 C. The parity flag P is ALWAYS parity (never the
//     Z80 overflow); there is NO N flag; bit1 always reads 1, bits 3 & 5 always read 0.
//     AC is the aux-carry (Z80's H). No undocumented F3/F5.
//   - No IX/IY, no shadow set (only XCHG = ex de,hl), no CB/DD/ED/FD ops, no block ops,
//     no djnz/neg. So the Z80-only helpers are dropped.
//   - Interrupts (EI/DI -> INTE, and the bus-supplied RST on accept) live in the machine/
//     board seam, not here (as with z80.js's NMI seam).
//
// ★ VERIFY-VS-MAME (i8080 core) at first boot -- the subtle points, flagged inline below:
//   reset flag byte, the ANA/ANI aux-carry quirk, DAA, and AC on subtract. The boot-first
//   equivalence gate is what pins these; the values here are the documented-8080 first draft.

export const F_C = 0x01; // carry
export const F_P = 0x04; // parity (EVEN parity -> set)
export const F_AC = 0x10; // auxiliary carry (half-carry, bit 3 -> 4)
export const F_Z = 0x40; // zero
export const F_S = 0x80; // sign (bit 7 of result)

// Bits that always read 1 (bit1) / 0 (bits 3,5) in the 8080 flag byte.
const F_ALWAYS1 = 0x02;

// REG_FIELDS: the diffable register bytes (equivalence.js imports this to compare vs MAME).
// No pc -- control flow is JS, not a program counter (as in z80.js). No ix/iy/shadow/i.
export const REG_FIELDS = ["a", "f", "b", "c", "d", "e", "h", "l", "sp"];

function parity8(v) {
  // even parity of the low 8 bits -> F_P
  let p = v & 0xff;
  p ^= p >> 4;
  p ^= p >> 2;
  p ^= p >> 1;
  return p & 1 ? 0 : F_P;
}

function sz8(v) {
  // S from bit7, Z from zero. (8080 has no F3/F5.)
  return (v & 0x80 ? F_S : 0) | (v === 0 ? F_Z : 0);
}

export class Regs {
  /**
   * Power-on register state, pinned vs MAME i8080: device_start sets AF=0 and device_reset never
   * touches it (i8085.cpp), so the RAW reset flag byte is 0x00 -- the always-1 bit1 is applied only
   * when the PSW is PUSHed (the `af` getter / `case 0xf5`), not in the working register. All regs 0;
   * SP is 0 until the ROM's LXI SP.
   */
  constructor() {
    this.a = 0x00;
    this.f = 0x00;
    this.b = 0;
    this.c = 0;
    this.d = 0;
    this.e = 0;
    this.h = 0;
    this.l = 0;
    this.sp = 0;
  }

  /** Overwrite every REG_FIELD from another Regs. Returns this. */
  copyFrom(other) {
    for (const k of REG_FIELDS) this[k] = other[k];
    return this;
  }

  get bc() {
    return (this.b << 8) | this.c;
  }
  set bc(v) {
    this.b = (v >> 8) & 0xff;
    this.c = v & 0xff;
  }
  get de() {
    return (this.d << 8) | this.e;
  }
  set de(v) {
    this.d = (v >> 8) & 0xff;
    this.e = v & 0xff;
  }
  get hl() {
    return (this.h << 8) | this.l;
  }
  set hl(v) {
    this.h = (v >> 8) & 0xff;
    this.l = v & 0xff;
  }
  /** PSW = A in the high byte, flags in the low byte (PUSH/POP PSW). Reads with the fixed
   *  bits forced (bit1=1, bits3&5=0) so a POP PSW then PUSH PSW round-trips like the 8080. */
  get af() {
    return (this.a << 8) | ((this.f & 0xd5) | F_ALWAYS1);
  }
  set af(v) {
    this.a = (v >> 8) & 0xff;
    this.f = (v & 0xd5) | F_ALWAYS1;
  }

  // ---- condition flags (JZ/JNZ/JC/JNC/JPE/JPO/JP/JM and the C./R. variants) ------------
  // 8080 CC order matches i8080_decode.CC = nz z nc c po pe p m. P is ALWAYS parity here.
  get fZ() { return (this.f & F_Z) !== 0; }
  set fZ(v) { this.f = v ? this.f | F_Z : this.f & ~F_Z; }
  get fNZ() { return (this.f & F_Z) === 0; }
  get fC() { return (this.f & F_C) !== 0; }
  set fC(v) { this.f = v ? this.f | F_C : this.f & ~F_C; }
  get fNC() { return (this.f & F_C) === 0; }
  get fM() { return (this.f & F_S) !== 0; }   // sign set -> minus
  get fP() { return (this.f & F_S) === 0; }   // sign clear -> plus
  get fPE() { return (this.f & F_P) !== 0; }  // parity even
  get fPO() { return (this.f & F_P) === 0; }  // parity odd

  /** XCHG -- exchange DE and HL. */
  exDeHl() {
    let t = this.d; this.d = this.h; this.h = t;
    t = this.e; this.e = this.l; this.l = t;
  }

  // ---- 8-bit arithmetic into A (ADD/ADC/SUB/SBB/CMP) -----------------------------------
  add(v, carryIn = 0) {
    const a = this.a;
    const r = a + v + carryIn;
    const res = r & 0xff;
    this.f =
      sz8(res) |
      parity8(res) |
      (r > 0xff ? F_C : 0) |
      (((a ^ v ^ res) & 0x10) ? F_AC : 0);
    this.a = res;
  }
  adc(v) {
    this.add(v, this.f & F_C ? 1 : 0);
  }
  sub(v, carryIn = 0) {
    const a = this.a;
    const r = a - v - carryIn;
    const res = r & 0xff;
    this.f =
      sz8(res) |
      parity8(res) |
      (r < 0 ? F_C : 0) |
      // AC on subtract = the INVERTED half-borrow ~(a^r^v)&0x10, per MAME i8085.cpp op_sub.
      ((~(a ^ v ^ r) & 0x10) ? F_AC : 0);
    this.a = res;
  }
  sbc(v) {
    this.sub(v, this.f & F_C ? 1 : 0);
  }
  /** CMP -- SUB discarding the result (flags only). */
  cp(v) {
    const a = this.a;
    const r = a - v;
    const res = r & 0xff;
    this.f =
      sz8(res) |
      parity8(res) |
      (r < 0 ? F_C : 0) |
      ((~(a ^ v ^ r) & 0x10) ? F_AC : 0); // inverted half-borrow, per MAME op_cmp
  }

  // ---- logical (ANA/ORA/XRA) -----------------------------------------------------------
  and(v) {
    // 8080 ANA: CY cleared; AC set to the OR of bit 3 of the two operands (the 8080 quirk;
    // the 8085 sets AC unconditionally). ★ verify vs MAME i8080.
    const ac = ((this.a | v) & 0x08) ? F_AC : 0;
    this.a = this.a & v & 0xff;
    this.f = sz8(this.a) | parity8(this.a) | ac;
  }
  or(v) {
    // ORA: CY and AC cleared.
    this.a = (this.a | v) & 0xff;
    this.f = sz8(this.a) | parity8(this.a);
  }
  xor(v) {
    // XRA: CY and AC cleared.
    this.a = (this.a ^ v) & 0xff;
    this.f = sz8(this.a) | parity8(this.a);
  }

  // ---- INR/DCR (do NOT affect carry) ---------------------------------------------------
  inc8(v) {
    const res = (v + 1) & 0xff;
    this.f =
      (this.f & F_C) |
      sz8(res) |
      parity8(res) |
      ((res & 0x0f) === 0 ? F_AC : 0);
    return res;
  }
  dec8(v) {
    const res = (v - 1) & 0xff;
    this.f =
      (this.f & F_C) |
      sz8(res) |
      parity8(res) |
      // INR/DCR AC: on DCR the aux flag is set when there is NO borrow from bit 4,
      // i.e. low nibble was not 0x0. ★ verify vs MAME.
      ((res & 0x0f) === 0x0f ? 0 : F_AC);
    return res;
  }
  incMem8(mem, addr, busOffset) {
    const v = this.inc8(mem.read8(addr));
    mem.write8(addr, v, busOffset);
    return v;
  }
  decMem8(mem, addr, busOffset) {
    const v = this.dec8(mem.read8(addr));
    mem.write8(addr, v, busOffset);
    return v;
  }

  // ---- DAD rr -- 16-bit add into HL, affects ONLY carry --------------------------------
  add16(cur, v) {
    const r = cur + v;
    this.f = (this.f & ~F_C) | (r > 0xffff ? F_C : 0);
    return r & 0xffff;
  }
  addHl(v) {
    this.hl = this.add16(this.hl, v);
  }

  // ---- rotates (RLC/RRC/RAL/RAR) -- affect ONLY carry ---------------------------------
  rlca() {
    const c = (this.a >> 7) & 1;
    this.a = ((this.a << 1) | c) & 0xff;
    this.f = (this.f & ~F_C) | (c ? F_C : 0);
  }
  rrca() {
    const c = this.a & 1;
    this.a = ((this.a >> 1) | (c << 7)) & 0xff;
    this.f = (this.f & ~F_C) | (c ? F_C : 0);
  }
  rla() {
    const cin = this.f & F_C ? 1 : 0;
    const c = (this.a >> 7) & 1;
    this.a = ((this.a << 1) | cin) & 0xff;
    this.f = (this.f & ~F_C) | (c ? F_C : 0);
  }
  rra() {
    const cin = this.f & F_C ? 1 : 0;
    const c = this.a & 1;
    this.a = ((this.a >> 1) | (cin << 7)) & 0xff;
    this.f = (this.f & ~F_C) | (c ? F_C : 0);
  }

  // ---- CMA / STC / CMC / DAA ----------------------------------------------------------
  cpl() {
    // CMA -- complement A; affects no flags.
    this.a = ~this.a & 0xff;
  }
  scf() {
    // STC -- set carry; other flags unchanged.
    this.f |= F_C;
  }
  ccf() {
    // CMC -- complement carry; other flags unchanged.
    this.f ^= F_C;
  }
  /** DAA -- decimal adjust after ADD (8080 has no N flag; assumes prior addition).
   *  ★ verify the exact AC/CY rules vs MAME i8080. */
  daa() {
    let a = this.a;
    let add = 0;
    let carry = this.f & F_C ? F_C : 0;
    if ((this.f & F_AC) || (a & 0x0f) > 9) add |= 0x06;
    if (carry || a > 0x99) {
      add |= 0x60;
      carry = F_C;
    }
    const ac = ((a & 0x0f) + (add & 0x0f)) > 0x0f ? F_AC : 0;
    a = (a + add) & 0xff;
    this.a = a;
    this.f = sz8(a) | parity8(a) | ac | carry;
  }
}
