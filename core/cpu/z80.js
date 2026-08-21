// SPDX-License-Identifier: GPL-3.0-only
/**
 * Z80 register file and ALU semantics. NOT an emulator: no fetch-decode loop --
 * translated routines are plain JS, and the flag rules the ROM branches on are
 * modelled once here. Registers are shared state (values carry across calls).
 */

export const F_C = 0x01;
export const F_N = 0x02;
export const F_PV = 0x04;
export const F_F3 = 0x08;
export const F_H = 0x10;
export const F_F5 = 0x20;
export const F_Z = 0x40;
export const F_S = 0x80;

function parity8(v) {
  let p = v ^ (v >> 4);
  p ^= p >> 2;
  p ^= p >> 1;
  return p & 1 ? 0 : F_PV;
}

function sz8(v) {
  return (v & 0x80 ? F_S : 0) | (v === 0 ? F_Z : 0) | (v & (F_F3 | F_F5));
}

/** The CPU's own state list (primitive fields only); copyFrom and the register diff read it. */
export const REG_FIELDS = [
  "a", "f", "b", "c", "d", "e", "h", "l", "ix", "iy", "sp", "i",
  "a_", "f_", "b_", "c_", "d_", "e_", "h_", "l_",
];

export class Regs {
  /**
   * Power-on register state, MEASURED from MAME at t=0 (control read ROM[0x0000]=0x3E):
   *   AF = 0x0040   BC = DE = HL = 0x0000
   *   IX = IY = 0xFFFF          SP = 0x0000
   *   AF' BC' DE' HL' = 0x0000  I = R = IM = 0
   * Only IX/IY are 0xFFFF (MAME's convention; set in device_start, NOT device_reset, so a
   * mid-run watchdog reset does not restore them). AF = 0x0040 is Z set. Not a blanket 0xFFFF.
   */
  constructor() {
    this.a = 0x00;
    this.f = 0x40;
    this.b = 0;
    this.c = 0;
    this.d = 0;
    this.e = 0;
    this.h = 0;
    this.l = 0;
    this.ix = 0xffff;
    this.iy = 0xffff;
    this.sp = 0;
    this.a_ = 0;
    this.f_ = 0;
    this.b_ = 0;
    this.c_ = 0;
    this.d_ = 0;
    this.e_ = 0;
    this.h_ = 0;
    this.l_ = 0;
    // I (interrupt-vector reg) + IFF2 power on 0; only `ld a,i` reads them, not wired to EI/DI.
    this.i = 0;
    this.iff2 = 0;
  }

  /** Overwrite every REG_FIELD from another Regs (prototype accessors untouched). Returns this. */
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

  get af() {
    return (this.a << 8) | this.f;
  }
  set af(v) {
    this.a = (v >> 8) & 0xff;
    this.f = v & 0xff;
  }

  // Registers mask to their width on every write (backed by _-prefixed fields).
  get a() { return this._a; }   set a(v) { this._a = v & 0xff; }
  get f() { return this._f; }   set f(v) { this._f = v & 0xff; }
  get b() { return this._b; }   set b(v) { this._b = v & 0xff; }
  get c() { return this._c; }   set c(v) { this._c = v & 0xff; }
  get d() { return this._d; }   set d(v) { this._d = v & 0xff; }
  get e() { return this._e; }   set e(v) { this._e = v & 0xff; }
  get h() { return this._h; }   set h(v) { this._h = v & 0xff; }
  get l() { return this._l; }   set l(v) { this._l = v & 0xff; }
  get ix() { return this._ix; } set ix(v) { this._ix = v & 0xffff; }
  get iy() { return this._iy; } set iy(v) { this._iy = v & 0xffff; }
  get sp() { return this._sp; } set sp(v) { this._sp = v & 0xffff; }

  get fZ() {
    return (this.f & F_Z) !== 0;
  }
  set fZ(v) {
    this.f = v ? this.f | F_Z : this.f & ~F_Z;
  }
  get fNZ() {
    return (this.f & F_Z) === 0;
  }
  get fC() {
    return (this.f & F_C) !== 0;
  }
  set fC(v) {
    this.f = v ? this.f | F_C : this.f & ~F_C;
  }
  get fNC() {
    return (this.f & F_C) === 0;
  }
  get fM() {
    return (this.f & F_S) !== 0;
  }
  get fP() {
    return (this.f & F_S) === 0;
  }
  get fPE() {
    return (this.f & F_PV) !== 0;
  }
  get fPO() {
    return (this.f & F_PV) === 0;
  }

  exAf() {
    let t = this.a;
    this.a = this.a_;
    this.a_ = t;
    t = this.f;
    this.f = this.f_;
    this.f_ = t;
  }

  exx() {
    let t;
    t = this.b; this.b = this.b_; this.b_ = t;
    t = this.c; this.c = this.c_; this.c_ = t;
    t = this.d; this.d = this.d_; this.d_ = t;
    t = this.e; this.e = this.e_; this.e_ = t;
    t = this.h; this.h = this.h_; this.h_ = t;
    t = this.l; this.l = this.l_; this.l_ = t;
  }

  exDeHl() {
    const t = this.de;
    this.de = this.hl;
    this.hl = t;
  }

  /** LD A,I -- A <- I; S/Z from A, PV <- IFF2, H/N cleared, C preserved (the one op exposing IFF2). */
  ldAI() {
    this.a = this.i;
    this.f = (this.f & F_C) | sz8(this.a) | (this.iff2 ? F_PV : 0);
  }

  /** DJNZ -- decrement B (8-bit wrap), write back and return it. Affects NO FLAGS (why it is not dec8). */
  djnz() {
    this.b = (this.b - 1) & 0xff;
    return this.b;
  }

  add(v, carryIn = 0) {
    const a = this.a;
    const r = a + v + carryIn;
    const res = r & 0xff;
    this.f =
      sz8(res) |
      (r > 0xff ? F_C : 0) |
      (((a ^ v ^ res) & 0x10) ? F_H : 0) |
      ((~(a ^ v) & (a ^ res) & 0x80) ? F_PV : 0);
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
      F_N |
      (r < 0 ? F_C : 0) |
      (((a ^ v ^ res) & 0x10) ? F_H : 0) |
      (((a ^ v) & (a ^ res) & 0x80) ? F_PV : 0);
    this.a = res;
  }

  sbc(v) {
    this.sub(v, this.f & F_C ? 1 : 0);
  }

  /** CP -- SUB discarding the result. F3/F5 come from the OPERAND, not the result. */
  cp(v) {
    const a = this.a;
    const r = a - v;
    const res = r & 0xff;
    this.f =
      (res & 0x80 ? F_S : 0) |
      (res === 0 ? F_Z : 0) |
      (v & (F_F3 | F_F5)) |
      F_N |
      (r < 0 ? F_C : 0) |
      (((a ^ v ^ res) & 0x10) ? F_H : 0) |
      (((a ^ v) & (a ^ res) & 0x80) ? F_PV : 0);
  }

  and(v) {
    this.a = (this.a & v) & 0xff;
    this.f = sz8(this.a) | F_H | parity8(this.a);
  }

  or(v) {
    this.a = (this.a | v) & 0xff;
    this.f = sz8(this.a) | parity8(this.a);
  }

  xor(v) {
    this.a = (this.a ^ v) & 0xff;
    this.f = sz8(this.a) | parity8(this.a);
  }

  /** INC r -- note it does NOT affect carry. */
  inc8(v) {
    const res = (v + 1) & 0xff;
    this.f =
      (this.f & F_C) |
      sz8(res) |
      ((res & 0x0f) === 0 ? F_H : 0) |
      (res === 0x80 ? F_PV : 0);
    return res;
  }

  /** DEC r -- also leaves carry alone. */
  dec8(v) {
    const res = (v - 1) & 0xff;
    this.f =
      (this.f & F_C) |
      sz8(res) |
      F_N |
      ((res & 0x0f) === 0x0f ? F_H : 0) |
      (res === 0x7f ? F_PV : 0);
    return res;
  }

  /** INC/DEC (addr) RMW: read, apply the inc8/dec8 flags (carry preserved), write back, return it. */
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

  /** BIT n,r -- Z=!bit, PV=Z, H=1, N=0, C preserved; does NOT change the operand. S=bit7 only for n=7.
   *  yxFrom supplies the undocumented F3/F5 (default = operand; pass the EA high byte for the indexed form). */
  bit(n, value, yxFrom = value) {
    const set = (value & (1 << n)) !== 0;
    this.f =
      (this.f & F_C) |
      F_H |
      (set ? 0 : F_Z | F_PV) |
      (n === 7 && set ? F_S : 0) |
      (yxFrom & (F_F3 | F_F5));
    return set;
  }

  /** RES/SET n,r -- CB. Clear/set bit n and return it. BOTH LEAVE EVERY FLAG UNCHANGED. */
  res(n, value) {
    return value & ~(1 << n) & 0xff;
  }

  set(n, value) {
    return (value | (1 << n)) & 0xff;
  }

  /** ADD rr,rr -- shared by ADD HL/IX/IY. Affects only H,N,C; S,Z,PV preserved. Returns the 16-bit result. */
  add16(cur, v) {
    const r = cur + v;
    this.f =
      (this.f & (F_S | F_Z | F_PV)) |
      (r > 0xffff ? F_C : 0) |
      (((cur ^ v ^ (r & 0xffff)) & 0x1000) ? F_H : 0) |
      ((r >> 8) & (F_F3 | F_F5));
    return r & 0xffff;
  }

  addHl(v) {
    this.hl = this.add16(this.hl, v);
  }

  /** ADC HL,rr -- unlike `add hl,rr` this SETS S,Z,PV (used as a 16-bit zero-test). N=0.
   *  Overflow term is the same-signed-operands rule; F3/F5 from the result high byte. */
  adcHl(v) {
    const hl = this.hl;
    const r = hl + v + (this.f & F_C ? 1 : 0);
    const res = r & 0xffff;
    this.f =
      (res & 0x8000 ? F_S : 0) |
      (res === 0 ? F_Z : 0) |
      (((hl ^ res ^ v) >> 8) & F_H) |
      (((hl ^ res) & (v ^ res) & 0x8000) ? F_PV : 0) |
      (r > 0xffff ? F_C : 0) |
      ((res >> 8) & (F_F3 | F_F5));
    this.hl = res;
  }

  /** SBC HL,rr -- NOT a sign-flipped adcHl: it SETS N, and overflow uses DIFFERENT-sign operands.
   *  F3/F5 from the result high byte. */
  sbcHl(v) {
    const hl = this.hl;
    const r = hl - v - (this.f & F_C ? 1 : 0);
    const res = r & 0xffff;
    this.f =
      (res & 0x8000 ? F_S : 0) |
      (res === 0 ? F_Z : 0) |
      (((hl ^ res ^ v) >> 8) & F_H) |
      ((hl ^ v) & (hl ^ res) & 0x8000 ? F_PV : 0) |
      F_N |
      (r < 0 ? F_C : 0) |
      ((res >> 8) & (F_F3 | F_F5));
    this.hl = res;
  }

  /** CPI -- compare A,(HL); HL++, BC--. C PRESERVED; S/Z from the unadjusted result; F3/F5 from
   *  the H-adjusted result; PV = BC!=0 after the decrement; N=1. Returns the raw (unadjusted) result. */
  cpi(mem) {
    const a = this.a;
    const v = mem.read8(this.hl);
    const res = (a - v) & 0xff;
    const h = (a ^ v ^ res) & F_H;
    this.hl = (this.hl + 1) & 0xffff;
    this.bc = (this.bc - 1) & 0xffff;
    const yx = h ? (res - 1) & 0xff : res;
    this.f =
      (this.f & F_C) |
      (res & 0x80 ? F_S : 0) |
      (res === 0 ? F_Z : 0) |
      h |
      (this.bc !== 0 ? F_PV : 0) |
      F_N |
      (((yx << 4) | (yx & 0x0f)) & (F_F3 | F_F5));
    return res;
  }

  /** CPIR -- repeat CPI until BC==0 or A==(HL). BC=0 on entry means 65536 iterations (BC-- wraps
   *  before the test). Returns the iteration count (>=1). */
  cpir(mem) {
    let n = 0;
    for (;;) {
      const res = this.cpi(mem);
      n++;
      if (this.bc === 0 || res === 0) return n;
    }
  }

  addIx(v) {
    this.ix = this.add16(this.ix, v);
  }

  /** ADD IY,rr -- delegates to the shared add16 (so its flags cannot drift from addIx); only the
   *  destination register differs. */
  addIy(v) {
    this.iy = this.add16(this.iy, v);
  }

  rlca() {
    const c = (this.a >> 7) & 1;
    this.a = ((this.a << 1) | c) & 0xff;
    this.f = (this.f & (F_S | F_Z | F_PV)) | c | (this.a & (F_F3 | F_F5));
  }

  rrca() {
    const c = this.a & 1;
    this.a = ((this.a >> 1) | (c << 7)) & 0xff;
    this.f = (this.f & (F_S | F_Z | F_PV)) | c | (this.a & (F_F3 | F_F5));
  }

  rla() {
    const c = (this.a >> 7) & 1;
    this.a = ((this.a << 1) | (this.f & F_C ? 1 : 0)) & 0xff;
    this.f = (this.f & (F_S | F_Z | F_PV)) | c | (this.a & (F_F3 | F_F5));
  }

  rra() {
    const c = this.a & 1;
    this.a = ((this.a >> 1) | (this.f & F_C ? 0x80 : 0)) & 0xff;
    this.f = (this.f & (F_S | F_Z | F_PV)) | c | (this.a & (F_F3 | F_F5));
  }

  /** RL r (CB) -- rotate left through carry; sets the FULL flag set (S,Z,PV,H=0,N=0), unlike `rla`
   *  which preserves S/Z/PV. Returns the rotated value. */
  rl(v) {
    const c = (v >> 7) & 1;
    const r = ((v << 1) | (this.f & F_C ? 1 : 0)) & 0xff;
    this.f = sz8(r) | parity8(r) | c;
    return r;
  }

  /** RLC r (CB) -- rotate left circular; bit7 wraps to bit0 AND carry. Full flag set (unlike `rlca`).
   *  Returns the rotated value. */
  rlc(v) {
    const c = (v >> 7) & 1;
    const r = ((v << 1) | (v >> 7)) & 0xff;
    this.f = sz8(r) | parity8(r) | c;
    return r;
  }

  /** RR r (CB) -- rotate right through carry; full flag set (unlike `rra`). Returns the rotated value. */
  rr(v) {
    const c = v & 1;
    const r = ((v >> 1) | (this.f & F_C ? 0x80 : 0)) & 0xff;
    this.f = sz8(r) | parity8(r) | c;
    return r;
  }

  /** SLA r (CB) -- shift left, 0 into bit0, bit7 to carry; full flag set. Returns the shifted value. */
  sla(v) {
    const c = (v >> 7) & 1;
    const r = (v << 1) & 0xff;
    this.f = sz8(r) | parity8(r) | c;
    return r;
  }

  /** SRA r (CB) -- arithmetic shift right; bit0 to carry, bit7 PRESERVED (unlike srl). Returns the value. */
  sra(v) {
    const c = v & 1;
    const r = ((v >> 1) | (v & 0x80)) & 0xff;
    this.f = sz8(r) | parity8(r) | c;
    return r;
  }

  /** SRL r (CB) -- logical shift right; bit0 to carry, 0 into bit7 (unlike sra). Returns the value. */
  srl(v) {
    const c = v & 1;
    const r = (v >> 1) & 0xff;
    this.f = sz8(r) | parity8(r) | c;
    return r;
  }

  /** NEG -- A = 0 - A, as a subtract from zero so the flags fall out. */
  neg() {
    const a = this.a;
    this.a = 0;
    this.sub(a);
  }

  cpl() {
    this.a = ~this.a & 0xff;
    this.f = (this.f & (F_S | F_Z | F_PV | F_C)) | F_H | F_N | (this.a & (F_F3 | F_F5));
  }

  scf() {
    this.f = (this.f & (F_S | F_Z | F_PV)) | F_C | (this.a & (F_F3 | F_F5));
  }

  ccf() {
    const c = this.f & F_C;
    this.f =
      (this.f & (F_S | F_Z | F_PV)) |
      (c ? F_H : 0) |
      (c ? 0 : F_C) |
      (this.a & (F_F3 | F_F5));
  }

  /** DAA -- BCD correction after add/subtract; depends on H and N, not just A's nibbles. */
  daa() {
    let correction = 0;
    let carry = this.f & F_C ? 1 : 0;
    const a = this.a;

    if (this.f & F_H || (a & 0x0f) > 9) correction |= 0x06;
    if (carry || a > 0x99) {
      correction |= 0x60;
      carry = 1;
    }

    const res = this.f & F_N ? (a - correction) & 0xff : (a + correction) & 0xff;

    this.f =
      sz8(res) |
      parity8(res) |
      (this.f & F_N) |
      (carry ? F_C : 0) |
      ((this.f & F_N
        ? (this.f & F_H) && (a & 0x0f) < 6
        : (a & 0x0f) > 9)
        ? F_H
        : 0);
    this.a = res;
  }
}
