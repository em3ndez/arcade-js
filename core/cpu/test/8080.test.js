// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for core/cpu/8080.js (the Intel 8080 ALU + register model). Flag expectations are
// derived from an INDEPENDENT reimplementation of MAME i8085.cpp's formulas (lut_zsp + op_add/op_sub/
// op_ana/op_inr/op_dcr/op_daa), not from 8080.js, and swept over many operands so a wrong flag rule
// cannot hide. Comparisons mask to the 8080-DEFINED bits (S Z AC P C = 0xd5): MAME's working register
// also carries VF (bit1) on subtract/DCR, but on the 8080 bit1 is a don't-care that PUSH PSW forces to
// 1 (case 0xf5) -- so it never affects a diffed byte and is excluded here.
//
// Run: node --test core/cpu/test/8080.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs, F_C, F_P, F_AC, F_Z, F_S } from "../8080.js";

const DEFINED = 0xd5; // S Z AC P C (drops KF bit5, X3 bit3, VF bit1)

// --- independent MAME reference (i8085.cpp) ------------------------------------------------
function lutZSP(x) {
  x &= 0xff;
  let f = (x & 0x80 ? F_S : 0) | (x === 0 ? F_Z : 0);
  let p = x; p ^= p >> 4; p ^= p >> 2; p ^= p >> 1;
  if (!(p & 1)) f |= F_P; // even parity -> PF
  return f;
}
const refAdd = (a, v, cin) => { const q = a + v + cin; return { res: q & 0xff, f: (lutZSP(q & 0xff) | ((q >> 8) & F_C) | ((a ^ q ^ v) & F_AC)) & DEFINED }; };
const refSub = (a, v, cin) => { const q = a - v - cin; return { res: q & 0xff, f: (lutZSP(q & 0xff) | ((q >> 8) & F_C) | (~(a ^ q ^ v) & F_AC)) & DEFINED }; };
const refAna = (a, v) => { const hc = ((a | v) << 1) & F_AC; const r = a & v; return { res: r, f: (lutZSP(r) | hc) & DEFINED }; };
const refLog = (r) => ({ res: r & 0xff, f: lutZSP(r & 0xff) & DEFINED });
const refInr = (v, oldf) => { const hc = ((v & 0x0f) === 0x0f) ? F_AC : 0; const r = (v + 1) & 0xff; return { res: r, f: ((oldf & F_C) | lutZSP(r) | hc) & DEFINED }; };
const refDcr = (v, oldf) => { const hc = ((v & 0x0f) !== 0x00) ? F_AC : 0; const r = (v - 1) & 0xff; return { res: r, f: ((oldf & F_C) | lutZSP(r) | hc) & DEFINED }; };

const SWEEP = [0x00, 0x01, 0x0f, 0x10, 0x7f, 0x80, 0x81, 0x99, 0x9a, 0xaa, 0xf0, 0xff];

test("add/adc: result + defined flags match MAME over the sweep", () => {
  for (const a of SWEEP) for (const v of SWEEP) for (const cin of [0, 1]) {
    const r = new Regs(); r.a = a; r.f = cin ? F_C : 0;
    if (cin) r.adc(v); else r.add(v);
    const ref = refAdd(a, v, cin);
    assert.equal(r.a, ref.res, `add a=${a} v=${v} c=${cin} result`);
    assert.equal(r.f & DEFINED, ref.f, `add a=${a} v=${v} c=${cin} flags`);
  }
});

test("sub/sbb/cp: result + flags match MAME (inverted half-borrow)", () => {
  for (const a of SWEEP) for (const v of SWEEP) for (const cin of [0, 1]) {
    const r = new Regs(); r.a = a; r.f = cin ? F_C : 0;
    if (cin) r.sbc(v); else r.sub(v);
    const ref = refSub(a, v, cin);
    assert.equal(r.a, ref.res, `sub a=${a} v=${v} c=${cin} result`);
    assert.equal(r.f & DEFINED, ref.f, `sub a=${a} v=${v} c=${cin} flags`);
    // cp = sub discarding the result (A unchanged), same flags for cin=0
    if (!cin) { const c = new Regs(); c.a = a; c.cp(v); assert.equal(c.a, a, "cp preserves A"); assert.equal(c.f & DEFINED, refSub(a, v, 0).f, `cp a=${a} v=${v} flags`); }
  }
});

test("sub AC = MAME inverted half-borrow (the fixed bug); the old non-inverted rule differed", () => {
  for (const [a, v] of [[0x10, 0x01], [0x20, 0x01], [0x00, 0x10], [0x12, 0x34], [0x9a, 0x0b]]) {
    const r = new Regs(); r.a = a; r.sub(v);
    assert.equal(r.f & F_AC, refSub(a, v, 0).f & F_AC, `sub 0x${a.toString(16)}-0x${v.toString(16)} AC matches MAME`);
  }
  // teeth: for a=0x10 v=0x01 the fixed (inverted) rule clears AC while the pre-fix rule set it.
  const a = 0x10, v = 0x01, q = a - v, res = q & 0xff;
  assert.equal(~(a ^ v ^ q) & 0x10, 0, "inverted rule (MAME/fixed) -> AC clear");
  assert.equal((a ^ v ^ res) & 0x10, 0x10, "non-inverted rule (pre-fix) -> AC set: the two genuinely differ");
});

test("ana (8080 aux-carry quirk), ora, xra match MAME", () => {
  for (const a of SWEEP) for (const v of SWEEP) {
    const ra = new Regs(); ra.a = a; ra.f = 0xff; ra.and(v);
    assert.equal(ra.a, a & v, `ana result a=${a} v=${v}`);
    assert.equal(ra.f & DEFINED, refAna(a, v).f, `ana flags a=${a} v=${v} (CY cleared, AC=bit3 of a|v)`);
    const ro = new Regs(); ro.a = a; ro.f = 0xff; ro.or(v);
    assert.equal(ro.f & DEFINED, refLog(a | v).f, `ora flags a=${a} v=${v} (CY,AC cleared)`);
    const rx = new Regs(); rx.a = a; rx.f = 0xff; rx.xor(v);
    assert.equal(rx.f & DEFINED, refLog(a ^ v).f, `xra flags a=${a} v=${v}`);
  }
});

test("inr/dcr: preserve CY, set S/Z/P/AC per MAME", () => {
  for (const v of SWEEP) for (const oldc of [0, F_C]) {
    const ri = new Regs(); ri.f = oldc; const gi = ri.inc8(v);
    assert.equal(gi, (v + 1) & 0xff); assert.equal(ri.f & DEFINED, refInr(v, oldc).f, `inr v=${v} c=${oldc}`);
    const rd = new Regs(); rd.f = oldc; const gd = rd.dec8(v);
    assert.equal(gd, (v - 1) & 0xff); assert.equal(rd.f & DEFINED, refDcr(v, oldc).f, `dcr v=${v} c=${oldc}`);
  }
});

test("rotates rlca/rrca/rla/rra affect ONLY carry", () => {
  const base = F_S | F_Z | F_P | F_AC; // non-carry flags must survive
  let r = new Regs(); r.a = 0x85; r.f = base; r.rlca();
  assert.equal(r.a, 0x0b, "rlca 0x85 -> 0x0b"); assert.equal(r.f, base | F_C, "bit7 -> CY, others kept");
  r = new Regs(); r.a = 0x85; r.f = base; r.rrca();
  assert.equal(r.a, 0xc2, "rrca 0x85 -> 0xc2"); assert.equal(r.f, base | F_C);
  r = new Regs(); r.a = 0x80; r.f = 0; r.rla(); assert.equal(r.a, 0x00); assert.equal(r.f & F_C, F_C, "rla no cy-in, bit7 out");
  r = new Regs(); r.a = 0x01; r.f = F_C; r.rra(); assert.equal(r.a, 0x80, "rra cy-in -> bit7"); assert.equal(r.f & F_C, F_C, "bit0 -> cy");
});

test("dad/add16 affects ONLY carry", () => {
  const r = new Regs(); r.f = F_Z | F_S; r.hl = 0x8000; r.addHl(0x8000);
  assert.equal(r.hl, 0x0000, "0x8000+0x8000 wraps"); assert.equal(r.f & F_C, F_C, "16-bit carry set");
  assert.equal(r.f & (F_Z | F_S), F_Z | F_S, "other flags untouched by DAD");
  const n = new Regs(); n.f = F_C; n.hl = 0x0102; n.addHl(0x0304);
  assert.equal(n.hl, 0x0406); assert.equal(n.f & F_C, 0, "no carry clears CY");
});

test("daa (BCD adjust) matches MAME cases", () => {
  const daa = (a, f) => { const r = new Regs(); r.a = a; r.f = f; r.daa(); return r; };
  let r = daa(0x0a, 0); assert.equal(r.a, 0x10, "0x0a -> +6 -> 0x10"); assert.equal(r.f & F_C, 0);
  r = daa(0x9a, 0); assert.equal(r.a, 0x00, "0x9a -> +0x66 -> 0x00 wrap"); assert.equal(r.f & F_C, F_C, "high adjust sets CY");
  r = daa(0x1f, 0); assert.equal(r.a, 0x25, "low nibble 0x0f>9 -> +6");
  r = daa(0x40, F_C); assert.equal(r.a, 0xa0, "CY-in -> +0x60"); assert.equal(r.f & F_C, F_C, "CY stays set");
  r = daa(0x42, 0); assert.equal(r.a, 0x42, "already BCD, no change"); assert.equal(r.f & F_C, 0);
});

test("cpl/scf/ccf", () => {
  let r = new Regs(); r.a = 0xa5; r.f = 0x00; r.cpl(); assert.equal(r.a, 0x5a, "CMA"); assert.equal(r.f, 0x00, "CMA no flags");
  r = new Regs(); r.f = F_Z; r.scf(); assert.equal(r.f & F_C, F_C, "STC"); assert.equal(r.f & F_Z, F_Z);
  r.ccf(); assert.equal(r.f & F_C, 0, "CMC toggles carry");
});

test("16-bit pairs + XCHG", () => {
  const r = new Regs();
  r.bc = 0x1234; assert.equal(r.b, 0x12); assert.equal(r.c, 0x34); assert.equal(r.bc, 0x1234);
  r.de = 0xabcd; r.hl = 0x5678; r.exDeHl();
  assert.equal(r.de, 0x5678, "XCHG swaps DE<->HL"); assert.equal(r.hl, 0xabcd);
});

test("af PSW: 8080 push forces bit1=1, clears bits 3 & 5 (case 0xf5); round-trips", () => {
  const r = new Regs(); r.a = 0x3c; r.f = 0x00; // raw f, no fixed bits
  assert.equal(r.af & 0xff, 0x02, "af low byte forces bit1=1");
  r.f = 0xff; // all bits including 3,5,1
  assert.equal(r.af & 0xff, (0xff & 0xd5) | 0x02, "af masks KF/X3, forces VF");
  const s = new Regs(); s.af = 0x9c1d; // POP PSW then read back
  assert.equal(s.a, 0x9c, "af setter loads A"); assert.equal(s.af & 0xff, (0x1d & 0xd5) | 0x02, "af setter normalizes flag bits");
});

test("condition accessors read S Z P C", () => {
  const r = new Regs();
  r.f = F_Z; assert.ok(r.fZ && !r.fNZ);
  r.f = 0; assert.ok(r.fNZ && !r.fZ);
  r.f = F_C; assert.ok(r.fC && !r.fNC);
  r.f = F_S; assert.ok(r.fM && !r.fP);
  r.f = 0; assert.ok(r.fP && !r.fM);
  r.f = F_P; assert.ok(r.fPE && !r.fPO); // P=parity even
  r.f = 0; assert.ok(r.fPO && !r.fPE);
});

test("reset defaults: all regs 0, raw F=0x00 (MAME i8080 device_start)", () => {
  const r = new Regs();
  for (const k of ["a", "f", "b", "c", "d", "e", "h", "l", "sp"]) assert.equal(r[k], 0, `${k}=0`);
});
