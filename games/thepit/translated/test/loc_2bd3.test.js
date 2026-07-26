// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_2bd3 (ROM 0x2bd3-0x2bef), The Pit.
//
// Runs the routine on a lightweight machine built from the REAL thepit address
// space (boards/thepit/memory.js) + Io + the shared Z80 Regs, with a seeded fake
// ROM (the copyrighted image is never committed). loc_2bd3 is straight-line: it
// composes a 4-byte record at work RAM 0x8228 from the object bytes 0x80a9..0x80ac,
// biasing byte0 DOWN and byte3 UP by the shared offset at 0x8051 (sub b / add a,b),
// then TAIL-JUMPS to 0x2f71. The tail-call is stubbed as a bare `ret` (pop + no cycle
// charge) so the asserted T-state total is loc_2bd3's OWN cost, and so 0x2f71's ret is
// observed returning to loc_2bd3's caller. A deliberate mutation (the first-byte bias
// flipped from sub to add) is asserted to be caught.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs, F_C, F_Z } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_2bd3 } from "../loc_2bd3.js";

const DST = 0x8228; // 4-byte record destination in work RAM
const TAIL = 0x2f71; // tail-jump target
const SENTINEL = 0xbeef; // caller return address the tail-callee's ret must land on
const SP0 = 0x8780; // initial SP (inside work RAM so pushes are mapped)

// Input object state. Chosen so BOTH biased bytes wrap 8-bit:
//   0x8228 = 0x30 - 0x50 = 0xe0 (borrow -> exercises sub wrap)
//   0x822b = 0xc8 + 0x50 = 0x18 (carry  -> exercises add wrap, sets C)
const OFF = 0x50; // (0x8051) horizontal offset, loaded into B
const S_A9 = 0x30; // (0x80a9)
const S_AA = 0x77; // (0x80aa)
const S_AB = 0x06; // (0x80ab)
const S_AC = 0xc8; // (0x80ac)

const EXP_28 = (S_A9 - OFF) & 0xff; // 0xe0
const EXP_29 = S_AA; // 0x77
const EXP_2A = S_AB; // 0x06
const EXP_2B = (S_AC + OFF) & 0xff; // 0x18

// AddressSpace requires exactly a 20480-byte ROM; contents are irrelevant here
// (loc_2bd3 touches only work RAM), but it must exist.
function buildRom() {
  return new Uint8Array(0x5000);
}

// -- minimal machine: real mem/io/regs + the step/call seam ------------------
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x2bd3;
    this.calls = [];
    this.regs.sp = SP0;
  }
  step(nextAddr, t) {
    this.pc = nextAddr;
    this.cycles += t;
  }
  push16(v) {
    this.regs.sp = (this.regs.sp - 2) & 0xffff;
    this.mem.write8(this.regs.sp, v & 0xff);
    this.mem.write8((this.regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
  }
  pop16() {
    const lo = this.mem.read8(this.regs.sp);
    const hi = this.mem.read8((this.regs.sp + 1) & 0xffff);
    this.regs.sp = (this.regs.sp + 2) & 0xffff;
    return lo | (hi << 8);
  }
  // Stubbed callee: record it, then behave as a bare `ret` (pop the address on top
  // of the stack). For a TAIL-JUMP nothing was pushed by loc_2bd3, so this pops the
  // caller's return address -- exactly modelling 0x2f71 returning to loc_2bd3's
  // caller. No cycle charge: 0x2f71's own cost is not loc_2bd3's.
  call(addr) {
    this.calls.push(addr);
    this.pc = this.pop16();
    return undefined;
  }
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }
}

function seedInputs(m) {
  m.mem.write8(0x8051, OFF);
  m.mem.write8(0x80a9, S_A9);
  m.mem.write8(0x80aa, S_AA);
  m.mem.write8(0x80ab, S_AB);
  m.mem.write8(0x80ac, S_AC);
}

function run(fn) {
  const rom = buildRom();
  const m = new TestMachine(rom);
  seedInputs(m);
  m.push16(SENTINEL); // the caller's return address
  fn(m);
  return {
    cycles: m.cycles,
    r28: m.mem.read8(DST + 0),
    r29: m.mem.read8(DST + 1),
    r2a: m.mem.read8(DST + 2),
    r2b: m.mem.read8(DST + 3),
    calls: m.calls,
    pc: m.pc,
    sp: m.regs.sp,
    a: m.regs.a,
    b: m.regs.b,
    hl: m.regs.hl,
    f: m.regs.f,
  };
}

// Own-instruction T-states:
// 10 +13 +4 +13 +4 +7 +6 +13 +7 +6 +13 +7 +6 +13 +4 +7 +10(jp) = 143.
const EXPECT_T = 143;

// Full spec, factored so the mutant runs through the same checks.
function checkSpec(res) {
  assert.equal(res.cycles, EXPECT_T, "T-state total");
  // the 4-byte record, with the symmetric offset bias applied to the ends
  assert.equal(res.r28, EXP_28, "0x8228 = (0x80a9) - (0x8051)");
  assert.equal(res.r29, EXP_29, "0x8229 = (0x80aa)");
  assert.equal(res.r2a, EXP_2A, "0x822a = (0x80ab)");
  assert.equal(res.r2b, EXP_2B, "0x822b = (0x80ac) + (0x8051)");
  // control flow: tail-jump to 0x2f71 whose ret lands on the caller
  assert.deepEqual(res.calls, [TAIL], "tail-jumps to 0x2f71 exactly once");
  assert.equal(res.pc, SENTINEL, "0x2f71's ret returns to loc_2bd3's caller");
  assert.equal(res.sp, SP0, "stack balanced (no leaked push)");
  // registers left by the routine
  assert.equal(res.a, EXP_2B, "A = last stored byte (0x80ac + offset) on exit");
  assert.equal(res.b, OFF, "B holds the 0x8051 offset");
  assert.equal(res.hl, (DST + 3) & 0xffff, "HL past the 4th write target (0x822b)");
  // exit flags come from the final `add a,b`: 0xc8 + 0x50 = 0x118 -> C set, not zero
  assert.equal(res.f & F_C, F_C, "carry set from the final add a,b (0xc8+0x50 wraps)");
  assert.equal(res.f & F_Z, 0, "zero clear from the final add a,b");
}

test("loc_2bd3: builds the 0x8228 record with symmetric offset bias, tail-jumps to 0x2f71, 143 T", () => {
  checkSpec(run(loc_2bd3));
});

// -- MUTATION: flip the FIRST byte's bias from `sub b` to `add a,b`. The cycle count
// is IDENTICAL (both 4 T), and the FINAL flags/A/B/HL are unchanged (they come from
// the last add), so ONLY the 0x8228 content assertion can catch it -- proving that
// assertion has teeth.
function loc_2bd3_mutant(m) {
  const { regs, mem } = m;
  regs.hl = 0x8228;
  m.step(0x2bd6, 10);
  regs.a = mem.read8(0x8051);
  m.step(0x2bd9, 13);
  regs.b = regs.a;
  m.step(0x2bda, 4);
  regs.a = mem.read8(0x80a9);
  m.step(0x2bdd, 13);
  regs.add(regs.b); // BUG: should be sub b (bias DOWN), not add
  m.step(0x2bde, 4);
  mem.write8(regs.hl, regs.a);
  m.step(0x2bdf, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x2be0, 6);
  regs.a = mem.read8(0x80aa);
  m.step(0x2be3, 13);
  mem.write8(regs.hl, regs.a);
  m.step(0x2be4, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x2be5, 6);
  regs.a = mem.read8(0x80ab);
  m.step(0x2be8, 13);
  mem.write8(regs.hl, regs.a);
  m.step(0x2be9, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x2bea, 6);
  regs.a = mem.read8(0x80ac);
  m.step(0x2bed, 13);
  regs.add(regs.b);
  m.step(0x2bee, 4);
  mem.write8(regs.hl, regs.a);
  m.step(0x2bef, 7);
  m.step(0x2f71, 10);
  return m.call(0x2f71);
}

test("mutation (first-byte bias sub->add) is caught by the spec", () => {
  const bad = run(loc_2bd3_mutant);
  // Sanity: the mutant wrote the WRONG first byte but mischarged NOTHING and left
  // the exit A/B/HL/flags identical (all from the final add).
  assert.notEqual(bad.r28, EXP_28, "mutant biased 0x8228 the wrong way");
  assert.equal(bad.r28, (S_A9 + OFF) & 0xff, "mutant added the offset (0x80)");
  assert.equal(bad.cycles, EXPECT_T, "mutant's cycle count is identical");
  assert.equal(bad.a, EXP_2B, "mutant's exit A is unchanged");
  // The spec the real routine passes must REJECT the mutant.
  assert.throws(() => checkSpec(bad));
});
