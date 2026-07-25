// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_13c9 (ROM 0x13c9-0x13db): the per-frame countdown gate
// at the head of the main dispatcher. The routine has FOUR exit paths and the
// test exercises every one, asserting the exact T-state total, the
// instruction-boundary step sequence, the final A register, the value written
// back to the 0x807c timer, and the control-flow outcome (ret vs which
// tail-jump target). It then re-runs a copy whose 0x0278 tail-jump target is
// corrupted and proves the control-flow assertions catch it.

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_13c9 } from "../loc_13c9.js";

// Minimal leaf-routine machine double: exactly the surface loc_13c9 touches
// (regs, mem, step, ret, call). step records its target + charges cycles; ret
// records the early return + charges cycles; call records the tail-jump target
// WITHOUT invoking a real routine (loc_13de/0x0278/0x02fd are separate units),
// so `return m.call(t)` models "control transferred to t and never came back".
function makeMachine(seed = {}) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x13c9,
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
  assert.equal(m.mem.read8(0x807c), exp.timer, "0x807c countdown timer");
}

// Path A -- timer still running: 0x807c = 3 -> dec to 2, non-zero, ret nz taken.
const PATH_A = {
  steps: [0x13cc, 0x13cd, 0x13cf, 0x13d0, 0x13d3],
  calls: [],
  returned: true,
  cycles: 13 + 4 + 7 + 4 + 13 + 11, // 52
  pc: 0x13d3, // the ret opcode; ret stub leaves pc there
  a: 0x02,
  timer: 0x02,
};

// Path B -- timer expires this frame, mode byte 0 -> tail-jump 0x0278.
const PATH_B = {
  steps: [0x13cc, 0x13cd, 0x13cf, 0x13d0, 0x13d3, 0x13d4, 0x13d7, 0x13d8, 0x0278],
  calls: [0x0278],
  returned: false,
  cycles: 13 + 4 + 7 + 4 + 13 + 5 + 13 + 4 + 10, // 73
  pc: 0x0278,
  a: 0x00,
  timer: 0x00,
};

// Path C -- timer expires, mode byte non-zero -> fall past jp z, tail-jump 0x02fd.
const PATH_C = {
  steps: [0x13cc, 0x13cd, 0x13cf, 0x13d0, 0x13d3, 0x13d4, 0x13d7, 0x13d8, 0x13db, 0x02fd],
  calls: [0x02fd],
  returned: false,
  cycles: 13 + 4 + 7 + 4 + 13 + 5 + 13 + 4 + 10 + 10, // 83
  pc: 0x02fd,
  a: 0x05,
  timer: 0x00,
};

// Path D -- timer already zero: jr z taken straight into the dispatcher loc_13de.
const PATH_D = {
  steps: [0x13cc, 0x13cd, 0x13de],
  calls: [0x13de],
  returned: false,
  cycles: 13 + 4 + 12, // 29
  pc: 0x13de,
  a: 0x00,
  timer: 0x00,
};

test("path A: running timer decrements and returns early (ret nz)", () => {
  const m = makeMachine({ 0x807c: 0x03 });
  const fBefore = m.regs.f;
  loc_13c9(m);
  assertPath(m, PATH_A);
  assert.notEqual(m.regs.f, fBefore, "flags were updated by and/dec"); // sanity: routine ran
});

test("path B: timer expires with mode 0 -> vectors to 0x0278", () => {
  const m = makeMachine({ 0x807c: 0x01, 0x807d: 0x00 });
  loc_13c9(m);
  assertPath(m, PATH_B);
});

test("path C: timer expires with mode != 0 -> vectors to 0x02fd", () => {
  const m = makeMachine({ 0x807c: 0x01, 0x807d: 0x05 });
  loc_13c9(m);
  assertPath(m, PATH_C);
});

test("path D: timer already zero -> falls into the dispatcher at loc_13de", () => {
  const m = makeMachine({ 0x807c: 0x00 });
  loc_13c9(m);
  assertPath(m, PATH_D);
});

test("mutation: a corrupted tail-jump target is caught", () => {
  // Byte-identical to loc_13c9 except the mode-0 vector jumps to 0x0280 instead
  // of 0x0278. Cycles are UNCHANGED (jp cc is 10T either way), so it is precisely
  // the step/call-target assertions -- not the cycle count -- that must reject it.
  function loc_13c9_mutant(m) {
    const { regs, mem } = m;
    regs.a = mem.read8(0x807c);
    m.step(0x13cc, 13);
    regs.and(regs.a);
    m.step(0x13cd, 4);
    if (regs.fZ) {
      m.step(0x13de, 12);
      return m.call(0x13de);
    }
    m.step(0x13cf, 7);
    regs.a = regs.dec8(regs.a);
    m.step(0x13d0, 4);
    mem.write8(0x807c, regs.a);
    m.step(0x13d3, 13);
    if (regs.fNZ) {
      m.ret(11);
      return;
    }
    m.step(0x13d4, 5);
    regs.a = mem.read8(0x807d);
    m.step(0x13d7, 13);
    regs.and(regs.a);
    m.step(0x13d8, 4);
    if (regs.fZ) {
      m.step(0x0280, 10); // BUG: should be 0x0278
      return m.call(0x0280); // BUG: should be 0x0278
    }
    m.step(0x13db, 10);
    m.step(0x02fd, 10);
    return m.call(0x02fd);
  }

  const m = makeMachine({ 0x807c: 0x01, 0x807d: 0x00 });
  loc_13c9_mutant(m);
  // Only the tail-jump target differs (0x0280 vs 0x0278); the step-target
  // assertion must throw on that mismatch even though cycles are identical.
  assert.equal(m.cycles, PATH_B.cycles, "mutation preserves the cycle total (so cycles cannot catch it)");
  assert.throws(() => assertPath(m, PATH_B), /step targets/);
});
