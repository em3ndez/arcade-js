// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_3458 (ROM 0x3458-0x3475): the periodic countdown with an
// every-4th-tick bit-7 toggle. The routine has THREE exit paths and the test
// exercises each one, asserting the exact T-state total, the instruction-boundary
// step sequence, the final A register, the value written back to the 0x808b
// counter, the two toggle bytes (0x8084 / 0x8069), and the control-flow outcome
// (which ret vs the 0x0278 tail-jump). It then re-runs a copy whose second
// `xor 0x80` is corrupted to `xor 0x40` and proves the value assertions catch it
// even though the cycle total is unchanged.

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_3458 } from "../loc_3458.js";

// Minimal leaf-routine machine double: exactly the surface loc_3458 touches
// (regs, mem, step, ret, call). step records its target + charges cycles; ret
// records the early return + charges cycles; call records the tail-jump target
// WITHOUT invoking a real routine (0x0278 is a separate unit), so `return
// m.call(0x0278)` models "control transferred to 0x0278 and never came back".
function makeMachine(seed = {}) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x3458,
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
  assert.equal(m.mem.read8(0x808b), exp.counter, "0x808b counter");
  assert.equal(m.mem.read8(0x8084), exp.f84, "0x8084 toggle flag");
  assert.equal(m.mem.read8(0x8069), exp.f69, "0x8069 toggle flag");
}

// Path A -- counter expires: 0x808b = 1 -> dec to 0, Z set, tail-jump 0x0278.
const PATH_A = {
  steps: [0x345b, 0x345c, 0x345f, 0x0278],
  calls: [0x0278],
  returned: false,
  cycles: 13 + 4 + 13 + 10, // 40
  pc: 0x0278,
  a: 0x00,
  counter: 0x00,
  f84: 0x00, // untouched -- toggle path not reached
  f69: 0x81, // untouched
};

// Path B -- 4th tick: 0x808b = 5 -> dec to 4, (4 & 3) == 0, ret nz NOT taken,
// both bit-7 toggles fire. 0x8084: 0x00 -> 0x80; 0x8069: 0x81 -> 0x01.
const PATH_B = {
  steps: [0x345b, 0x345c, 0x345f, 0x3462, 0x3464, 0x3465, 0x3468, 0x346a, 0x346d, 0x3470, 0x3472, 0x3475],
  calls: [],
  returned: true,
  cycles: 13 + 4 + 13 + 10 + 7 + 5 + 13 + 7 + 13 + 13 + 7 + 13 + 10, // 128 (incl. final ret)
  pc: 0x3475,
  a: 0x01, // last A = the toggled 0x8069 value
  counter: 0x04,
  f84: 0x80,
  f69: 0x01,
};

// Path C -- non-4th tick: 0x808b = 4 -> dec to 3, (3 & 3) != 0, ret nz taken,
// no toggle.
const PATH_C = {
  steps: [0x345b, 0x345c, 0x345f, 0x3462, 0x3464],
  calls: [],
  returned: true,
  cycles: 13 + 4 + 13 + 10 + 7 + 11, // 58
  pc: 0x3464, // ret nz opcode; ret stub leaves pc there
  a: 0x03, // (counter-1) & 3
  counter: 0x03,
  f84: 0x00, // untouched
  f69: 0x81, // untouched
};

test("path A: counter reaches zero -> vectors to 0x0278", () => {
  const m = makeMachine({ 0x808b: 0x01, 0x8084: 0x00, 0x8069: 0x81 });
  loc_3458(m);
  assertPath(m, PATH_A);
});

test("path B: 4th tick -> both bit-7 flags toggle, returns", () => {
  const m = makeMachine({ 0x808b: 0x05, 0x8084: 0x00, 0x8069: 0x81 });
  loc_3458(m);
  assertPath(m, PATH_B);
  // The toggle is a pure bit-7 flip -- other bits are preserved on both flags.
  assert.equal(m.mem.read8(0x8084) & 0x7f, 0x00, "0x8084 low 7 bits preserved");
  assert.equal(m.mem.read8(0x8069) & 0x7f, 0x01, "0x8069 low 7 bits preserved");
});

test("path C: non-4th tick -> ret nz, no toggle", () => {
  const m = makeMachine({ 0x808b: 0x04, 0x8084: 0x00, 0x8069: 0x81 });
  loc_3458(m);
  assertPath(m, PATH_C);
});

test("mutation: `xor 0x40` for `xor 0x80` on the 0x8069 flip is caught", () => {
  // Byte-identical to loc_3458 except the SECOND xor flips bit 6 instead of bit
  // 7. Cycles are UNCHANGED (xor n is 7T either way), so it is precisely the
  // value assertions -- not the cycle count -- that must reject it: 0x8069
  // becomes 0x81^0x40 = 0xC1 (and A ends 0xC1), not 0x81^0x80 = 0x01.
  function loc_3458_mutant(m) {
    const { regs, mem } = m;
    regs.a = mem.read8(0x808b);
    m.step(0x345b, 13);
    regs.a = regs.dec8(regs.a);
    m.step(0x345c, 4);
    mem.write8(0x808b, regs.a);
    m.step(0x345f, 13);
    if (regs.fZ) {
      m.step(0x0278, 10);
      return m.call(0x0278);
    }
    m.step(0x3462, 10);
    regs.and(0x03);
    m.step(0x3464, 7);
    if (regs.fNZ) {
      m.ret(11);
      return;
    }
    m.step(0x3465, 5);
    regs.a = mem.read8(0x8084);
    m.step(0x3468, 13);
    regs.xor(0x80);
    m.step(0x346a, 7);
    mem.write8(0x8084, regs.a);
    m.step(0x346d, 13);
    regs.a = mem.read8(0x8069);
    m.step(0x3470, 13);
    regs.xor(0x40); // BUG: should be xor 0x80
    m.step(0x3472, 7);
    mem.write8(0x8069, regs.a);
    m.step(0x3475, 13);
    m.ret();
  }

  const m = makeMachine({ 0x808b: 0x05, 0x8084: 0x00, 0x8069: 0x81 });
  loc_3458_mutant(m);
  // Cycles are identical to the real Path B, so only the value/register checks
  // can reject the mutant.
  assert.equal(m.cycles, PATH_B.cycles, "mutation preserves the cycle total (so cycles cannot catch it)");
  assert.equal(m.mem.read8(0x8069), 0xc1, "mutant flipped bit 6 -> 0xC1");
  assert.throws(() => assertPath(m, PATH_B), /0x8069 toggle flag|A register/);
});
