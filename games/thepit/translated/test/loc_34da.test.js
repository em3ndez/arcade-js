// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_34da (ROM 0x34DA-0x34EF): per-call tick housekeeping for
// two work-RAM counters. The routine has THREE exit paths and the test exercises
// each one, asserting the exact T-state total, the instruction-boundary step
// sequence, the final A register, the two counter bytes (0x8090 / 0x8085), and
// the control-flow outcome (which ret vs the 0x34f0 tail-jump). It then re-runs a
// copy whose `and 0xf7` is corrupted to `and 0xff` and proves the value
// assertions catch it even though the cycle total is unchanged.

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_34da } from "../loc_34da.js";

// Minimal leaf-routine machine double: exactly the surface loc_34da touches
// (regs, mem, step, ret, call). step records its target + charges cycles; ret
// records the early return + charges cycles; call records the tail-jump target
// WITHOUT invoking a real routine (0x34f0 is a separate unit), so `return
// m.call(0x34f0)` models "control transferred to 0x34f0 and never came back".
function makeMachine(seed = {}) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x34da,
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
  assert.equal(m.mem.read8(0x8090), exp.c90, "0x8090 tick counter");
  assert.equal(m.mem.read8(0x8085), exp.c85, "0x8085 second counter");
}

// Path A -- counter wraps: 0x8090 = 0xFF -> inc to 0x00, Z set, tail-jump 0x34f0.
// The 0x8085 counter and the 4th-tick logic are never reached.
const PATH_A = {
  steps: [0x34dd, 0x34de, 0x34e1, 0x34f0],
  calls: [0x34f0],
  returned: false,
  cycles: 13 + 4 + 13 + 12, // 42 (jr z taken = 12)
  pc: 0x34f0,
  a: 0x00,
  c90: 0x00, // 0xFF + 1 wrapped
  c85: 0x77, // untouched
};

// Path B -- non-4th tick: 0x8090 = 0x10 -> inc to 0x11, Z clear (no wrap),
// jr z NOT taken, (0x11 & 3) = 1 != 0 so `ret nz` fires. No second counter work.
const PATH_B = {
  steps: [0x34dd, 0x34de, 0x34e1, 0x34e3, 0x34e5],
  calls: [],
  returned: true,
  cycles: 13 + 4 + 13 + 7 + 7 + 11, // 55 (jr z not taken = 7, ret nz taken = 11)
  pc: 0x34e5, // ret nz opcode; ret stub leaves pc there
  a: 0x01, // tick & 3
  c90: 0x11,
  c85: 0x77, // untouched -- toggle path not reached
};

// Path C -- 4th tick: 0x8090 = 0x13 -> inc to 0x14, (0x14 & 3) == 0, ret nz NOT
// taken, second counter advances. 0x8085 = 0x07 -> inc 0x08 -> and 0xf7 = 0x00
// (the increment set bit 3 and the mask clears it back to zero).
const PATH_C = {
  steps: [0x34dd, 0x34de, 0x34e1, 0x34e3, 0x34e5, 0x34e6, 0x34e9, 0x34ea, 0x34ec, 0x34ef],
  calls: [],
  returned: true,
  cycles: 13 + 4 + 13 + 7 + 7 + 5 + 13 + 4 + 7 + 13 + 10, // 96 (incl. final ret)
  pc: 0x34ef,
  a: 0x00, // 0x08 & 0xf7
  c90: 0x14,
  c85: 0x00,
};

test("path A: tick counter wraps 0xFF->0x00 -> vectors to 0x34f0", () => {
  const m = makeMachine({ 0x8090: 0xff, 0x8085: 0x77 });
  loc_34da(m);
  assertPath(m, PATH_A);
});

test("path B: non-4th tick -> ret nz, second counter untouched", () => {
  const m = makeMachine({ 0x8090: 0x10, 0x8085: 0x77 });
  loc_34da(m);
  assertPath(m, PATH_B);
});

test("path C: 4th tick -> second counter incremented with bit 3 held clear", () => {
  const m = makeMachine({ 0x8090: 0x13, 0x8085: 0x07 });
  loc_34da(m);
  assertPath(m, PATH_C);
  // The `and 0xf7` clears bit 3 specifically: 0x07 + 1 = 0x08 (bit 3 set) -> 0x00.
  assert.equal(m.mem.read8(0x8085) & 0x08, 0x00, "bit 3 of 0x8085 forced clear");
});

test("mutation: `and 0xff` for `and 0xf7` on the second counter is caught", () => {
  // Byte-identical to loc_34da except the mask on the 0x8085 counter is 0xff
  // (a no-op) instead of 0xf7. Cycles are UNCHANGED (and n is 7T either way), so
  // it is precisely the value assertions -- not the cycle count -- that must
  // reject it: with 0x8085 = 0x07 the increment yields 0x08, and the mutant
  // leaves it 0x08 (bit 3 still set) where the real routine forces it to 0x00.
  function loc_34da_mutant(m) {
    const { regs, mem } = m;
    regs.a = mem.read8(0x8090);
    m.step(0x34dd, 13);
    regs.a = regs.inc8(regs.a);
    m.step(0x34de, 4);
    mem.write8(0x8090, regs.a);
    m.step(0x34e1, 13);
    if (regs.fZ) {
      m.step(0x34f0, 12);
      return m.call(0x34f0);
    }
    m.step(0x34e3, 7);
    regs.and(0x03);
    m.step(0x34e5, 7);
    if (regs.fNZ) {
      m.ret(11);
      return;
    }
    m.step(0x34e6, 5);
    regs.a = mem.read8(0x8085);
    m.step(0x34e9, 13);
    regs.a = regs.inc8(regs.a);
    m.step(0x34ea, 4);
    regs.and(0xff); // BUG: should be and 0xf7 (must clear bit 3)
    m.step(0x34ec, 7);
    mem.write8(0x8085, regs.a);
    m.step(0x34ef, 13);
    m.ret();
  }

  const m = makeMachine({ 0x8090: 0x13, 0x8085: 0x07 });
  loc_34da_mutant(m);
  // Cycles are identical to the real Path C, so only the value/register checks
  // can reject the mutant.
  assert.equal(m.cycles, PATH_C.cycles, "mutation preserves the cycle total (so cycles cannot catch it)");
  assert.equal(m.mem.read8(0x8085), 0x08, "mutant left bit 3 set -> 0x08");
  assert.throws(() => assertPath(m, PATH_C), /0x8085 second counter|A register/);
});
