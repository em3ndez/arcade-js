// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_3945 (ROM 0x3945-0x3954): the reload head of the period-8
// down-counter at 0x8112. The routine has TWO exit paths -- both tail-jump into
// loc_3968 -- and the test exercises each, asserting the exact T-state total, the
// instruction-boundary step sequence, the final A register, the byte written
// back to the 0x8112 counter, and the tail-jump target. It then re-runs a copy
// whose reload value is corrupted (0x08 -> 0x09) and proves the register/memory
// assertions catch it even though the cycle total is unchanged.

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_3945 } from "../loc_3945.js";

// Minimal leaf-routine machine double: exactly the surface loc_3945 touches
// (regs, mem, step, call). step records its target + charges cycles; call
// records the tail-jump target WITHOUT invoking a real routine (loc_3968 is a
// separate unit), so `return m.call(0x3968)` models "control transferred there
// and never came back".
function makeMachine(seed = {}) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x3945,
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
  assert.equal(m.mem.read8(0x8112), exp.counter, "0x8112 phase counter");
}

// Path A -- counter still running: 0x8112 = 5 -> dec to 4, non-zero, jr nz taken
// straight into loc_3968 with no reload.
const PATH_A = {
  steps: [0x3948, 0x3949, 0x394c, 0x3968],
  calls: [0x3968],
  returned: false,
  cycles: 13 + 4 + 13 + 12, // 42
  pc: 0x3968,
  a: 0x04,
  counter: 0x04,
};

// Path B -- counter underflows this frame: 0x8112 = 1 -> dec to 0, jr nz NOT
// taken, reload to 0x08, then jr into loc_3968.
const PATH_B = {
  steps: [0x3948, 0x3949, 0x394c, 0x394e, 0x3950, 0x3953, 0x3968],
  calls: [0x3968],
  returned: false,
  cycles: 13 + 4 + 13 + 7 + 7 + 13 + 12, // 69
  pc: 0x3968,
  a: 0x08,
  counter: 0x08,
};

test("path A: running counter decrements and runs the phase body (no reload)", () => {
  const m = makeMachine({ 0x8112: 0x05 });
  const fBefore = m.regs.f;
  loc_3945(m);
  assertPath(m, PATH_A);
  assert.notEqual(m.regs.f, fBefore, "flags were updated by dec a"); // sanity: routine ran
});

test("path B: counter underflows -> reloads to 0x08 and runs the phase body", () => {
  const m = makeMachine({ 0x8112: 0x01 });
  loc_3945(m);
  assertPath(m, PATH_B);
});

test("mutation: a corrupted reload value is caught", () => {
  // Byte-identical to loc_3945 except the reload loads 0x09 instead of 0x08.
  // Cycles are UNCHANGED (ld a,n is 7T either way and the control flow is
  // identical), so it is precisely the A-register / counter-memory assertions --
  // not the cycle count -- that must reject it.
  function loc_3945_mutant(m) {
    const { regs, mem } = m;
    regs.a = mem.read8(0x8112);
    m.step(0x3948, 13);
    regs.a = regs.dec8(regs.a);
    m.step(0x3949, 4);
    mem.write8(0x8112, regs.a);
    m.step(0x394c, 13);
    if (regs.fNZ) {
      m.step(0x3968, 12);
      return m.call(0x3968);
    }
    m.step(0x394e, 7);
    regs.a = 0x09; // BUG: should be 0x08
    m.step(0x3950, 7);
    mem.write8(0x8112, regs.a);
    m.step(0x3953, 13);
    m.step(0x3968, 12);
    return m.call(0x3968);
  }

  const m = makeMachine({ 0x8112: 0x01 });
  loc_3945_mutant(m);
  // Only the reloaded value differs (0x09 vs 0x08); cycles + step/call targets
  // are identical, so the behavioural assertion must throw on the register value.
  assert.equal(m.cycles, PATH_B.cycles, "mutation preserves the cycle total (so cycles cannot catch it)");
  assert.throws(() => assertPath(m, PATH_B), /A register/);
});
