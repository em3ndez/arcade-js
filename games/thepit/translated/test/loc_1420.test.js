// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_1420 (ROM 0x1420-0x1433): the shared dispatcher tail that
// (a) defers the frame to 0x1b5b when the 0x80a2 lock is set, else (b) selects
// A = (0x8001 >= 3) ? mem[0x801b] : mem[0x8018] and tail-jumps into loc_1434.
// It drives all three exit paths plus the >= 3 comparison boundary, asserting
// the exact T-state total, the instruction-boundary step sequence, the selected
// A register (with 0x801b and 0x8018 seeded to DIFFERENT values so the choice
// and the pre-branch load ordering are both pinned), and the tail-jump target.
// It then re-runs a copy whose `jr nc` target is corrupted 0x1434 -> 0x1435 and
// proves the step/call-target assertions catch it even though the cycle total is
// unchanged (a taken jr is 12T either way).

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_1420 } from "../loc_1420.js";

// Minimal leaf-routine machine double: exactly the surface loc_1420 touches
// (regs, mem, step, ret, call). step records its target + charges cycles; call
// records the tail-jump target WITHOUT invoking a real routine (0x1b5b and
// loc_1434 are separate units), so `return m.call(t)` models "control
// transferred to t and never came back".
function makeMachine(seed = {}) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x1420,
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
}

const PATHS = {
  // 0x80a2 lock set -> tail-jump 0x1b5b, A = the lock byte just read.
  locked_1b5b: {
    seed: { 0x80a2: 0x05 },
    exp: {
      steps: [0x1423, 0x1424, 0x1b5b],
      calls: [0x1b5b],
      returned: false,
      cycles: 13 + 4 + 10,
      pc: 0x1b5b,
      a: 0x05,
    },
  },
  // 0x80a2 == 0, 0x8001 == 5 (>= 3, no carry) -> jr nc taken, A = mem[0x801b].
  select_801b: {
    seed: { 0x80a2: 0x00, 0x8001: 0x05, 0x801b: 0xab, 0x8018: 0xcd },
    exp: {
      steps: [0x1423, 0x1424, 0x1427, 0x142a, 0x142c, 0x142f, 0x1434],
      calls: [0x1434],
      returned: false,
      cycles: 13 + 4 + 10 + 13 + 7 + 13 + 12,
      pc: 0x1434,
      a: 0xab,
    },
  },
  // 0x8001 == 3 exactly is still >= 3 (cp 0x03 clears carry) -> selects 0x801b.
  // Nails the comparison boundary against a cp-constant / condition off-by-one.
  select_801b_boundary: {
    seed: { 0x80a2: 0x00, 0x8001: 0x03, 0x801b: 0xab, 0x8018: 0xcd },
    exp: {
      steps: [0x1423, 0x1424, 0x1427, 0x142a, 0x142c, 0x142f, 0x1434],
      calls: [0x1434],
      returned: false,
      cycles: 13 + 4 + 10 + 13 + 7 + 13 + 12,
      pc: 0x1434,
      a: 0xab,
    },
  },
  // 0x80a2 == 0, 0x8001 == 1 (< 3, carry) -> jr nc not taken, A = mem[0x8018].
  select_8018: {
    seed: { 0x80a2: 0x00, 0x8001: 0x01, 0x801b: 0xab, 0x8018: 0xcd },
    exp: {
      steps: [0x1423, 0x1424, 0x1427, 0x142a, 0x142c, 0x142f, 0x1431, 0x1434],
      calls: [0x1434],
      returned: false,
      cycles: 13 + 4 + 10 + 13 + 7 + 13 + 7 + 13,
      pc: 0x1434,
      a: 0xcd,
    },
  },
};

for (const [name, { seed, exp }] of Object.entries(PATHS)) {
  test(`path ${name}`, () => {
    const m = makeMachine(seed);
    loc_1420(m);
    assertPath(m, exp);
  });
}

test("mutation: a corrupted jr-nc target is caught", () => {
  // Byte-identical to loc_1420 up to the jr nc, except its target is 0x1435
  // instead of 0x1434. A taken jr is 12T either way, so the cycle total is
  // UNCHANGED; it is precisely the step/call-target assertions that must reject
  // it.
  function loc_1420_mutant(m) {
    const { regs, mem } = m;
    regs.a = mem.read8(0x80a2);
    m.step(0x1423, 13);
    regs.and(regs.a);
    m.step(0x1424, 4);
    if (regs.fNZ) {
      m.step(0x1b5b, 10);
      return m.call(0x1b5b);
    }
    m.step(0x1427, 10);
    regs.a = mem.read8(0x8001);
    m.step(0x142a, 13);
    regs.cp(0x03);
    m.step(0x142c, 7);
    regs.a = mem.read8(0x801b);
    m.step(0x142f, 13);
    if (regs.fNC) {
      m.step(0x1435, 12); // BUG: should be 0x1434
      return m.call(0x1435); // BUG: should be 0x1434
    }
    // (carry path is irrelevant to this mutation and omitted)
  }

  const m = makeMachine(PATHS.select_801b.seed);
  loc_1420_mutant(m);
  // Only the tail-jump target differs (0x1435 vs 0x1434); cycles are identical,
  // so the step-target assertion is what must throw.
  assert.equal(m.cycles, PATHS.select_801b.exp.cycles, "mutation preserves the cycle total");
  assert.throws(() => assertPath(m, PATHS.select_801b.exp), /step targets/);
});
