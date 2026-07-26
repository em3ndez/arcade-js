// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_144c (ROM 0x144c-0x1467): the "mode-idle" object
// dispatcher, entered from loc_1434 with the selected object byte still in L.
// It vectors on L's bits: bit0 -> 0x1493; else bit1 -> 0x167f; else on
// (L & 0x0c) -> 0x1468; else it zeroes 0x801a and defers to 0x186f/0x1b5b
// depending on mem[0x80e7]. This test drives all FIVE exit paths, asserting the
// exact T-state total, the instruction-boundary step sequence, the residual A/L,
// the tail-jump target, and — on the fall-through paths — that 0x801a was written
// with 0. L is seeded to values that isolate each condition (0x10 in particular
// proves `and 0x0c` masks off bit4 so the byte counts as "idle"). It then re-runs
// a copy whose `jr nz` target is corrupted 0x1468 -> 0x1469 and proves the
// step/call-target assertions catch it even though the cycle total is unchanged
// (a taken jr is 12T either way).

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_144c } from "../loc_144c.js";

// Minimal leaf-routine machine double: exactly the surface loc_144c touches
// (regs, mem, step, call). step records its target + charges cycles; call
// records the tail-jump target WITHOUT invoking a real routine (0x1493/0x167f/
// 0x1468/0x186f/0x1b5b are separate units), so `return m.call(t)` models
// "control transferred to t and never came back". regL seeds the object byte
// the routine was handed in L.
function makeMachine(seed = {}, regL = 0) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x144c,
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
  m.regs.l = regL;
  return m;
}

function assertPath(m, exp) {
  assert.deepEqual(m.steps, exp.steps, "step targets");
  assert.deepEqual(m.calls, exp.calls, "call targets");
  assert.equal(m.returned, exp.returned, "early ret");
  assert.equal(m.cycles, exp.cycles, "T-state total");
  assert.equal(m.pc, exp.pc, "final PC");
  assert.equal(m.regs.a, exp.a, "A register");
  assert.equal(m.regs.l, exp.l, "L register");
  if (exp.mem801a !== undefined) {
    assert.equal(m.mem.read8(0x801a), exp.mem801a, "0x801a");
  }
}

const PATHS = {
  // L bit0 set -> jp nz 0x1493 immediately; A untouched, L preserved.
  bit0_1493: {
    regL: 0x01,
    seed: {},
    exp: {
      steps: [0x144e, 0x1493],
      calls: [0x1493],
      returned: false,
      cycles: 8 + 10,
      pc: 0x1493,
      a: 0x00,
      l: 0x01,
    },
  },
  // L bit0 clear, bit1 set -> jp nz 0x167f.
  bit1_167f: {
    regL: 0x02,
    seed: {},
    exp: {
      steps: [0x144e, 0x1451, 0x1453, 0x167f],
      calls: [0x167f],
      returned: false,
      cycles: 8 + 10 + 8 + 10,
      pc: 0x167f,
      a: 0x00,
      l: 0x02,
    },
  },
  // L bits0/1 clear, bit2 set -> ld a,l / and 0x0c nonzero -> jr nz 0x1468.
  bits23_1468: {
    regL: 0x04,
    seed: {},
    exp: {
      steps: [0x144e, 0x1451, 0x1453, 0x1456, 0x1457, 0x1459, 0x1468],
      calls: [0x1468],
      returned: false,
      cycles: 8 + 10 + 8 + 10 + 4 + 7 + 12,
      pc: 0x1468,
      a: 0x04,
      l: 0x04,
    },
  },
  // L bits0..3 clear under the 0x0c mask (0x10 masks to 0) + mem[0x80e7] != 0
  // -> zero 0x801a, then jp nz 0x186f.
  deferred_186f: {
    regL: 0x10,
    seed: { 0x80e7: 0x05, 0x801a: 0xff },
    exp: {
      steps: [0x144e, 0x1451, 0x1453, 0x1456, 0x1457, 0x1459, 0x145b, 0x145e, 0x1461, 0x1462, 0x186f],
      calls: [0x186f],
      returned: false,
      cycles: 8 + 10 + 8 + 10 + 4 + 7 + 7 + 13 + 13 + 4 + 10,
      pc: 0x186f,
      a: 0x05,
      l: 0x10,
      mem801a: 0x00,
    },
  },
  // Same but mem[0x80e7] == 0 -> jp nz not taken, jp 0x1b5b (defer the frame).
  deferred_1b5b: {
    regL: 0x10,
    seed: { 0x80e7: 0x00, 0x801a: 0xff },
    exp: {
      steps: [0x144e, 0x1451, 0x1453, 0x1456, 0x1457, 0x1459, 0x145b, 0x145e, 0x1461, 0x1462, 0x1465, 0x1b5b],
      calls: [0x1b5b],
      returned: false,
      cycles: 8 + 10 + 8 + 10 + 4 + 7 + 7 + 13 + 13 + 4 + 10 + 10,
      pc: 0x1b5b,
      a: 0x00,
      l: 0x10,
      mem801a: 0x00,
    },
  },
};

for (const [name, { regL, seed, exp }] of Object.entries(PATHS)) {
  test(`path ${name}`, () => {
    const m = makeMachine(seed, regL);
    loc_144c(m);
    assertPath(m, exp);
  });
}

test("mutation: a corrupted jr-nz target is caught", () => {
  // Byte-identical to loc_144c up through the jr nz, except its target is 0x1469
  // instead of 0x1468. A taken jr is 12T either way, so the cycle total is
  // UNCHANGED; it is precisely the step/call-target assertions that must reject
  // it — not the cycle count.
  function loc_144c_mutant(m) {
    const { regs } = m;
    regs.bit(0, regs.l);
    m.step(0x144e, 8);
    if (regs.fNZ) {
      m.step(0x1493, 10);
      return m.call(0x1493);
    }
    m.step(0x1451, 10);
    regs.bit(1, regs.l);
    m.step(0x1453, 8);
    if (regs.fNZ) {
      m.step(0x167f, 10);
      return m.call(0x167f);
    }
    m.step(0x1456, 10);
    regs.a = regs.l;
    m.step(0x1457, 4);
    regs.and(0x0c);
    m.step(0x1459, 7);
    if (regs.fNZ) {
      m.step(0x1469, 12); // BUG: should be 0x1468
      return m.call(0x1469); // BUG: should be 0x1468
    }
    // (fall-through paths are irrelevant to this mutation and omitted)
  }

  const m = makeMachine(PATHS.bits23_1468.seed, PATHS.bits23_1468.regL);
  loc_144c_mutant(m);
  // Only the tail-jump target differs (0x1469 vs 0x1468); cycles are identical,
  // so the step-target assertion is what must throw.
  assert.equal(m.cycles, PATHS.bits23_1468.exp.cycles, "mutation preserves the cycle total");
  assert.throws(() => assertPath(m, PATHS.bits23_1468.exp), /step targets/);
});
