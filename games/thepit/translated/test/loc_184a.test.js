// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_184a (ROM 0x184a-0x1869): advances the position
// accumulator at 0x8068 by the delta at 0x806c, stores the +3-biased low-3-bit
// phase at 0x8075, selects the walk-frame code (0x32 when phase bit1 is clear,
// else 0x33) into 0x8069, and tail-jumps into loc_1b5b. The test drives BOTH
// frame branches plus an 8-bit-wrap accumulation, asserting the exact T-state
// total, the instruction-boundary step sequence, the tail-jump call target, the
// three memory writes, and the surviving E/A registers. It then re-runs a copy
// whose pre-branch frame constant is corrupted 0x32 -> 0x30 and proves the
// A/memory assertions catch it even though the cycle total is unchanged (a
// ld a,n is 7T either way).

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_184a } from "../loc_184a.js";

// Minimal leaf-routine machine double: exactly the surface loc_184a touches
// (regs, mem, step, call). step records its target + charges cycles; call
// records the tail-jump target WITHOUT invoking a real routine (loc_1b5b is a
// separate unit), so `return m.call(0x1b5b)` models "control transferred to
// 0x1b5b and never came back here".
function makeMachine(seed = {}) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x184a,
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
  return m;
}

function assertPath(m, exp) {
  assert.deepEqual(m.steps, exp.steps, "step targets");
  assert.deepEqual(m.calls, exp.calls, "call targets");
  assert.equal(m.returned, exp.returned, "early ret");
  assert.equal(m.cycles, exp.cycles, "T-state total");
  assert.equal(m.pc, exp.pc, "final PC");
  assert.equal(m.regs.a, exp.a, "A register");
  assert.equal(m.regs.e, exp.e, "E register");
  for (const [addr, val] of Object.entries(exp.mem)) {
    assert.equal(m.mem.read8(Number(addr)), val, `mem[0x${Number(addr).toString(16)}]`);
  }
}

const STEPS_COMMON = [
  0x184d, 0x184e, 0x1851, 0x1852, 0x1855, 0x1857, 0x1859, 0x185c, 0x185e, 0x1860,
];
const CYC_COMMON = 13 + 4 + 13 + 4 + 13 + 7 + 7 + 13 + 7 + 7; // through 0x1860 == 88

const PATHS = {
  // phase = (0x00 + 0x01 + 3) & 7 = 4 -> bit1 clear -> Z set -> jr taken, frame 0x32.
  frame_32_bit1_clear: {
    seed: { 0x806c: 0x01, 0x8068: 0x00 },
    exp: {
      steps: [...STEPS_COMMON, 0x1864, 0x1867, 0x1b5b],
      calls: [0x1b5b],
      returned: false,
      cycles: CYC_COMMON + 12 + 13 + 10, // jr taken 12
      pc: 0x1b5b,
      a: 0x32,
      e: 0x01,
      mem: { 0x8068: 0x01, 0x8075: 0x04, 0x8069: 0x32 },
    },
  },
  // phase = (0x00 + 0x07 + 3) & 7 = 2 -> bit1 set -> Z clear -> jr NOT taken, frame 0x33.
  frame_33_bit1_set: {
    seed: { 0x806c: 0x07, 0x8068: 0x00 },
    exp: {
      steps: [...STEPS_COMMON, 0x1862, 0x1864, 0x1867, 0x1b5b],
      calls: [0x1b5b],
      returned: false,
      cycles: CYC_COMMON + 7 + 7 + 13 + 10, // jr not-taken 7 + ld a,0x33 7
      pc: 0x1b5b,
      a: 0x33,
      e: 0x07,
      mem: { 0x8068: 0x07, 0x8075: 0x02, 0x8069: 0x33 },
    },
  },
  // 8-bit wrap: 0xff + 0x02 = 0x101 -> 0x01 stored. phase = (1 + 3) & 7 = 4 -> frame 0x32.
  // Pins the (a+e) & 0xff truncation on the accumulator store.
  wrap_accumulator: {
    seed: { 0x806c: 0x02, 0x8068: 0xff },
    exp: {
      steps: [...STEPS_COMMON, 0x1864, 0x1867, 0x1b5b],
      calls: [0x1b5b],
      returned: false,
      cycles: CYC_COMMON + 12 + 13 + 10,
      pc: 0x1b5b,
      a: 0x32,
      e: 0x02,
      mem: { 0x8068: 0x01, 0x8075: 0x04, 0x8069: 0x32 },
    },
  },
};

for (const [name, { seed, exp }] of Object.entries(PATHS)) {
  test(`path ${name}`, () => {
    const m = makeMachine(seed);
    loc_184a(m);
    assertPath(m, exp);
  });
}

test("mutation: a corrupted frame constant is caught", () => {
  // Byte-identical to loc_184a except the pre-branch `ld a,0x32` becomes
  // `ld a,0x30`. On the Z-taken path A ends 0x30 and mem[0x8069] = 0x30. A
  // ld a,n is 7T either way, so the cycle total is UNCHANGED; it is precisely
  // the A / memory assertions that must reject it.
  function loc_184a_mutant(m) {
    const { regs, mem } = m;
    regs.a = mem.read8(0x806c);
    m.step(0x184d, 13);
    regs.e = regs.a;
    m.step(0x184e, 4);
    regs.a = mem.read8(0x8068);
    m.step(0x1851, 13);
    regs.add(regs.e);
    m.step(0x1852, 4);
    mem.write8(0x8068, regs.a);
    m.step(0x1855, 13);
    regs.add(0x03);
    m.step(0x1857, 7);
    regs.and(0x07);
    m.step(0x1859, 7);
    mem.write8(0x8075, regs.a);
    m.step(0x185c, 13);
    regs.and(0x02);
    m.step(0x185e, 7);
    regs.a = 0x30; // BUG: should be 0x32
    m.step(0x1860, 7);
    if (regs.fZ) {
      m.step(0x1864, 12);
    } else {
      m.step(0x1862, 7);
      regs.a = 0x33;
      m.step(0x1864, 7);
    }
    mem.write8(0x8069, regs.a);
    m.step(0x1867, 13);
    m.step(0x1b5b, 10);
    return m.call(0x1b5b);
  }

  const m = makeMachine(PATHS.frame_32_bit1_clear.seed);
  loc_184a_mutant(m);
  // Cycles are identical to the honest routine; the A / memory assertions catch it.
  assert.equal(
    m.cycles,
    PATHS.frame_32_bit1_clear.exp.cycles,
    "mutation preserves the cycle total",
  );
  assert.throws(() => assertPath(m, PATHS.frame_32_bit1_clear.exp), /A register/);
});
