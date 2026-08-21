// SPDX-License-Identifier: GPL-3.0-only
/** Generic Z80 CPU-core tests: the Regs class and its ALU/flag/shift primitives. Run: node --test */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Regs, F_C, F_H, F_N, F_PV, F_S, F_Z } from "../z80.js";
import { Machine } from "../../../games/dkong/machine.js";

// ROM is copyright + absent on a public clone; guard the Machine-building tests.
const ROM_PATH = new URL("../../../games/dkong/rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const romTest = ROM_PRESENT
  ? test
  : (name, fn) => test(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

test("dec8 wraps 0x00 -> 0xFF and sets NZ (the 256-iteration loop)", () => {
  const r = new Regs();
  const res = r.dec8(0x00);
  assert.equal(res, 0xff);
  assert.ok(r.fNZ, "0x00 - 1 must not set Z");
  assert.equal(r.dec8(0x01), 0x00);
  assert.ok(r.fZ);
});

test("registers mask on assignment: 8-bit -> & 0xff, 16-bit -> & 0xffff", () => {
  const r = new Regs();
  for (const k of ["a", "f", "b", "c", "d", "e", "h", "l"]) {
    r[k] = 0x1a7;
    assert.equal(r[k], 0xa7, `${k} must keep only the low byte`);
  }
  r.ix = 0x1_2345;
  assert.equal(r.ix, 0x2345, "ix keeps only the low word");
  r.iy = 0x1_0000;
  assert.equal(r.iy, 0x0000, "iy 0x10000 -> 0");
  r.sp = 0x2_abcd;
  assert.equal(r.sp, 0xabcd, "sp keeps only the low word");
  r.hl = 0x1_2345;
  assert.equal(r.h, 0x23, "hl high byte");
  assert.equal(r.l, 0x45, "hl low byte");
  assert.equal(r.hl, 0x2345, "hl reads back the 16-bit value");
  const c = new Regs();
  c.copyFrom(r);
  assert.equal(c.a, r.a);
  assert.equal(c.ix, r.ix);
  assert.equal(c.hl, r.hl);
});

test("inc/dec do not disturb carry", () => {
  const r = new Regs();
  r.f |= F_C;
  r.inc8(0x7f);
  assert.ok(r.fC, "INC must leave carry alone");
  r.dec8(0x01);
  assert.ok(r.fC, "DEC must leave carry alone");
});

test("fC/fZ boolean setters toggle only their own bit (the idiomatic flag-out bridge)", () => {
  const r = new Regs();
  r.f = F_S | F_H; // unrelated flags that must survive a single-flag write
  r.fC = true;
  assert.ok(r.fC, "fC=true sets carry");
  r.fZ = true;
  assert.ok(r.fZ, "fZ=true sets zero");
  assert.equal(r.f & (F_S | F_H), F_S | F_H, "sibling flags preserved through the RMW");
  r.fC = false;
  assert.ok(r.fNC, "fC=false clears carry");
  assert.ok(r.fZ, "clearing carry leaves zero set");
  r.fZ = false;
  assert.ok(r.fNZ, "fZ=false clears zero");
  assert.equal(r.f & (F_S | F_H), F_S | F_H, "sibling flags still intact");
});

romTest("incMem8/decMem8 do the RMW AND set flags -- the (ix+d) flag-drop the helper exists for", () => {
  const m = new Machine(ROM);
  const { regs, mem } = m;

  regs.ix = 0x6900;
  mem.write8(0x691c, 0x01);
  const r0 = regs.decMem8(mem, (regs.ix + 0x1c) & 0xffff);
  assert.equal(r0, 0x00, "returns the decremented value");
  assert.equal(mem.read8(0x691c), 0x00, "memory written back");
  assert.ok(regs.fZ, "dec to 0 sets Z -- the flag a bare mask would drop (sub_32d6 jp nz reads it)");

  mem.write8(0x691c, 0x03);
  regs.decMem8(mem, 0x691c);
  assert.equal(mem.read8(0x691c), 0x02, "decremented");
  assert.ok(regs.fNZ, "dec to non-zero leaves NZ");

  regs.f |= F_C;
  mem.write8(0x691c, 0x05);
  regs.decMem8(mem, 0x691c);
  assert.ok(regs.fC, "decMem8 preserves carry");

  regs.hl = 0x6a00;
  mem.write8(0x6a00, 0xff);
  const r1 = regs.incMem8(mem, regs.hl);
  assert.equal(r1, 0x00, "0xFF + 1 wraps to 0x00");
  assert.equal(mem.read8(0x6a00), 0x00, "written back");
  assert.ok(regs.fZ, "inc wrap to 0 sets Z");
});

test("add wraps at 8 bits and sets carry", () => {
  const r = new Regs();
  r.a = 0xff;
  r.add(0x01);
  assert.equal(r.a, 0x00);
  assert.ok(r.fC);
  assert.ok(r.fZ);
});

test("daa corrects BCD after add (the score uses it)", () => {
  const r = new Regs();
  r.a = 0x09;
  r.add(0x01); // 0x0A, not valid BCD
  r.daa();
  assert.equal(r.a, 0x10, "9 + 1 in BCD is 0x10");

  r.a = 0x99;
  r.add(0x01);
  r.daa();
  assert.equal(r.a, 0x00, "99 + 1 in BCD wraps to 00");
  assert.ok(r.fC, "...with carry out");
});

test("cp sets flags without changing A", () => {
  const r = new Regs();
  r.a = 0x64;
  r.cp(0x64);
  assert.equal(r.a, 0x64);
  assert.ok(r.fZ);
  assert.ok(r.fNC);
  r.cp(0x65);
  assert.ok(r.fC, "0x64 < 0x65 must set carry");
});

test("16-bit register pairs alias their halves", () => {
  const r = new Regs();
  r.hl = 0x1234;
  assert.equal(r.h, 0x12);
  assert.equal(r.l, 0x34);
  r.l = 0xff;
  assert.equal(r.hl, 0x12ff);
});

test("bit n,r sets Z/H, preserves carry, and does not change the operand", () => {
  const r = new Regs();
  r.f = F_C;
  assert.equal(r.bit(6, 0x40), true);
  assert.ok(r.fNZ, "bit set -> Z clear");
  assert.ok(r.fC, "carry preserved");
  assert.equal(r.bit(4, 0x00), false);
  assert.ok(r.fZ, "bit clear -> Z set");
  assert.ok(r.fC, "carry still preserved");
});

test("neg is 0 - A with Z80 flags, including the 0x80 overflow case", () => {
  const r = new Regs();
  for (const [a, want] of [[0x00, 0x00], [0x01, 0xff], [0x80, 0x80], [0xff, 0x01]]) {
    r.a = a;
    r.neg();
    assert.equal(r.a, want, `neg(0x${a.toString(16)})`);
    assert.equal(r.fC, a !== 0, "carry is set iff A was non-zero");
    assert.equal(r.fZ, a === 0, "zero iff A was zero");
  }
  // PV is signed overflow; 0x80 is the only value with it: -(-128) is unrepresentable in 8 bits.
  r.a = 0x80; r.neg();
  assert.ok(r.fPE, "neg(0x80) must set PV");
  r.a = 0x01; r.neg();
  assert.ok(!r.fPE, "neg(0x01) must not");
});

test("rl r sets the full flag set; H and N are CLEARED, not left stale", () => {
  // Z80 RL r: S,Z from the result; H=0; PV=parity; N=0; C=bit 7 of the input.
  const r = new Regs();

  // Pre-load F all-set so a stale-flag bug is visible, not masked by a zero start.
  r.f = 0xff;
  const out = r.rl(0x01); // carry-in was 1 (F=0xff), so 0x01 -> 0x03
  assert.equal(out, 0x03);
  assert.ok(!(r.f & F_H), "H must be cleared");
  assert.ok(!(r.f & F_N), "N must be cleared");
  assert.ok(!r.fC, "bit 7 of 0x01 is 0, so carry out is 0");

  r.f = 0;
  assert.equal(r.rl(0x80), 0x00, "0x80 with no carry-in rotates to 0");
  assert.ok(r.fC, "bit 7 of 0x80 is 1");
  assert.ok(r.fZ, "result is zero");
  assert.ok(r.fPE, "0x00 has even parity");

  r.f = 0;
  assert.equal(r.rl(0x40), 0x80);
  assert.ok(!r.fC);
  assert.ok(r.fM, "0x80 is negative");

  // Contrast that motivates the split: `rla` PRESERVES S/Z/PV.
  r.f = F_Z | F_S | F_PV;
  r.a = 0x01;
  r.rla();
  assert.ok(r.fZ && r.fM && r.fPE, "rla must preserve S, Z and PV");
});

test("daa matches MAME 0.288 exhaustively -- including the N=1 branch, which has never executed", () => {
  // Exhaustive vs a port of MAME 0.288 daa (z80.cpp:309 + flag accessors), NOT from z80.js.
  // Exercises the N=1 branch (daa after `sub`), which the translation has never run.
  const mameDaa = (A, n, h, c) => {
    let a = A;
    if (n) {
      if (h || (A & 0xf) > 9) a = (a - 6) & 0xff;
      if (c || A > 0x99) a = (a - 0x60) & 0xff;
    } else {
      if (h || (A & 0xf) > 9) a = (a + 6) & 0xff;
      if (c || A > 0x99) a = (a + 0x60) & 0xff;
    }
    let pv = a;
    pv ^= pv >> 4;
    pv ^= (pv << 2) & 0xff;
    pv ^= pv >> 1;
    return {
      a,
      S: (a & 0x80) !== 0,
      Z: a === 0,
      H: ((A ^ a) & 0x10) !== 0,
      PV: (~pv & 0x04) !== 0,
      N: !!n,
      C: !!(c || A > 0x99),
    };
  };

  let n1 = 0;
  for (let A = 0; A < 256; A++) {
    for (let fb = 0; fb < 8; fb++) {
      const n = fb & 1, h = (fb >> 1) & 1, c = (fb >> 2) & 1;
      if (n) n1++;
      const r = new Regs();
      r.a = A;
      r.f = (n ? F_N : 0) | (h ? F_H : 0) | (c ? F_C : 0);
      r.daa();
      const want = mameDaa(A, n, h, c);
      const got = {
        a: r.a, S: !!(r.f & F_S), Z: !!(r.f & F_Z), H: !!(r.f & F_H),
        PV: !!(r.f & F_PV), N: !!(r.f & F_N), C: !!(r.f & F_C),
      };
      assert.deepEqual(
        got, want,
        `daa A=0x${A.toString(16)} N=${n} H=${h} C=${c}`,
      );
    }
  }
  assert.equal(n1, 1024, "half the cases must exercise the N=1 branch");
});

test("CB shifts rlc/sla/sra/srl/rr match MAME 0.288 exhaustively, all 256 x carry", () => {
  // Exhaustive vs a port of MAME 0.288 (sla/sra/srl/rr) + flag accessors, NOT from z80.js.
  // sra preserves bit7 where srl clears it; rr feeds old carry into bit7 where srl feeds 0.
  const yx = (r) => r & 0x28;
  const par = (r) => { let p = r ^ (r >> 4); p ^= p >> 2; p ^= p >> 1; return p & 1 ? 0 : F_PV; };
  const flags = (r, c) => (r & 0x80 ? F_S : 0) | (r === 0 ? F_Z : 0) | par(r) | yx(r) | (c ? F_C : 0);

  const ops = {
    rlc: (v) => { const r = ((v << 1) | (v >> 7)) & 0xff; return { r, f: flags(r, v & 0x80) }; },
    sla: (v) => { const r = (v << 1) & 0xff; return { r, f: flags(r, v & 0x80) }; },
    sra: (v) => { const r = ((v >> 1) | (v & 0x80)) & 0xff; return { r, f: flags(r, v & 1) }; },
    srl: (v) => { const r = (v >> 1) & 0xff; return { r, f: flags(r, v & 1) }; },
    rr: (v, cin) => { const r = ((v >> 1) | (cin ? 0x80 : 0)) & 0xff; return { r, f: flags(r, v & 1) }; },
  };

  for (const [name, want] of Object.entries(ops)) {
    for (let v = 0; v < 256; v++) {
      for (const cin of [0, 1]) {
        const regs = new Regs();
        regs.f = cin ? F_C : 0;
        const got = regs[name](v);
        const exp = want(v, cin);
        assert.equal(got, exp.r, `${name}(0x${v.toString(16)}) cin=${cin} value`);
        assert.equal(regs.f & F_H, 0, `${name} clears H`);
        assert.equal(regs.f & F_N, 0, `${name} clears N`);
        assert.equal(regs.f, exp.f, `${name}(0x${v.toString(16)}) cin=${cin} flags`);
      }
    }
  }
});

test("bit n,r and bit n,(ix+d) differ ONLY in the F3/F5 source -- both pinned vs MAME", () => {
  // bit n,r takes F3/F5 from the operand; bit n,(ix+d) from the EA high byte. Everything else
  // identical (Z/PV=!bit, H=1, N=0, C preserved, S=bit7 for n=7). Expected values from MAME, not z80.js.
  const expect = (n, value, yxFrom, cIn) => {
    const set = (value & (1 << n)) !== 0;
    return (
      (cIn ? F_C : 0) |
      F_H |
      (set ? 0 : F_Z | F_PV) |
      (n === 7 && set ? F_S : 0) |
      (yxFrom & 0x28)
    );
  };

  for (let value = 0; value < 256; value++) {
    for (let n = 0; n < 8; n++) {
      for (const cIn of [0, 1]) {
        let r = new Regs();
        r.f = cIn ? F_C : 0;
        const gotR = r.bit(n, value);
        assert.equal(gotR, (value & (1 << n)) !== 0, `bit ${n},r=0x${value.toString(16)} result`);
        assert.equal(r.f, expect(n, value, value, cIn), `bit ${n},r=0x${value.toString(16)} cin=${cIn} flags`);
        assert.equal(r.f & F_H, F_H, "bit sets H");
        assert.equal(r.f & F_N, 0, "bit clears N");

        const addrHi = value ^ 0x28;
        r = new Regs();
        r.f = cIn ? F_C : 0;
        const gotX = r.bit(n, value, addrHi);
        assert.equal(gotX, (value & (1 << n)) !== 0, `bit ${n},(ix+d) result`);
        assert.equal(r.f, expect(n, value, addrHi, cIn), `bit ${n},(ix+d) v=0x${value.toString(16)} cin=${cIn} flags`);
      }
    }
  }
});

test("adc/sbc carry-in path matches MAME 0.288 exhaustively -- the branch that has never run", () => {
  // add(v,carryIn)/sub(v,carryIn) have only ever run with carryIn=0; sub_239c's adc/sbc change that.
  // Exhaustive sweep (256 A x 256 v x carry-in) vs a port of MAME adc_a/sbc_a, NOT from z80.js.
  const yx = (r) => r & 0x28;
  const par = (r) => { let p = r ^ (r >> 4); p ^= p >> 2; p ^= p >> 1; return p & 1 ? 0 : F_PV; };

  const mameAdc = (A, v, c) => {
    const res = A + v + c;
    const r = res & 0xff;
    return (r & 0x80 ? F_S : 0) | (r === 0 ? F_Z : 0) | yx(r) |
      (res & 0x100 ? F_C : 0) |
      (((A & 0x0f) + (v & 0x0f) + c) & 0x10 ? F_H : 0) |
      (~(A ^ v) & (A ^ r) & 0x80 ? F_PV : 0);
  };
  const mameSbc = (A, v, c) => {
    const res = A - v - c;
    const r = res & 0xff;
    return (r & 0x80 ? F_S : 0) | (r === 0 ? F_Z : 0) | yx(r) | F_N |
      (res & 0x100 ? F_C : 0) |
      (((A & 0x0f) - (v & 0x0f) - c) & 0x10 ? F_H : 0) |
      ((A ^ v) & (A ^ r) & 0x80 ? F_PV : 0);
  };

  let sawC1 = 0;
  for (let A = 0; A < 256; A++) {
    for (let v = 0; v < 256; v++) {
      for (const c of [0, 1]) {
        if (c) sawC1++;
        let regs = new Regs();
        regs.a = A;
        regs.f = c ? F_C : 0;
        regs.adc(v);
        assert.equal(regs.a, (A + v + c) & 0xff, `adc a=${A} v=${v} c=${c} result`);
        assert.equal(regs.f, mameAdc(A, v, c), `adc a=${A} v=${v} c=${c} flags`);
        regs = new Regs();
        regs.a = A;
        regs.f = c ? F_C : 0;
        regs.sbc(v);
        assert.equal(regs.a, (A - v - c) & 0xff, `sbc a=${A} v=${v} c=${c} result`);
        assert.equal(regs.f, mameSbc(A, v, c), `sbc a=${A} v=${v} c=${c} flags`);
      }
    }
  }
  assert.equal(sawC1, 65536, "half the cases must exercise carry-in = 1");
});

test("res n,r and set n,r modify one bit and LEAVE ALL FLAGS UNCHANGED -- vs MAME", () => {
  // The flag-PRESERVATION is the load-bearing property (checked across every starting flag word);
  // values checked vs MAME's formula, never vs z80.js.
  const F_ALL = F_S | F_Z | F_H | F_PV | F_N | F_C | 0x28;
  for (let value = 0; value < 256; value++) {
    for (let n = 0; n < 8; n++) {
      for (const fIn of [0x00, 0xff, F_ALL, F_C, F_Z | F_S, F_H | F_N, 0x28]) {
        let r = new Regs();
        r.f = fIn;
        const gotRes = r.res(n, value);
        assert.equal(gotRes, value & ~(1 << n) & 0xff, `res ${n},0x${value.toString(16)} value`);
        assert.equal(r.f, fIn, `res ${n} must not touch flags (in=0x${fIn.toString(16)})`);

        r = new Regs();
        r.f = fIn;
        const gotSet = r.set(n, value);
        assert.equal(gotSet, (value | (1 << n)) & 0xff, `set ${n},0x${value.toString(16)} value`);
        assert.equal(r.f, fIn, `set ${n} must not touch flags (in=0x${fIn.toString(16)})`);
      }
    }
  }
});

test("adc hl,rr sets S/Z/PV that add hl,rr preserves -- pinned vs MAME 0.288 adc_hl", () => {
  // adc hl,rr SETS S/Z/PV that add hl,rr preserves; sub_342c uses it as a 16-bit zero-test.
  const r = new Regs();

  r.hl = 0x0000; r.f = 0;
  r.adcHl(0x0000);
  assert.equal(r.hl, 0x0000, "0 + 0 + 0 = 0");
  assert.ok(r.fZ, "Z SET on a zero 16-bit result -- the branch sub_342c reads");
  assert.ok(!r.fC, "no carry out");

  r.hl = 0x3a8c; r.f = 0;
  r.adcHl(0x0000);
  assert.equal(r.hl, 0x3a8c, "non-zero HL unchanged by +0");
  assert.ok(r.fNZ, "Z CLEAR on a non-zero result");

  r.hl = 0x0000; r.f = F_C;
  r.adcHl(0x0000);
  assert.equal(r.hl, 0x0001, "carry-in is added");
  assert.ok(r.fNZ, "and the result is no longer zero");

  r.hl = 0x7fff; r.f = 0;
  r.adcHl(0x0001);
  assert.equal(r.hl, 0x8000);
  assert.ok(r.fM, "S set from bit 15 (fM is the sign getter)");
  assert.ok(r.fPE, "PV set -- 0x7FFF + 1 overflows a signed 16-bit (fPE = parity/overflow set)");

  r.hl = 0xffff; r.f = 0;
  r.adcHl(0x0001);
  assert.equal(r.hl, 0x0000, "wraps to 0");
  assert.ok(r.fC, "carry OUT of bit 15");
  assert.ok(r.fZ, "and Z set on the zero result");

  r.hl = 0x0fff; r.f = 0;
  r.adcHl(0x0001);
  assert.equal(r.hl, 0x1000);
  assert.ok(r.f & F_H, "H set by the carry out of bit 11");

  assert.ok(!(r.f & F_N), "N cleared");
});

test("sbcHl is NOT a sign-flipped adcHl -- it SETS N and uses a different overflow term", () => {
  const r = new Regs();

  r.hl = 0x0000; r.f = 0; r.sbcHl(0x0000);
  assert.equal(r.hl, 0x0000);
  assert.ok(r.f & F_Z, "0-0 = 0 sets Z");
  assert.ok(r.f & F_N, "SBC SETS N -- the single most likely thing copied wrong from adcHl");
  assert.ok(!(r.f & F_C), "no borrow");

  r.hl = 0x0000; r.f = 0; r.sbcHl(0x0001);
  assert.equal(r.hl, 0xffff, "0-1 wraps");
  assert.ok(r.f & F_C, "borrow out");
  assert.ok(r.f & F_S, "S set from bit 15");

  r.hl = 0x0002; r.f = F_C; r.sbcHl(0x0001);
  assert.equal(r.hl, 0x0000, "carry-in participates: 2-1-1 = 0");
  assert.ok(r.f & F_Z);

  r.hl = 0x8000; r.f = 0; r.sbcHl(0x0001);
  assert.equal(r.hl, 0x7fff);
  assert.ok(r.f & F_PV, "PV on signed overflow (different-sign operands)");

  r.hl = 0x7fff; r.f = 0; r.sbcHl(0x0001);
  assert.ok(!(r.f & F_PV), "no PV when operands share a sign");
  // MUTATION-PATCH  file: core/cpu/z80.js
  //   find: ((hl ^ v) & (hl ^ res) & 0x8000 ? F_PV : 0) |\n      F_N |
  //   repl: ((hl ^ v) & (hl ^ res) & 0x8000 ? F_PV : 0) |
  //   expect: FAIL  (drops N -- caught by "SBC SETS N"); anchor count == 1
});

romTest("cpi PRESERVES carry, takes S/Z raw and F3/F5 from an H-ADJUSTED result", () => {
  // NOTE: 0x4000 is UNMAPPED and throws here -- these cases run in work RAM (0x6A00).
  const m = new Machine(ROM);
  const r = m.regs, mem = m.mem;

  mem.write8(0x6a00, 0x42);
  r.hl = 0x6a00; r.bc = 0x0002; r.a = 0x42; r.f = F_C;
  r.cpi(mem);
  assert.ok(r.f & F_C, "cpi KEEPS carry (z80.lst:467) -- a compare must not eat the caller's C");
  assert.ok(r.f & F_Z, "match sets Z");
  assert.ok(r.f & F_N, "N set");
  assert.equal(r.hl, 0x6a01, "HL advanced");
  assert.equal(r.bc, 0x0001, "BC decremented");
  assert.ok(r.f & F_PV, "PV set while BC != 0");

  r.hl = 0x6a00; r.bc = 0x0001; r.a = 0x00; r.f = 0; r.cpi(mem);
  assert.ok(!(r.f & F_PV), "PV clears exactly when BC hits 0");

  mem.write8(0x6a00, 0x11); mem.write8(0x6a01, 0x22); mem.write8(0x6a02, 0x33);
  r.hl = 0x6a00; r.bc = 0x0010; r.a = 0x33; r.f = 0;
  assert.equal(r.cpir(mem), 3, "cpir returns 3, stopping on the match");
  assert.equal(r.bc, 0x000d, "BC left past the match");
  assert.equal(r.hl, 0x6a03, "HL left past the match");

  r.hl = 0x6a00; r.bc = 0x0003; r.a = 0xff; r.f = 0;
  assert.equal(r.cpir(mem), 3, "exhausts BC");
  assert.equal(r.bc, 0, "BC drained");
  assert.ok(!(r.f & F_PV), "PV clear at exhaustion");
});

test("addIy writes IY and shares addIx's verified add16 path (destination is the hazard)", () => {
  const r = new Regs();
  r.iy = 0x1000; r.ix = 0x9999; r.f = 0; r.addIy(0x0234);
  assert.equal(r.iy, 0x1234, "addIy writes IY");
  assert.equal(r.ix, 0x9999, "and leaves IX untouched -- the copy hazard");

  r.iy = 0xffff; r.f = F_S | F_Z | F_PV | F_N; r.addIy(0x0001);
  assert.equal(r.iy, 0x0000);
  assert.ok(r.f & F_C, "carry-out on wrap");
  assert.ok((r.f & F_S) && (r.f & F_Z) && (r.f & F_PV), "PRESERVES S,Z,PV (add16 'keep szv')");
  assert.ok(!(r.f & F_N), "clears N");

  r.iy = 0x2000; r.f = 0; r.addIy(r.iy);
  assert.equal(r.iy, 0x4000, "add iy,iy doubles");
  // MUTATION-PATCH  file: core/cpu/z80.js
  //   find: this.iy = this.add16(this.iy, v);
  //   repl: this.ix = this.add16(this.iy, v);
  //   expect: FAIL  (destination swap -- 4 assertions)
});

test("ld a,i: A <- I; S/Z from A, PV <- IFF2, H/N cleared, carry preserved", () => {
  const r = new Regs();
  r.i = 0x00; r.iff2 = 0; r.f = F_C;
  r.ldAI();
  assert.equal(r.a, 0x00, "A <- I");
  assert.ok(r.f & F_Z, "Z set (A==0)");
  assert.ok(!(r.f & F_S), "S clear");
  assert.ok(!(r.f & F_PV), "PV = IFF2 = 0");
  assert.ok(r.f & F_C, "carry preserved");
  assert.ok(!(r.f & (F_H | F_N)), "H and N cleared");

  r.i = 0x80; r.iff2 = 1; r.f = 0;
  r.ldAI();
  assert.equal(r.a, 0x80, "A <- I (0x80)");
  assert.ok(r.f & F_S, "S set (bit7)");
  assert.ok(!(r.f & F_Z), "Z clear");
  assert.ok(r.f & F_PV, "PV = IFF2 = 1");
  assert.ok(!(r.f & F_C), "carry still clear");
  // MUTATION-PATCH  file: core/cpu/z80.js
  //   find: (this.iff2 ? F_PV : 0)
  //   repl: 0
  //   expect: FAIL  (PV would never reflect IFF2 -- the second-block PV assertion)
});

test("the I register is part of REG_FIELDS -- copyFrom (clone) round-trips it", () => {
  const r = new Regs();
  r.i = 0x2a;
  const c = new Regs();
  c.copyFrom(r);
  assert.equal(c.i, 0x2a, "clone carries I (else loc_0bb3's loop-scratch would be dropped)");
});
