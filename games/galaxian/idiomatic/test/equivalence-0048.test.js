// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0048 — crafted-entry equivalence vs the frozen 8-bit divide helper at ROM 0x0048 (the strongly-
 * connected 0x0048/004c/0050 loop, collapsed here into one JS loop). The divide is PURE REGISTER math: it
 * writes NO work RAM, so a memory-only ramDiff would pass a wholly-wrong divide. EQUAL therefore asserts
 * ramDiff==null (no RAM effect, stack window masked) AND the register live-outs via regDiff: C=quotient
 * (the value loc_11d0/loc_1218 read back), A=remainder, D=shifted divisor, B=spent counter (0). Teeth:
 * no-op, a wrong seat of each of C/A/D/B, and two ALGORITHMIC mutants (no carry-complement -> inverted
 * quotient bits; a 7-round loop) that a register-blind test would miss.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_0048 as cand } from "../loc_0048.js";
import { loc_0048 as oracle } from "../../translated/loc_0048.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

// A crafted entry: dividend in A, divisor in D, a return word for the oracle's ret, and DIRTY C/B so the
// routine clearing the quotient accumulator and spending the counter are real, observable effects.
const entry = (a, d) => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.regs.a = a;
  mm.regs.d = d;
  mm.regs.c = 0x55; // dirty quotient accumulator
  mm.regs.b = 0x33; // dirty round counter
});

// null == equivalent: RAM identical (stack masked) AND every register live-out matches the oracle.
function regDiff(twin, e) {
  const ram = ramDiff(oracle, twin, e);
  if (ram) return `RAM ${ram}`;
  const a = e.clone(); a.routines = STUBS; oracle(a);
  const b = e.clone(); b.routines = STUBS; twin(b);
  if (a.regs.c !== b.regs.c) return `C: ${a.regs.c} vs ${b.regs.c}`;
  if (a.regs.a !== b.regs.a) return `A: ${a.regs.a} vs ${b.regs.a}`;
  if (a.regs.d !== b.regs.d) return `D: ${a.regs.d} vs ${b.regs.d}`;
  if (a.regs.b !== b.regs.b) return `B: ${a.regs.b} vs ${b.regs.b}`;
  return null;
}

const CASES = [[0x60, 0x20], [0xff, 0x03], [0x00, 0x05], [0x7f, 0x40], [0x90, 0x11], [0x01, 0xff], [0x33, 0x07], [0x80, 0x80]];

// Algorithmic broken twins (whole divide, one thing wrong) that must diverge in the QUOTIENT register.
function divideSeat(m, { rounds = 8, complement = true } = {}) {
  let a = m.regs.a & 0xff, d = m.regs.d & 0xff, q = 0, carry = 0;
  for (let r = 0; r < rounds; r++) {
    if (a < d) { carry = 1; } else { a = (a - d) & 0xff; carry = 0; }
    if (complement) carry = carry ? 0 : 1;
    const cOut = (q >> 7) & 1; q = ((q << 1) | carry) & 0xff; carry = cOut;
    const dOut = d & 1; d = ((d >> 1) | (carry ? 0x80 : 0)) & 0xff; carry = dOut;
  }
  m.regs.a = a; m.regs.d = d; m.regs.b = 0; m.regs.c = q;
}
const brokenNoComplement = (m) => divideSeat(m, { complement: false });
const brokenSevenRounds = (m) => divideSeat(m, { rounds: 7 });

test("EQUAL: loc_0048 divides A/D like the oracle (quotient C, remainder A, shifted D, counter B)", { skip }, () => {
  for (const [a, d] of CASES) {
    assert.equal(regDiff(cand, entry(a, d)), null, `loc_0048 diverged at A=0x${a.toString(16)} D=0x${d.toString(16)}`);
  }
  // non-vacuous positive control: the oracle really computes and seats the registers (0x60/0x20 -> C=0xff).
  const a = entry(0x60, 0x20).clone(); a.routines = STUBS; oracle(a);
  assert.equal(a.regs.c, 0xff, "positive control: oracle quotient C");
  assert.equal(a.regs.a, 0x21, "positive control: oracle remainder A");
  assert.equal(a.regs.b, 0x00, "positive control: oracle spent counter B to 0");
  assert.notEqual(a.regs.c, 0x55, "positive control: oracle cleared the dirty quotient accumulator");
  console.log("  EQUAL: loc_0048 == oracle (registers) across 8 dividend/divisor pairs");
});

test("TEETH: broken twins are caught (register-blind check would miss these)", { skip }, () => {
  const noOp = () => {};
  const wrongQuot = (m) => { cand(m); m.regs.c ^= 0xff; };   // right loop, wrong quotient seat
  const wrongRem = (m) => { cand(m); m.regs.a ^= 0xff; };    // right loop, wrong remainder seat
  const wrongDiv = (m) => { cand(m); m.regs.d ^= 0xff; };    // right loop, wrong divisor seat
  const wrongCounter = (m) => { cand(m); m.regs.b = 8; };    // counter not spent
  assert.ok(regDiff(noOp, entry(0x60, 0x20)), "no-op twin escaped");
  assert.ok(regDiff(wrongQuot, entry(0x60, 0x20)), "wrong-quotient twin escaped (C)");
  assert.ok(regDiff(wrongRem, entry(0x60, 0x20)), "wrong-remainder twin escaped (A)");
  assert.ok(regDiff(wrongDiv, entry(0x60, 0x20)), "wrong-divisor twin escaped (D)");
  assert.ok(regDiff(wrongCounter, entry(0x60, 0x20)), "wrong-counter twin escaped (B)");
  assert.ok(regDiff(brokenNoComplement, entry(0x60, 0x20)), "no-complement (inverted bits) twin escaped");
  assert.ok(regDiff(brokenNoComplement, entry(0x00, 0x05)), "no-complement twin escaped at 0x00/0x05");
  assert.ok(regDiff(brokenSevenRounds, entry(0x60, 0x20)), "7-round twin escaped");
  assert.ok(regDiff(brokenSevenRounds, entry(0x00, 0x05)), "7-round twin escaped at 0x00/0x05");
  console.log("  TEETH: no-op, wrong C/A/D/B seats + no-complement + 7-round all caught");
});
