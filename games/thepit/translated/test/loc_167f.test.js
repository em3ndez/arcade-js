// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_167f (ROM 0x167f-0x16b8): the row-index dispatcher. It
// (a) defers straight to 0x1b5b when the 0x807f flag is set, else derives
//   row = 0x1f - (((mem[0x8068] + E + 0x0b) & 0xff) >> 3)
// (stored to 0x8073, copied into H) after pre-loading sprite code 0x32 into
// 0x8069, then branches:
//   row != 7                      -> tail-jump loc_16b9
//   row == 7 and mem[0x8076] == 0 -> tail-jump loc_16b9
//   row == 7 and mem[0x8076] != 0 -> clear 0x8076/0x80bd, set 0x80aa=9, jp 0x2bd3
//
// The row arithmetic is pinned via the `neg`: with E=0 and mem[0x8068]=0xB5,
// (0xB5+0x0b)>>3 = 0xC0>>3 = 24, and 0x1f-24 = 7, so the row==7 boundary is hit
// exactly. E is a REGISTER input, seeded per path.
//
// It drives all four exit paths, asserting the exact T-state total, the
// instruction-boundary step sequence, the tail-jump target, residual A, and the
// memory writes. The MUTATION corrupts the closing `jp 0x2bd3` target to 0x2bd4:
// a jp is 10T taken-or-not so the cycle total is UNCHANGED -- it is precisely the
// step/call-target assertions that must reject it (the loc_1420 discipline).

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_167f } from "../loc_167f.js";

// Minimal leaf-routine machine double: exactly the surface loc_167f touches
// (regs, mem, step, ret, call). step records its target + charges cycles; call
// records the tail-jump target WITHOUT invoking a real routine (0x1b5b, loc_16b9
// and 0x2bd3 are separate units), so `return m.call(t)` models "control
// transferred to t and never came back". E is a register input, set via `e`.
function makeMachine(seed = {}, e = 0) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x167f,
    steps: [],
    calls: [],
    returned: false,
    ret(cycles = 10) {
      this.cycles += cycles;
      this.returned = true;
    },
    call(addr) {
      this.calls.push(addr);
      return undefined; // callee's own ret returns to OUR caller; nothing to do here
    },
  };
  m.mem = new AddressSpace(rom, m.io);
  m.step = (nextAddr, cycles) => {
    m.pc = nextAddr;
    m.cycles += cycles;
    m.steps.push(nextAddr);
  };
  for (const [addr, val] of Object.entries(seed)) m.mem.write8(Number(addr), val);
  m.regs.e = e;
  return m;
}

function assertPath(m, exp) {
  assert.deepEqual(m.steps, exp.steps, "step targets");
  assert.deepEqual(m.calls, exp.calls, "call targets");
  assert.equal(m.returned, exp.returned, "early ret");
  assert.equal(m.cycles, exp.cycles, "T-state total");
  assert.equal(m.pc, exp.pc, "final PC");
  assert.equal(m.regs.a, exp.a, "A register");
  for (const [addr, val] of Object.entries(exp.mem ?? {})) {
    assert.equal(m.mem.read8(Number(addr)), val, `mem[0x${Number(addr).toString(16)}]`);
  }
}

// Common prefix: start through the `cp 0x07` boundary (its next boundary 0x16a1).
// Shared by all three non-defer paths.
const PREFIX = [
  0x1682, 0x1683, 0x1686, 0x1688, 0x168b, 0x168e, 0x168f, 0x1691,
  0x1693, 0x1695, 0x1697, 0x1699, 0x169b, 0x169e, 0x169f, 0x16a1,
];
const PREFIX_T = 13 + 4 + 10 + 7 + 13 + 13 + 4 + 7 + 8 + 8 + 8 + 8 + 7 + 13 + 4 + 7; // 134

const PATHS = {
  // 0x807f != 0 -> tail-jump 0x1b5b immediately, A = the flag byte just read.
  defer_1b5b: {
    seed: { 0x807f: 0x01 },
    e: 0,
    exp: {
      steps: [0x1682, 0x1683, 0x1b5b],
      calls: [0x1b5b],
      returned: false,
      cycles: 13 + 4 + 10, // 27
      pc: 0x1b5b,
      a: 0x01,
    },
  },
  // 0x807f == 0, mem[0x8068]=0 -> row = 0x1f - (0x0b>>3) = 0x1f - 1 = 0x1e != 7.
  // jr nz taken -> loc_16b9. H = 0x1e, 0x8073 = 0x1e, 0x8069 = 0x32.
  common_16b9: {
    seed: { 0x807f: 0x00, 0x8068: 0x00 },
    e: 0,
    exp: {
      steps: [...PREFIX, 0x16b9],
      calls: [0x16b9],
      returned: false,
      cycles: PREFIX_T + 12, // 146
      pc: 0x16b9,
      a: 0x1e,
      mem: { 0x8069: 0x32, 0x8073: 0x1e },
    },
  },
  // row == 7 (mem[0x8068]=0xB5, E=0) but event flag 0x8076 == 0 -> jr nz not
  // taken, then jr z taken -> loc_16b9. A = 0 (the flag read), 0x8073 = 7.
  row7_flagclear_16b9: {
    seed: { 0x807f: 0x00, 0x8068: 0xb5, 0x8076: 0x00 },
    e: 0,
    exp: {
      steps: [...PREFIX, 0x16a3, 0x16a6, 0x16a7, 0x16b9],
      calls: [0x16b9],
      returned: false,
      cycles: PREFIX_T + 7 + 13 + 4 + 12, // 170
      pc: 0x16b9,
      a: 0x00,
      mem: { 0x8069: 0x32, 0x8073: 0x07, 0x8076: 0x00 },
    },
  },
  // row == 7 AND event flag set -> the one-shot: clear 0x8076/0x80bd, 0x80aa=9,
  // jp 0x2bd3. A = 0x09.
  row7_event_2bd3: {
    seed: { 0x807f: 0x00, 0x8068: 0xb5, 0x8076: 0x01 },
    e: 0,
    exp: {
      steps: [
        ...PREFIX, 0x16a3, 0x16a6, 0x16a7, 0x16a9, 0x16ab, 0x16ae, 0x16b1, 0x16b3, 0x16b6, 0x2bd3,
      ],
      calls: [0x2bd3],
      returned: false,
      cycles: PREFIX_T + 7 + 13 + 4 + 7 + 7 + 13 + 13 + 7 + 13 + 10, // 228
      pc: 0x2bd3,
      a: 0x09,
      mem: { 0x8069: 0x32, 0x8073: 0x07, 0x8076: 0x00, 0x80bd: 0x00, 0x80aa: 0x09 },
    },
  },
};

for (const [name, { seed, e, exp }] of Object.entries(PATHS)) {
  test(`path ${name}`, () => {
    const m = makeMachine(seed, e);
    loc_167f(m);
    assertPath(m, exp);
  });
}

// Anchor the row arithmetic itself: the `neg` really produces 0x1f - (x>>3).
// mem[0x8068]=0xB5, E=0 -> 0xC0>>3 = 24 -> row 7 stored at 0x8073.
test("row = 0x1f - ((0x8068 + E + 0x0b) >> 3) is stored to 0x8073", () => {
  const m = makeMachine({ 0x807f: 0x00, 0x8068: 0xb5 }, 0);
  loc_167f(m);
  assert.equal(m.mem.read8(0x8073), 0x07, "row lands on 7 at the 0xB5 boundary");
});

// The caller-supplied E genuinely participates: bumping E by 8 lowers the row by 1
// (one shift group), and does NOT land on 7, so it takes the common 0x16b9 path.
test("E participates in the row computation", () => {
  const m = makeMachine({ 0x807f: 0x00, 0x8068: 0xb5 }, 0x08);
  loc_167f(m);
  assert.equal(m.mem.read8(0x8073), 0x06, "E += 8 shifts the row down by one");
  assert.deepEqual(m.calls, [0x16b9], "row 6 != 7 -> common path");
});

test("mutation: a corrupted jp-0x2bd3 target is caught", () => {
  // Byte-identical to loc_167f through the event arm, except the closing tail-jump
  // targets 0x2bd4 instead of 0x2bd3. A jp is 10T taken-or-not, so the cycle total
  // is UNCHANGED; the step/call-target assertions are what must reject it.
  function loc_167f_mutant(m) {
    const { regs, mem } = m;
    regs.a = mem.read8(0x807f);
    m.step(0x1682, 13);
    regs.and(regs.a);
    m.step(0x1683, 4);
    if (regs.fNZ) {
      m.step(0x1b5b, 10);
      return m.call(0x1b5b);
    }
    m.step(0x1686, 10);
    regs.a = 0x32;
    m.step(0x1688, 7);
    mem.write8(0x8069, regs.a);
    m.step(0x168b, 13);
    regs.a = mem.read8(0x8068);
    m.step(0x168e, 13);
    regs.add(regs.e);
    m.step(0x168f, 4);
    regs.add(0x0b);
    m.step(0x1691, 7);
    regs.a = regs.srl(regs.a);
    m.step(0x1693, 8);
    regs.a = regs.srl(regs.a);
    m.step(0x1695, 8);
    regs.a = regs.srl(regs.a);
    m.step(0x1697, 8);
    regs.neg();
    m.step(0x1699, 8);
    regs.add(0x1f);
    m.step(0x169b, 7);
    mem.write8(0x8073, regs.a);
    m.step(0x169e, 13);
    regs.h = regs.a;
    m.step(0x169f, 4);
    regs.cp(0x07);
    m.step(0x16a1, 7);
    if (regs.fNZ) {
      m.step(0x16b9, 12);
      return m.call(0x16b9);
    }
    m.step(0x16a3, 7);
    regs.a = mem.read8(0x8076);
    m.step(0x16a6, 13);
    regs.or(regs.a);
    m.step(0x16a7, 4);
    if (regs.fZ) {
      m.step(0x16b9, 12);
      return m.call(0x16b9);
    }
    m.step(0x16a9, 7);
    regs.a = 0x00;
    m.step(0x16ab, 7);
    mem.write8(0x8076, regs.a);
    m.step(0x16ae, 13);
    mem.write8(0x80bd, regs.a);
    m.step(0x16b1, 13);
    regs.a = 0x09;
    m.step(0x16b3, 7);
    mem.write8(0x80aa, regs.a);
    m.step(0x16b6, 13);
    m.step(0x2bd4, 10); // BUG: should be 0x2bd3
    return m.call(0x2bd4); // BUG: should be 0x2bd3
  }

  const m = makeMachine(PATHS.row7_event_2bd3.seed, PATHS.row7_event_2bd3.e);
  loc_167f_mutant(m);
  // Only the tail-jump target differs; cycles are identical, so the step-target
  // assertion is what must throw.
  assert.equal(m.cycles, PATHS.row7_event_2bd3.exp.cycles, "mutation preserves the cycle total");
  assert.throws(() => assertPath(m, PATHS.row7_event_2bd3.exp), /step targets/);
});
