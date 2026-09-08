// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for core/cpu/6502.js (the MOS 6502 register + ALU model). Binary ADC/SBC
// flags are checked against an INDEPENDENT reference (unsigned carry + SIGNED-overflow V, a
// different derivation than the core's bit formula) swept over many operands. Decimal-mode
// results and carry are checked against hand-verified BCD vectors; the NMOS N/V/Z quirks are
// pinned by specific documented vectors, and SBC's "flags are the binary result even in decimal"
// property by comparing the decimal and binary runs directly.
//
// Run: node --test core/cpu/test/6502.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs, F_C, F_Z, F_I, F_D, F_B, F_U, F_V, F_N } from "../6502.js";

const s8 = (x) => (x & 0x80 ? x - 256 : x);
const flagsOf = (r) => ({ N: r.fN, V: r.fV, Z: r.fZ, C: r.fC });

function refAdc(a, v, c) {
  const raw = a + v + c;
  const res = raw & 0xff;
  const sv = s8(a) + s8(v) + c;
  return { res, C: raw > 0xff, V: sv < -128 || sv > 127, N: (res & 0x80) !== 0, Z: res === 0 };
}
function refSbc(a, v, c) {
  const raw = a - v - (1 - c);
  const res = raw & 0xff;
  const sv = s8(a) - s8(v) - (1 - c);
  return { res, C: raw >= 0, V: sv < -128 || sv > 127, N: (res & 0x80) !== 0, Z: res === 0 };
}

const SWEEP = [0x00, 0x01, 0x0f, 0x10, 0x7f, 0x80, 0x81, 0x99, 0x9a, 0xaa, 0xf0, 0xff];

test("adc (binary): result + N V Z C match the independent reference over the sweep", () => {
  for (const a of SWEEP) for (const v of SWEEP) for (const c of [0, 1]) {
    const r = new Regs();
    r.a = a;
    r.fC = !!c;
    r.adc(v);
    const ref = refAdc(a, v, c);
    assert.equal(r.a, ref.res, `adc a=${a} v=${v} c=${c} result`);
    assert.deepEqual(flagsOf(r), { N: ref.N, V: ref.V, Z: ref.Z, C: ref.C }, `adc a=${a} v=${v} c=${c} flags`);
  }
});

test("sbc (binary): result + N V Z C match the independent reference over the sweep", () => {
  for (const a of SWEEP) for (const v of SWEEP) for (const c of [0, 1]) {
    const r = new Regs();
    r.a = a;
    r.fC = !!c;
    r.sbc(v);
    const ref = refSbc(a, v, c);
    assert.equal(r.a, ref.res, `sbc a=${a} v=${v} c=${c} result`);
    assert.deepEqual(flagsOf(r), { N: ref.N, V: ref.V, Z: ref.Z, C: ref.C }, `sbc a=${a} v=${v} c=${c} flags`);
  }
});

test("adc overflow V — the classic datasheet corners", () => {
  const V = (a, v) => { const r = new Regs(); r.a = a; r.adc(v); return r.fV; };
  assert.equal(V(0x50, 0x10), false, "0x50+0x10 no overflow");
  assert.equal(V(0x50, 0x50), true, "0x50+0x50 = 0xA0 overflows (+,+ -> -)");
  assert.equal(V(0x7f, 0x01), true, "0x7F+0x01 overflows");
  assert.equal(V(0xd0, 0x90), true, "0xD0+0x90 overflows (-,- -> +)");
  assert.equal(V(0xd0, 0x10), false, "0xD0+0x10 no overflow");
  assert.equal(V(0xff, 0x01), false, "0xFF+0x01 = 0x00, no signed overflow");
});

test("adc (decimal): result + carry on hand-verified BCD vectors", () => {
  const cases = [
    [0x00, 0x00, 0, 0x00, 0], [0x05, 0x05, 0, 0x10, 0], [0x09, 0x01, 0, 0x10, 0],
    [0x50, 0x50, 0, 0x00, 1], [0x99, 0x01, 0, 0x00, 1], [0x99, 0x99, 1, 0x99, 1],
    [0x12, 0x34, 0, 0x46, 0], [0x58, 0x46, 1, 0x05, 1],
  ];
  for (const [a, v, c, res, carry] of cases) {
    const r = new Regs();
    r.sed();
    r.a = a;
    r.fC = !!c;
    r.adc(v);
    assert.equal(r.a, res, `bcd ${a.toString(16)}+${v.toString(16)}+${c} = ${res.toString(16)}`);
    assert.equal(r.fC, !!carry, `bcd ${a.toString(16)}+${v.toString(16)}+${c} carry`);
    assert.ok(r.fD, "decimal flag preserved by adc");
  }
});

test("adc (decimal): the NMOS N/V/Z quirk vectors", () => {
  // In decimal mode Z is the BINARY sum's zero, and N/V come from the high-nibble sum BEFORE the
  // +0x60 correction. These specific results are the documented NMOS behaviour.
  const run = (a, v, c) => { const r = new Regs(); r.sed(); r.a = a; r.fC = !!c; r.adc(v); return r; };
  let r = run(0x79, 0x00, 1);
  assert.equal(r.a, 0x80, "0x79+carry -> 0x80");
  assert.deepEqual(flagsOf(r), { N: true, V: true, Z: false, C: false }, "NMOS N=V=1 quirk");
  r = run(0x99, 0x01, 0);
  assert.equal(r.a, 0x00, "0x99+1 -> 0x00");
  assert.equal(r.fC, true, "carry out");
  assert.equal(r.fZ, false, "Z is 0 — from the BINARY sum 0x9A, not the 0x00 result");
});

test("sbc (decimal): result + carry on hand-verified BCD vectors (carry-in = no borrow)", () => {
  const cases = [
    [0x46, 0x12, 1, 0x34, 1], [0x40, 0x13, 1, 0x27, 1], [0x12, 0x21, 1, 0x91, 0],
    [0x00, 0x01, 1, 0x99, 0], [0x99, 0x99, 1, 0x00, 1], [0x50, 0x25, 1, 0x25, 1],
  ];
  for (const [a, v, c, res, carry] of cases) {
    const r = new Regs();
    r.sed();
    r.a = a;
    r.fC = !!c;
    r.sbc(v);
    assert.equal(r.a, res, `bcd ${a.toString(16)}-${v.toString(16)} = ${res.toString(16)}`);
    assert.equal(r.fC, !!carry, `bcd ${a.toString(16)}-${v.toString(16)} carry/borrow`);
  }
});

test("sbc: N V Z C are the BINARY result even in decimal mode (NMOS)", () => {
  for (const a of SWEEP) for (const v of SWEEP) for (const c of [0, 1]) {
    const bin = new Regs(); bin.a = a; bin.fC = !!c; bin.sbc(v);
    const dec = new Regs(); dec.sed(); dec.a = a; dec.fC = !!c; dec.sbc(v);
    assert.deepEqual(flagsOf(dec), flagsOf(bin), `sbc flags a=${a} v=${v} c=${c} must match binary`);
  }
});

test("cmp/cpx/cpy set N Z C (C = reg >= v, unsigned); the register is unchanged", () => {
  let r = new Regs();
  r.a = 0x50;
  r.cmp(0x50);
  assert.ok(r.fZ && r.fC && !r.fN, "equal -> Z=1, C=1, N=0");
  assert.equal(r.a, 0x50, "cmp preserves A");
  r.cmp(0x60);
  assert.ok(!r.fZ && !r.fC && r.fN, "0x50 < 0x60 -> C=0, N=1 (0x50-0x60=0xF0)");
  r.cmp(0x40);
  assert.ok(!r.fZ && r.fC && !r.fN, "0x50 > 0x40 -> C=1, N=0");

  r = new Regs();
  r.x = 0x00;
  r.cpx(0x01);
  assert.ok(!r.fC && r.fN, "0x00 - 0x01 borrows -> C=0, N=1");
  r.x = 0x80;
  r.cpx(0x01);
  assert.ok(r.fC && !r.fN, "0x80 >= 0x01 -> C=1; 0x80-0x01=0x7F has bit7=0 -> N=0");

  r = new Regs();
  r.y = 0xff;
  r.cpy(0xff);
  assert.ok(r.fZ && r.fC, "0xFF == 0xFF");
  assert.equal(r.y, 0xff, "cpy preserves Y");
});

test("and/ora/eor set N,Z only and leave C,V,I,D untouched", () => {
  const base = new Regs();
  base.p = F_C | F_V | F_I | F_D;
  let r = new Regs(); r.p = base.p; r.a = 0xf0; r.and(0x0f);
  assert.equal(r.a, 0x00);
  assert.ok(r.fZ && !r.fN, "AND to 0 -> Z");
  assert.equal(r.p & (F_C | F_V | F_I | F_D), F_C | F_V | F_I | F_D, "AND leaves C/V/I/D");

  r = new Regs(); r.a = 0xf0; r.ora(0x0f);
  assert.equal(r.a, 0xff);
  assert.ok(r.fN && !r.fZ, "ORA to 0xFF -> N");

  r = new Regs(); r.a = 0xff; r.eor(0xff);
  assert.equal(r.a, 0x00);
  assert.ok(r.fZ, "EOR self -> 0 -> Z");
  r.a = 0x80; r.eor(0x00);
  assert.ok(r.fN, "EOR keeps bit7 -> N");
});

test("bit: Z from (A & v); N = bit7 of v; V = bit6 of v; A unchanged", () => {
  let r = new Regs();
  r.a = 0xff;
  r.bit(0x40);
  assert.ok(!r.fZ && !r.fN && r.fV, "A&0x40 != 0 -> Z=0; bit7=0 -> N=0; bit6=1 -> V=1");
  assert.equal(r.a, 0xff, "bit does not change A");
  r.a = 0x0f;
  r.bit(0xc0);
  assert.ok(r.fZ && r.fN && r.fV, "A&0xC0 == 0 -> Z=1; N=bit7=1; V=bit6=1");
  r.a = 0x0f;
  r.bit(0x80);
  assert.ok(r.fZ && r.fN && !r.fV, "bit6=0 -> V=0");
});

test("inc8/dec8 set N,Z, wrap 8-bit, and DO NOT touch carry", () => {
  const r = new Regs();
  r.sec();
  assert.equal(r.inc8(0xff), 0x00, "0xFF + 1 wraps");
  assert.ok(r.fZ, "inc to 0 -> Z");
  assert.ok(r.fC, "inc must leave carry alone");
  assert.equal(r.dec8(0x00), 0xff, "0x00 - 1 wraps");
  assert.ok(r.fN, "dec to 0xFF -> N");
  assert.ok(r.fC, "dec must leave carry alone");
  assert.equal(r.dec8(0x01), 0x00);
  assert.ok(r.fZ, "dec to 0 -> Z");
});

test("asl/lsr/rol/ror: value + carry", () => {
  let r = new Regs();
  assert.equal(r.asl(0x80), 0x00, "ASL 0x80 -> 0x00");
  assert.ok(r.fC && r.fZ, "bit7 -> C, result 0 -> Z");
  assert.equal(r.asl(0x40), 0x80);
  assert.ok(!r.fC && r.fN, "no carry, 0x80 -> N");

  assert.equal(r.lsr(0x01), 0x00, "LSR 0x01 -> 0x00");
  assert.ok(r.fC && r.fZ, "bit0 -> C");
  assert.equal(r.lsr(0x80), 0x40);
  assert.ok(!r.fC && !r.fN, "LSR always clears bit7 -> N=0");

  r = new Regs();
  r.sec();
  assert.equal(r.rol(0x80), 0x01, "ROL 0x80 with carry-in -> 0x01");
  assert.ok(r.fC, "old bit7 -> C");
  r.clc();
  assert.equal(r.rol(0x40), 0x80);
  assert.ok(!r.fC && r.fN, "no carry-in, no carry-out, 0x80 -> N");

  r = new Regs();
  r.sec();
  assert.equal(r.ror(0x01), 0x80, "ROR 0x01 with carry-in -> 0x80");
  assert.ok(r.fC && r.fN, "old bit0 -> C, carry-in -> bit7 -> N");
  r.clc();
  assert.equal(r.ror(0x02), 0x01);
  assert.ok(!r.fC, "bit0=0 -> C=0");
});

test("p get/set: U(bit5) reads 1, B(bit4) reads 1 (PHP form); both ignored on set; flags round-trip", () => {
  const r = new Regs();
  r.p = 0x00;
  assert.equal(r.p, F_U | F_B, "empty flags still read U and B set");
  r.p = 0xff;
  assert.equal(r.p, 0xff, "all bits set reads back 0xFF");
  assert.ok(r.fN && r.fV && r.fD && r.fI && r.fZ && r.fC, "every real flag set");
  // setting only B/U leaves every real flag clear
  r.p = F_B | F_U;
  assert.ok(!r.fN && !r.fV && !r.fD && !r.fI && !r.fZ && !r.fC, "B/U carry no real flag");
  assert.equal(r.p, F_B | F_U, "reads back as just B|U");
  // real flags round-trip regardless of the B/U bits in the written byte
  r.p = F_N | F_C;
  assert.equal(r.p & ~(F_U | F_B), F_N | F_C, "N and C survive; nothing else set");
});

test("setNZ derives N and Z and leaves the other flags alone", () => {
  const r = new Regs();
  r.p = F_C | F_V | F_D | F_I;
  r.setNZ(0x00);
  assert.ok(r.fZ && !r.fN, "0 -> Z=1, N=0");
  r.setNZ(0x80);
  assert.ok(r.fN && !r.fZ, "0x80 -> N=1, Z=0");
  r.setNZ(0x01);
  assert.ok(!r.fN && !r.fZ, "0x01 -> neither");
  assert.equal(r.p & (F_C | F_V | F_D | F_I), F_C | F_V | F_D | F_I, "C/V/D/I preserved through setNZ");
});

test("flag setters toggle exactly their own bit", () => {
  const r = new Regs();
  r.p = 0xff; // every real flag set
  r.clc();
  assert.ok(!r.fC, "CLC clears carry");
  assert.ok(r.fZ && r.fN && r.fV && r.fD && r.fI, "siblings survive CLC");
  r.cld();
  assert.ok(!r.fD, "CLD clears decimal");
  r.clv();
  assert.ok(!r.fV, "CLV clears overflow");
  r.cli();
  assert.ok(!r.fI, "CLI clears interrupt-disable");
  r.p = 0x00;
  r.sec(); r.sed(); r.sei();
  assert.ok(r.fC && r.fD && r.fI, "SEC/SED/SEI set their bits");
  assert.ok(!r.fZ && !r.fN && !r.fV, "and touch nothing else");
});

test("branch predicates read the flags they name", () => {
  const r = new Regs();
  r.p = 0x00;
  assert.ok(r.fNZ && r.fNC && r.fPl && r.fNV, "cleared flags -> the negated predicates");
  assert.ok(!r.fZ && !r.fC && !r.fN && !r.fV);
  r.p = F_Z | F_C | F_N | F_V;
  assert.ok(r.fZ && r.fC && r.fN && r.fV, "set flags read true");
  assert.ok(!r.fNZ && !r.fNC && !r.fPl && !r.fNV, "and their negations read false");
});

test("reset defaults: a=x=y=0, s=0xFD, I set", () => {
  const r = new Regs();
  assert.equal(r.a, 0);
  assert.equal(r.x, 0);
  assert.equal(r.y, 0);
  assert.equal(r.s, 0xfd, "stack pointer starts at 0xFD");
  assert.ok(r.fI, "I set at power-on");
});

test("copyFrom round-trips every REG_FIELD, including the P byte", () => {
  const r = new Regs();
  r.a = 0x12; r.x = 0x34; r.y = 0x56; r.s = 0x78;
  r.p = F_N | F_V | F_Z | F_C;
  const c = new Regs();
  c.copyFrom(r);
  assert.equal(c.a, 0x12);
  assert.equal(c.x, 0x34);
  assert.equal(c.y, 0x56);
  assert.equal(c.s, 0x78);
  assert.equal(c.p, r.p, "status byte copied");
  assert.ok(c.fN && c.fV && c.fZ && c.fC, "flags survive the clone");
});
