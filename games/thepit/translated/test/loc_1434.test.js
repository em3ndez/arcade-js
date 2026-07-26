// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_1434 (ROM 0x1434-0x144b): the object-flags dispatcher.
// Entered with A = the object byte selected by loc_1420; the routine stashes it
// in L (ld l,a) and vectors to one of three handlers on TWO independent
// conditions — the 0x8075 mode byte and bits 0/1 (then the sign) of L. This
// test drives all five exit paths, asserting the exact T-state total, the
// instruction-boundary step sequence, the stashed L, the final A, and the
// tail-jump target. Because L is driven from the INCOMING A while the sign test
// reads mem[0x8075], the two are seeded independently so each condition is
// pinned on its own. It then re-runs a copy whose jr-z target is corrupted
// 0x144c -> 0x144d and proves the step/call-target assertions catch it even
// though the cycle total is unchanged (a taken jr is 12T either way).

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_1434 } from "../loc_1434.js";

// Minimal leaf-routine machine double: exactly the surface loc_1434 touches
// (regs, mem, step, call). step records its target + charges cycles; call
// records the tail-jump target WITHOUT invoking a real routine (0x144c/0x1659/
// 0x184a are separate units), so `return m.call(t)` models "control transferred
// to t and never came back". regA seeds the incoming A the routine copies to L.
function makeMachine(seed = {}, regA = 0) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x1434,
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
  m.regs.a = regA;
  return m;
}

function assertPath(m, exp) {
  assert.deepEqual(m.steps, exp.steps, "step targets");
  assert.deepEqual(m.calls, exp.calls, "call targets");
  assert.equal(m.returned, exp.returned, "early ret");
  assert.equal(m.cycles, exp.cycles, "T-state total");
  assert.equal(m.pc, exp.pc, "final PC");
  assert.equal(m.regs.a, exp.a, "A register");
  assert.equal(m.regs.l, exp.l, "L register (the stashed object byte)");
}

const PATHS = {
  // 0x8075 == 0 -> jr z into loc_144c; L holds the incoming byte, A ends 0.
  idle_144c: {
    regA: 0x03,
    seed: { 0x8075: 0x00 },
    exp: {
      steps: [0x1435, 0x1438, 0x1439, 0x144c],
      calls: [0x144c],
      returned: false,
      cycles: 4 + 13 + 4 + 12,
      pc: 0x144c,
      a: 0x00,
      l: 0x03,
    },
  },
  // 0x8075 != 0, L bit0 set -> jp nz 0x1659 (before bit1 is even tested).
  bit0_1659: {
    regA: 0x01,
    seed: { 0x8075: 0x40 },
    exp: {
      steps: [0x1435, 0x1438, 0x1439, 0x143b, 0x143d, 0x1659],
      calls: [0x1659],
      returned: false,
      cycles: 4 + 13 + 4 + 7 + 8 + 10,
      pc: 0x1659,
      a: 0x40,
      l: 0x01,
    },
  },
  // 0x8075 != 0, L bit0 clear + bit1 set -> jp nz 0x184a.
  bit1_184a: {
    regA: 0x02,
    seed: { 0x8075: 0x40 },
    exp: {
      steps: [0x1435, 0x1438, 0x1439, 0x143b, 0x143d, 0x1440, 0x1442, 0x184a],
      calls: [0x184a],
      returned: false,
      cycles: 4 + 13 + 4 + 7 + 8 + 10 + 8 + 10,
      pc: 0x184a,
      a: 0x40,
      l: 0x02,
    },
  },
  // 0x8075 negative (bit7 set), L bits 0/1 clear -> the re-test `and a` + jp m 0x1659.
  sign_neg_1659: {
    regA: 0x00,
    seed: { 0x8075: 0x80 },
    exp: {
      steps: [0x1435, 0x1438, 0x1439, 0x143b, 0x143d, 0x1440, 0x1442, 0x1445, 0x1446, 0x1659],
      calls: [0x1659],
      returned: false,
      cycles: 4 + 13 + 4 + 7 + 8 + 10 + 8 + 10 + 4 + 10,
      pc: 0x1659,
      a: 0x80,
      l: 0x00,
    },
  },
  // 0x8075 positive non-zero, L bits 0/1 clear -> jp m not taken, jp 0x184a.
  sign_pos_184a: {
    regA: 0x00,
    seed: { 0x8075: 0x05 },
    exp: {
      steps: [0x1435, 0x1438, 0x1439, 0x143b, 0x143d, 0x1440, 0x1442, 0x1445, 0x1446, 0x1449, 0x184a],
      calls: [0x184a],
      returned: false,
      cycles: 4 + 13 + 4 + 7 + 8 + 10 + 8 + 10 + 4 + 10 + 10,
      pc: 0x184a,
      a: 0x05,
      l: 0x00,
    },
  },
};

for (const [name, { regA, seed, exp }] of Object.entries(PATHS)) {
  test(`path ${name}`, () => {
    const m = makeMachine(seed, regA);
    loc_1434(m);
    assertPath(m, exp);
  });
}

test("mutation: a corrupted jr-z target is caught", () => {
  // Byte-identical to loc_1434 up through the jr z, except its target is 0x144d
  // instead of 0x144c. A taken jr is 12T either way, so the cycle total is
  // UNCHANGED; it is precisely the step/call-target assertions that must reject
  // it — not the cycle count.
  function loc_1434_mutant(m) {
    const { regs, mem } = m;
    regs.l = regs.a;
    m.step(0x1435, 4);
    regs.a = mem.read8(0x8075);
    m.step(0x1438, 13);
    regs.and(regs.a);
    m.step(0x1439, 4);
    if (regs.fZ) {
      m.step(0x144d, 12); // BUG: should be 0x144c
      return m.call(0x144d); // BUG: should be 0x144c
    }
    // (non-idle paths are irrelevant to this mutation and omitted)
  }

  const m = makeMachine(PATHS.idle_144c.seed, PATHS.idle_144c.regA);
  loc_1434_mutant(m);
  // Only the tail-jump target differs (0x144d vs 0x144c); cycles are identical,
  // so the step-target assertion is what must throw.
  assert.equal(m.cycles, PATHS.idle_144c.exp.cycles, "mutation preserves the cycle total");
  assert.throws(() => assertPath(m, PATHS.idle_144c.exp), /step targets/);
});
