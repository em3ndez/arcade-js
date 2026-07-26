// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_1659 (ROM 0x1659-0x167e): recompute an actor's position
// relative to the reference at 0x806c, store the delta back to 0x8068, then derive
//   phase   = (0x8068 + 3) & 7           (kept in E)
//   0x8075  = (phase == 0) ? 0 : 0xff    (moving flag)
//   0x8069  = (phase & 2) ? 0xb3 : 0xb2  (sprite code)
// before the tail-jump to the record builder at 0x1b5b. Both `jr z` read a Z flag
// set by a PRECEDING `and` (0x07 then 0x02), each with a flag-neutral instruction
// wedged between the `and` and the branch (`ld e,a`, then the pre-loaded `ld a,0xb2`).
//
// This test drives all THREE reachable paths -- phase==0 (both jr taken),
// phase!=0 with bit1 set (both not taken), phase!=0 with bit1 clear (first not
// taken / second taken) -- asserting the exact T-state total, the instruction-
// boundary step sequence, the tail-jump target, the residual A, and the three
// memory writes. A fourth combination (phase==0 with bit1 set) is impossible since
// phase 0 has bit 1 clear.
//
// The MUTATION corrupts `and 0x02` -> `and 0x04` (tests the wrong phase bit): on
// phase 3 the real routine takes the fall-through and writes 0xb3, the mutant takes
// the jr and writes 0xb2 -- so the step sequence, the cycle total, A, AND mem[0x8069]
// all diverge, and assertPath must reject it.

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_1659 } from "../loc_1659.js";

// Minimal leaf-routine machine double: the surface loc_1659 touches (regs, mem,
// step, call). step records its target + charges cycles; call records the tail-jump
// target WITHOUT invoking a real routine (0x1b5b is a separate unit), so
// `return m.call(0x1b5b)` models "control transferred there and never came back".
// loc_1659 has NO register inputs -- E is set internally from mem[0x806c].
function makeMachine(seed = {}) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x1659,
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
  for (const [addr, val] of Object.entries(exp.mem)) {
    assert.equal(m.mem.read8(Number(addr)), val, `mem[0x${Number(addr).toString(16)}]`);
  }
}

// Common prefix step targets, up to and INCLUDING the `ld e,a` at 0x1668 (whose
// next boundary is 0x1669). The two jr's own step targets differ per path.
const PREFIX = [0x165c, 0x165d, 0x1660, 0x1661, 0x1664, 0x1666, 0x1668, 0x1669];
const PREFIX_T = 13 + 4 + 13 + 4 + 13 + 7 + 7 + 4; // 65

const PATHS = {
  // phase == 0 -> both jr taken. 0x8075 = 0, 0x8069 = 0xb2, A = 0xb2.
  phase0_both_taken: {
    seed: { 0x806c: 0x00, 0x8068: 0x05 },
    exp: {
      steps: [...PREFIX, 0x166d, 0x1670, 0x1671, 0x1673, 0x1675, 0x1679, 0x167c, 0x1b5b],
      calls: [0x1b5b],
      returned: false,
      cycles: PREFIX_T + 12 + 13 + 4 + 7 + 7 + 12 + 13 + 10, // 143
      pc: 0x1b5b,
      a: 0xb2,
      mem: { 0x8068: 0x05, 0x8075: 0x00, 0x8069: 0xb2 },
    },
  },
  // phase == 3 (bit1 set) -> both jr NOT taken. 0x8075 = 0xff, 0x8069 = 0xb3, A = 0xb3.
  phase3_both_nottaken: {
    seed: { 0x806c: 0x10, 0x8068: 0x18 },
    exp: {
      steps: [
        ...PREFIX,
        0x166b, 0x166d, 0x1670, 0x1671, 0x1673, 0x1675, 0x1677, 0x1679, 0x167c, 0x1b5b,
      ],
      calls: [0x1b5b],
      returned: false,
      cycles: PREFIX_T + 7 + 7 + 13 + 4 + 7 + 7 + 7 + 7 + 13 + 10, // 147
      pc: 0x1b5b,
      a: 0xb3,
      mem: { 0x8068: 0x08, 0x8075: 0xff, 0x8069: 0xb3 },
    },
  },
  // phase == 1 (nonzero, bit1 clear) -> first jr NOT taken, second jr taken.
  // 0x8075 = 0xff, 0x8069 = 0xb2, A = 0xb2.
  phase1_split: {
    seed: { 0x806c: 0x00, 0x8068: 0x06 },
    exp: {
      steps: [
        ...PREFIX,
        0x166b, 0x166d, 0x1670, 0x1671, 0x1673, 0x1675, 0x1679, 0x167c, 0x1b5b,
      ],
      calls: [0x1b5b],
      returned: false,
      cycles: PREFIX_T + 7 + 7 + 13 + 4 + 7 + 7 + 12 + 13 + 10, // 145
      pc: 0x1b5b,
      a: 0xb2,
      mem: { 0x8068: 0x06, 0x8075: 0xff, 0x8069: 0xb2 },
    },
  },
};

for (const [name, { seed, exp }] of Object.entries(PATHS)) {
  test(`path ${name}`, () => {
    const m = makeMachine(seed);
    loc_1659(m);
    assertPath(m, exp);
  });
}

// Sanity anchor: 0x8068 is genuinely rewritten as (position - reference), and the
// reference at 0x806c really participates. 0x8068=0x18, 0x806c=0x10 -> stored 0x08.
test("0x8068 is rewritten as (0x8068 - 0x806c)", () => {
  const m = makeMachine({ 0x806c: 0x10, 0x8068: 0x18 });
  loc_1659(m);
  assert.equal(m.mem.read8(0x8068), 0x08, "delta stored back to 0x8068");
});

test("mutation: testing the wrong phase bit (and 0x02 -> and 0x04) is caught", () => {
  // Byte-identical to loc_1659 except the second `and 0x02` becomes `and 0x04`.
  // On phase 3 (bit1 set, bit2 clear) the real routine falls through to 0xb3; the
  // mutant sees Z (bit2 clear) and takes the jr, keeping 0xb2 -- diverging in the
  // step sequence, the cycle total, A, and mem[0x8069].
  function loc_1659_mutant(m) {
    const { regs, mem } = m;
    regs.a = mem.read8(0x806c);
    m.step(0x165c, 13);
    regs.e = regs.a;
    m.step(0x165d, 4);
    regs.a = mem.read8(0x8068);
    m.step(0x1660, 13);
    regs.sub(regs.e);
    m.step(0x1661, 4);
    mem.write8(0x8068, regs.a);
    m.step(0x1664, 13);
    regs.add(0x03);
    m.step(0x1666, 7);
    regs.and(0x07);
    m.step(0x1668, 7);
    regs.e = regs.a;
    m.step(0x1669, 4);
    if (regs.fZ) {
      m.step(0x166d, 12);
    } else {
      m.step(0x166b, 7);
      regs.a = 0xff;
      m.step(0x166d, 7);
    }
    mem.write8(0x8075, regs.a);
    m.step(0x1670, 13);
    regs.a = regs.e;
    m.step(0x1671, 4);
    regs.and(0x04); // BUG: should be and 0x02
    m.step(0x1673, 7);
    regs.a = 0xb2;
    m.step(0x1675, 7);
    if (regs.fZ) {
      m.step(0x1679, 12);
    } else {
      m.step(0x1677, 7);
      regs.a = 0xb3;
      m.step(0x1679, 7);
    }
    mem.write8(0x8069, regs.a);
    m.step(0x167c, 13);
    m.step(0x1b5b, 10);
    return m.call(0x1b5b);
  }

  const m = makeMachine(PATHS.phase3_both_nottaken.seed);
  loc_1659_mutant(m);
  // The mutation is a real behavioural break: sprite code + A come out wrong.
  assert.equal(m.mem.read8(0x8069), 0xb2, "mutant writes the wrong sprite code");
  assert.equal(m.regs.a, 0xb2, "mutant leaves the wrong A");
  assert.throws(() => assertPath(m, PATHS.phase3_both_nottaken.exp), /step targets/);
});
