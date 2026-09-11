// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_af81 (ROM 0xaf81-0xb095). Minimal 6502 harness (Regs + flat RAM + the page-1
// stack seam); author-derived. The routine is opaque-JSR heavy (render/vector helpers) -- the harness
// RECORDS each JSR target and does NOT run it (so nested subroutines leave regs/carry as the routine's
// own instructions set them), like centiped's loc_2a92 test. The whole-machine boot-first state diff vs
// MAME is the real integration check. Data-dependent abs,x/abs,y reads are charged base (no +1 page-cross)
// exactly as the translation does; the golden cycle totals below use that same base convention.
// Run: node --test games/tempest/translated/test/equivalence-af81.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_af81 } from "../loc_af81.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [],
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } return undefined; },
  };
}

// Common diamond inputs: A=$0200=0x50 > $7b=0x40 (result 0x10: bpl+bne taken); $7c=0x30 < $0127=0x40
// (beq/bcs not taken); $7c-$0200 nonzero+borrow -> inc $7b/$7c. Yields $7b=0x41, $7c=0x31.
function diamondSetup(m) {
  m.ram[0x0200] = 0x50;
  m.ram[0x007b] = 0x40;
  m.ram[0x007c] = 0x30;
  m.ram[0x0127] = 0x40;
  m.ram[0x016e] = 0x05;
  // b081 trailer table $b0a3: last iteration ($38=6,7) yields X=$b0a9, A=$b0aa.
  m.ram[0xb0a9] = 0x11;
  m.ram[0xb0aa] = 0x22;
}

test("loc_af81: all 5 rows skip the draw body ($91fe,x >= 0x63); golden mem/regs/calls, 823 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // final RTS -> pulled + 1 = 0x1234
  diamondSetup(m);
  // rows use x=$3a = 0x31,0x30,0x2f,0x2e,0x2d -> $91fe,x = 0x922f..0x922b; force all skips.
  for (const a of [0x922f, 0x922e, 0x922d, 0x922c, 0x922b]) m.ram[a] = 0x70;

  loc_af81(m);

  // diamond nudged $7b/$7c up by one
  assert.equal(m.ram[0x007b], 0x41, "$7b incremented in the diamond");
  assert.equal(m.ram[0x007c], 0x31, "$7c incremented in the diamond");
  assert.equal(m.ram[0x016e], 0x04, "$016e decremented once at entry");
  assert.equal(m.ram[0x0072], 0x01, "$72 set to 1");
  assert.equal(m.ram[0x0073], 0xe0, "$73 last written 0xe0 in the trailer");
  assert.equal(m.ram[0x003a], 0x2c, "$3a = $7c(0x31) - 5 rows");
  assert.equal(m.ram[0x0038], 0x08, "$38 advanced by 2 per b081 iter x4");
  assert.equal(m.ram[0x0037], 0xff, "$37 wrapped past 0 at the last loop's final dec");

  assert.equal(m.regs.x, 0x11, "X = $b0a9 from the last b081 tax");
  assert.equal(m.regs.a, 0x22, "A = $b0aa from the last b081 lda");
  assert.equal(m.regs.y, 0x08, "Y = 8 after the last b081 iny pair");

  assert.equal(m.pc, 0x1234, "final RTS returns to pushed + 1");

  const expectCalls = [
    0xca48, 0xb0d1, 0xdf6a, 0xab17, 0xaa92,
    0xab14, 0xab14, 0xab14, 0xab14, 0xab14, 0xab14, 0xab14, 0xab14,
    0xb0d1, 0xab0d, 0xdf75, 0xb0d1, 0xab0d, 0xdf75, 0xb0d1, 0xab0d, 0xdf75,
    0xb0d1, 0xab0d, 0xdf75, 0xb0d1, 0xab0d, 0xdf75,
    0xab0d, 0xab14, 0xdfb1, 0xb0d1, 0xab0d, 0xb0ab, 0xdf75,
    0xdf75, 0xdf75, 0xdf75, 0xdf75,
  ];
  assert.deepEqual(m.calls, expectCalls, "full JSR target sequence (5 skipped rows)");

  assert.equal(m.cycles, 823, "golden T-state total, all-skip path");
});

test("loc_af81: first row draws the body ($91fe,x < 0x63), rest skip; body calls + 912 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000);
  diamondSetup(m);
  m.ram[0x922f] = 0x10; // row1 (x=0x31): 0x10 < 0x63 -> draw body
  for (const a of [0x922e, 0x922d, 0x922c, 0x922b]) m.ram[a] = 0x70; // rows 2-5 skip

  loc_af81(m);

  assert.equal(m.ram[0x007b], 0x41, "diamond result unchanged by the body");
  assert.equal(m.ram[0x007c], 0x31, "diamond result unchanged by the body");
  assert.equal(m.ram[0x003a], 0x2c, "$3a still decremented 5 times");
  assert.equal(m.pc, 0x2001, "final RTS -> pushed + 1");

  const expectCalls = [
    0xca48, 0xb0d1, 0xdf6a, 0xab17, 0xaa92,
    0xab14, 0xab14, 0xab14, 0xab14, 0xab14, 0xab14, 0xab14, 0xab14,
    // row1 draws: pre-body b0d1,ab0d,df75 then the b00b..b03f body chain
    0xb0d1, 0xab0d, 0xdf75, 0xaf77, 0xb0d1, 0xab0d, 0xdf75, 0xb0c6, 0xab0d, 0xdf75, 0xc4e1,
    // rows 2-5 skip
    0xb0d1, 0xab0d, 0xdf75, 0xb0d1, 0xab0d, 0xdf75, 0xb0d1, 0xab0d, 0xdf75, 0xb0d1, 0xab0d, 0xdf75,
    0xab0d, 0xab14, 0xdfb1, 0xb0d1, 0xab0d, 0xb0ab, 0xdf75,
    0xdf75, 0xdf75, 0xdf75, 0xdf75,
  ];
  assert.deepEqual(m.calls, expectCalls, "one drawn row inserts the af77..c4e1 body chain");

  assert.equal(m.cycles, 912, "all-skip 823 + one drawn body (89 T)");
});

test("loc_af81: diamond negative arm (A < $7b) decrements $7b/$7c instead", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3000);
  diamondSetup(m);
  m.ram[0x0200] = 0x30; // now A(0x30) - $7b(0x40) = negative -> bpl NOT taken -> dec $7b/$7c
  for (const a of [0x922f, 0x922e, 0x922d, 0x922c, 0x922b, 0x922a]) m.ram[a] = 0x70;

  loc_af81(m);

  assert.equal(m.ram[0x007b], 0x3f, "$7b decremented (negative diamond arm)");
  assert.equal(m.ram[0x007c], 0x2f, "$7c decremented (negative diamond arm)");
  assert.equal(m.ram[0x003a], 0x2a, "$3a = $7c(0x2f) - 5 rows");
  assert.equal(m.pc, 0x3001, "final RTS -> pushed + 1");
});

test("loc_af81 MUTATION: a mischarged DEC $016e (5T not 6T) blows the golden total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  diamondSetup(m);
  for (const a of [0x922f, 0x922e, 0x922d, 0x922c, 0x922b]) m.ram[a] = 0x70;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0xaf87 && m.pcSeq.length === 1 ? 5 : c); // the DEC $016e step lands at 0xaf87
  loc_af81(m);
  assert.notEqual(m.cycles, 823, "a mischarged DEC abs cycle changes the golden T-state total");
});
