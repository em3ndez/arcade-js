// SPDX-License-Identifier: GPL-3.0-only
// Atari MATHBOX (Tempest 3D-tube math coprocessor). A byte-exact port of MAME 0.288 src/mame/atari/
// mathbox.cpp. ★ MAME does NOT emulate the AM2900 microsequencer and does NOT use the user2/user3 PROMs --
// it is a straight-line C reimplementation of what the microcode computes (Eric Smith RE'd the PROMs into
// C), so this port ignores the PROMs entirely and replicates the arithmetic. Everything is int16 (two's-
// complement, wrap mod 2^16) and INSTANTANEOUS (status always "done"). The CPU loads operands into the 16
// scratch registers via load opcodes, issues a compute opcode, then reads the 16-bit result.
// Interface (tempest.cpp:502-506): go_w(offset&0x1f, data) @0x6080-609F; status_r @0x6040 (bit7 busy=0);
// lo_r @0x6060; hi_r @0x6070. Spec: scratchpad/tempest/spec_mathbox.md. Line refs are mathbox.cpp.

const s16 = (v) => (v << 16) >> 16; // truncate + sign-extend to int16

export class Mathbox {
  constructor() {
    this.reg = new Int16Array(16); // R0..Rf scratch registers
    this.result = 0; // int16 result read back by the CPU
  }
  statusR() { return 0x00; } // always done (bit7 busy = 0)
  loR() { return this.result & 0xff; }
  hiR() { return (this.result >> 8) & 0xff; }

  goW(offset, data) {
    const r = this.reg;
    offset &= 0x1f;
    data &= 0xff;
    const setResult = (v) => { this.result = s16(v); };

    // Load opcodes (§3.1): set a register half (or whole for R6), copy full reg to result.
    switch (offset) {
      case 0x00: r[0] = s16((r[0] & 0xff00) | data); return setResult(r[0]);
      case 0x01: r[0] = s16((r[0] & 0x00ff) | (data << 8)); return setResult(r[0]);
      case 0x02: r[1] = s16((r[1] & 0xff00) | data); return setResult(r[1]);
      case 0x03: r[1] = s16((r[1] & 0x00ff) | (data << 8)); return setResult(r[1]);
      case 0x04: r[2] = s16((r[2] & 0xff00) | data); return setResult(r[2]);
      case 0x05: r[2] = s16((r[2] & 0x00ff) | (data << 8)); return setResult(r[2]);
      case 0x06: r[3] = s16((r[3] & 0xff00) | data); return setResult(r[3]);
      case 0x07: r[3] = s16((r[3] & 0x00ff) | (data << 8)); return setResult(r[3]);
      case 0x08: r[4] = s16((r[4] & 0xff00) | data); return setResult(r[4]);
      case 0x09: r[4] = s16((r[4] & 0x00ff) | (data << 8)); return setResult(r[4]);
      case 0x0a: r[5] = s16((r[5] & 0xff00) | data); return setResult(r[5]);
      case 0x0c: r[6] = s16(data); return setResult(r[6]); // whole reg = data (0..255): divide/loop step count
      case 0x0d: r[0xa] = s16((r[0xa] & 0xff00) | data); return setResult(r[0xa]);
      case 0x0e: r[0xa] = s16((r[0xa] & 0x00ff) | (data << 8)); return setResult(r[0xa]);
      case 0x0f: r[0xb] = s16((r[0xb] & 0xff00) | data); return setResult(r[0xb]);
      case 0x10: r[0xb] = s16((r[0xb] & 0x00ff) | (data << 8)); return setResult(r[0xb]);
      case 0x15: r[7] = s16((r[7] & 0xff00) | data); return setResult(r[7]);
      case 0x16: r[7] = s16((r[7] & 0x00ff) | (data << 8)); return setResult(r[7]);
      case 0x1a: r[8] = s16((r[8] & 0xff00) | data); return setResult(r[8]);
      case 0x1b: r[8] = s16((r[8] & 0x00ff) | (data << 8)); return setResult(r[8]);
      // Read-back opcodes (§3.2): note the 0x18->R9, 0x19->R8 ordering.
      case 0x17: return setResult(r[7]);
      case 0x18: return setResult(r[9]);
      case 0x19: return setResult(r[8]);
    }

    // Compute opcodes. Rf (R15) controls the transform chain run-length: -1 stop after step_048, 0 run through.
    if (offset === 0x0b) {
      r[5] = s16((r[5] & 0x00ff) | (data << 8));
      r[0xf] = -1;
      r[4] = s16(r[4] - r[2]);
      r[5] = s16(r[5] - r[3]);
      return this._step048();
    }
    if (offset === 0x11) {
      r[5] = s16((r[5] & 0x00ff) | (data << 8));
      r[0xf] = 0;
      return this._step048();
    }
    if (offset === 0x12) return this._step12();
    if (offset === 0x13) { r[0xc] = r[9]; return this._divide(r[8], r[9]); } // {R8:R9}/R7
    if (offset === 0x14) return this._divide(r[0xb], r[0xa]); // {Rb:Ra}/R7
    if (offset === 0x1c) return this._clip(data);
    if (offset === 0x1d) {
      r[3] = s16((r[3] & 0x00ff) | (data << 8));
      r[2] = s16(r[2] - r[0]); if (r[2] < 0) r[2] = s16(-r[2]);
      r[3] = s16(r[3] - r[1]); if (r[3] < 0) r[3] = s16(-r[3]);
      return this._dist();
    }
    if (offset === 0x1e) return this._dist();
    // 0x1f: unimplemented (log only) -> no state change. No default: unlisted offsets leave state unchanged.
  }

  // step_048 (§3.3): first matrix row + round. On Rf<0 stops (result=R7); else adds translation, falls to 0x12.
  _step048() {
    const r = this.reg;
    let t = Math.imul(r[0], r[4]);
    r[0xc] = s16(t >> 16);
    r[0xe] = s16(t & 0xffff);
    t = Math.imul(-r[1], r[5]);
    r[7] = s16(t >> 16);
    let mbq = s16(t & 0xffff);
    r[7] = s16(r[7] + r[0xc]);
    r[0xe] = (r[0xe] >> 1) & 0x7fff;
    r[0xc] = (mbq >> 1) & 0x7fff;
    mbq = s16(r[0xc] + r[0xe]);
    if (mbq < 0) r[7] = s16(r[7] + 1);
    this.result = r[7];
    if (r[0xf] < 0) return; // 0x0b path: stop
    r[7] = s16(r[7] + r[2]);
    return this._step12();
  }

  // case 0x12 (§3.3): second matrix row + round; then ->0x13 unless Rf<0.
  _step12() {
    const r = this.reg;
    let t = Math.imul(r[1], r[4]);
    r[0xc] = s16(t >> 16);
    r[9] = s16(t & 0xffff);
    t = Math.imul(r[0], r[5]);
    r[8] = s16(t >> 16);
    let mbq = s16(t & 0xffff);
    r[8] = s16(r[8] + r[0xc]);
    r[9] = (r[9] >> 1) & 0x7fff;
    r[0xc] = (mbq >> 1) & 0x7fff;
    r[9] = s16(r[9] + r[0xc]);
    if (r[9] < 0) r[8] = s16(r[8] + 1);
    r[9] = s16(r[9] << 1);
    this.result = r[8];
    if (r[0xf] < 0) return;
    r[8] = s16(r[8] + r[3]);
    r[9] = s16(r[9] & 0xff00);
    // case 0x13: divide {R8:R9} by R7
    r[0xc] = r[9];
    return this._divide(r[8], r[9]);
  }

  // step_0bf (§3.4): restoring signed divide of {hi:lo} by |R7|, R6+1 iterations; quotient sign = sign(R7^hi).
  _divide(hi, lo) {
    const r = this.reg;
    let mbq = s16(hi);
    let Rd = s16(hi);
    const Re = s16(r[7] ^ mbq); // sign-of-result stash
    if (mbq >= 0) {
      mbq = s16(lo);
    } else {
      Rd = s16(-mbq - 1);
      mbq = s16(-lo - 1);
      if (mbq < 0 && s16(mbq + 1) < 0) Rd = s16(Rd + 1);
      mbq = s16(mbq + 1);
    }
    const Rc = r[7] >= 0 ? s16(r[7]) : s16(-r[7]); // abs(R7)
    let Rf = r[6];
    do {
      Rd = s16(Rd - Rc);
      const msb = (mbq & 0x8000) !== 0 ? 1 : 0;
      mbq = s16(mbq << 1);
      if (Rd >= 0) mbq = s16(mbq + 1);
      else Rd = s16(Rd + Rc);
      Rd = s16(Rd << 1);
      Rd = s16(Rd + msb);
    } while (--Rf >= 0);
    this.result = Re >= 0 ? s16(mbq) : s16(-mbq);
  }

  // case 0x1c (§3.5): window/clip binary search, R6+1 iters; mutates R6.
  _clip(data) {
    const r = this.reg;
    r[5] = s16((r[5] & 0x00ff) | (data << 8));
    do {
      const Re = s16((r[4] + r[7]) >> 1);
      const Rf = s16((r[5] + r[8]) >> 1);
      if (r[0xb] < Re && Rf < Re && (Re + Rf) >= 0) { r[7] = Re; r[8] = Rf; }
      else { r[4] = Re; r[5] = Rf; }
    } while (--r[6] >= 0);
    this.result = r[8];
  }

  // cases 0x1d/0x1e (§3.6): octagonal distance approx = max(R2,R3) + 3/8*min(R2,R3).
  _dist() {
    const r = this.reg;
    let Rc, Rd;
    if (r[3] >= r[2]) { Rc = s16(r[2]); Rd = s16(r[3]); }
    else { Rd = s16(r[2]); Rc = s16(r[3]); }
    Rc = s16(Rc >> 2); // min/4
    Rd = s16(Rd + Rc);
    Rc = s16(Rc >> 1); // min/8
    r[0xd] = s16(Rc + Rd);
    this.result = r[0xd];
  }

  clone() {
    const m = new Mathbox();
    m.reg.set(this.reg);
    m.result = this.result;
    return m;
  }
}
