// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_3968 (ROM 0x3968-0x3983): the every-4th-tick position
// stepper that pulls the coordinate 0x810a down by one once it reaches 0xc1 and
// mirrors coord+0x10 to the sprite-shadow 0x811b. A single basic block with
// THREE tail-jump exits, all to 0x3a4c, and no `ret` of its own. The test drives
// the three representative paths -- the not-a-4th-tick early tail-out, the
// below-limit tail-out, and the at/above-limit decrement -- asserting the exact
// T-state total, the instruction-boundary step sequence, the tail-jump target,
// the final PC/A, and every memory byte written. It then re-runs a copy whose
// `add a,0x10` (the sprite mirror) is corrupted to `add a,0x20` and proves the
// value assertions catch it even though the cycle total is unchanged (add a,n is
// 7T either way).

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_3968 } from "../loc_3968.js";

// Leaf-routine machine double: exactly the surface loc_3968 touches (regs, mem,
// step, call). `step` records its target + charges cycles; `call` records a
// transfer target WITHOUT invoking a real routine -- for a tail-jump
// `return m.call(addr)` models "control transferred there and never came back".
function makeMachine(seed = {}) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x3968,
    steps: [],
    calls: [],
    returned: false,
    ret(cycles = 10) {
      this.cycles += cycles;
      this.returned = true;
    },
    call(addr) {
      this.calls.push(addr);
      return undefined; // callee's own ret returns to OUR caller (tail-jump)
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
  assert.deepEqual(m.calls, exp.calls, "call / tail-jump targets");
  assert.equal(m.returned, exp.returned ?? false, "direct ret?");
  assert.equal(m.cycles, exp.cycles, "T-state total");
  assert.equal(m.pc, exp.pc, "final PC");
  assert.equal(m.regs.a, exp.a, "A register");
  for (const [addr, val] of Object.entries(exp.mem)) {
    assert.equal(m.mem.read8(Number(addr)), val, `mem[0x${Number(addr).toString(16)}]`);
  }
}

// The actor bytes, so paths can assert the ones they leave untouched.
const CTX = { 0x8112: 0x55, 0x810a: 0x55, 0x811b: 0x55 };

// --- Path A: (timer & 3) != 0 -> early tail-jump 0x3a4c, nothing moves ----------
test("path A: not a 4th tick -> early tail-jump 0x3a4c", () => {
  const m = makeMachine({ ...CTX, 0x8112: 0x06 }); // 0x06 & 3 = 2 (nz)
  loc_3968(m);
  assertPath(m, {
    steps: [0x396b, 0x396d, 0x3a4c],
    calls: [0x3a4c],
    cycles: 13 + 7 + 10, // 30
    pc: 0x3a4c,
    a: 0x02, // and 0x03 of 0x06
    mem: { 0x8112: 0x06, 0x810a: 0x55, 0x811b: 0x55 }, // nothing moved
  });
});

// --- Path B: 4th tick, coord < 0xc1 -> tail-jump 0x3a4c, coord unchanged --------
test("path B: 4th tick but coord < 0xc1 -> tail-jump 0x3a4c, no move", () => {
  const m = makeMachine({ ...CTX, 0x8112: 0x04, 0x810a: 0x80 }); // 0x04 & 3 = 0; 0x80 < 0xc1 (carry)
  loc_3968(m);
  assertPath(m, {
    steps: [0x396b, 0x396d, 0x3970, 0x3973, 0x3975, 0x3a4c],
    calls: [0x3a4c],
    cycles: 13 + 7 + 10 + 13 + 7 + 10, // 60
    pc: 0x3a4c,
    a: 0x80, // cp leaves A = the coordinate
    mem: { 0x810a: 0x80, 0x811b: 0x55 }, // coord + mirror untouched
  });
});

// --- Path C: 4th tick, coord >= 0xc1 -> decrement + mirror, tail-jump 0x3a4c -----
test("path C: coord >= 0xc1 -> decrement 0x810a, mirror coord+0x10 -> tail 0x3a4c", () => {
  const m = makeMachine({ ...CTX, 0x8112: 0x08, 0x810a: 0xc1 }); // 0x08 & 3 = 0; 0xc1 >= 0xc1 (no carry)
  loc_3968(m);
  assertPath(m, {
    steps: [0x396b, 0x396d, 0x3970, 0x3973, 0x3975, 0x3978, 0x3979, 0x397c, 0x397e, 0x3981, 0x3a4c],
    calls: [0x3a4c],
    cycles: 13 + 7 + 10 + 13 + 7 + 10 + 4 + 13 + 7 + 13 + 10, // 107
    pc: 0x3a4c,
    a: 0xd0, // 0xc1 -> dec 0xc0 -> +0x10 = 0xd0
    mem: {
      0x810a: 0xc0, // coordinate decremented
      0x811b: 0xd0, // (coord-1) + 0x10 sprite-shadow
      0x8112: 0x08, // timer untouched
    },
  });
});

// --- Boundary: coord == 0xc0 (just below the limit) takes the tail-out path ------
test("boundary: coord 0xc0 is below 0xc1 -> tail-out, no decrement", () => {
  const m = makeMachine({ ...CTX, 0x8112: 0x00, 0x810a: 0xc0 }); // 0xc0 < 0xc1 -> carry -> tail out
  loc_3968(m);
  assert.deepEqual(m.steps, [0x396b, 0x396d, 0x3970, 0x3973, 0x3975, 0x3a4c]);
  assert.equal(m.mem.read8(0x810a), 0xc0, "coord unchanged at the boundary");
  assert.equal(m.cycles, 60);
});

// --- Mutation: `add a,0x10` (0x397c, the sprite mirror) corrupted to `add a,0x20` -
test("mutation: `add a,0x20` for `add a,0x10` on the sprite mirror is caught", () => {
  // Byte-identical to loc_3968 except the mirror at 0x397c adds 0x20 instead of
  // 0x10. Cycles are UNCHANGED (add a,n is 7T either way), so only the value
  // assertions can reject it: coord 0xc1 -> dec 0xc0, mirror becomes 0xc0 + 0x20
  // = 0xe0 instead of 0xc0 + 0x10 = 0xd0.
  function loc_3968_mutant(m) {
    const { regs, mem } = m;
    regs.a = mem.read8(0x8112); m.step(0x396b, 13);
    regs.and(0x03); m.step(0x396d, 7);
    if (regs.fNZ) { m.step(0x3a4c, 10); return m.call(0x3a4c); }
    m.step(0x3970, 10);
    regs.a = mem.read8(0x810a); m.step(0x3973, 13);
    regs.cp(0xc1); m.step(0x3975, 7);
    if (regs.fC) { m.step(0x3a4c, 10); return m.call(0x3a4c); }
    m.step(0x3978, 10);
    regs.a = regs.dec8(regs.a); m.step(0x3979, 4);
    mem.write8(0x810a, regs.a); m.step(0x397c, 13);
    regs.add(0x20); m.step(0x397e, 7); // BUG: should be add a,0x10
    mem.write8(0x811b, regs.a); m.step(0x3981, 13);
    m.step(0x3a4c, 10); return m.call(0x3a4c);
  }

  const m = makeMachine({ ...CTX, 0x8112: 0x08, 0x810a: 0xc1 });
  loc_3968_mutant(m);
  // Cycles are identical to the real Path C, so only the value checks reject it.
  assert.equal(m.cycles, 107, "mutation preserves the cycle total (so cycles cannot catch it)");
  assert.equal(m.mem.read8(0x811b), 0xe0, "mutant mirror = (coord-1) + 0x20, not + 0x10");
  assert.throws(
    () =>
      assertPath(m, {
        steps: [0x396b, 0x396d, 0x3970, 0x3973, 0x3975, 0x3978, 0x3979, 0x397c, 0x397e, 0x3981, 0x3a4c],
        calls: [0x3a4c],
        cycles: 107,
        pc: 0x3a4c,
        a: 0xe0,
        mem: { 0x811b: 0xd0 }, // the correct value the real routine writes
      }),
    /mem\[0x811b\]/,
  );
});
