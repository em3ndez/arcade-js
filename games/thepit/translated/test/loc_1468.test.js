// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_1468 (ROM 0x1468-0x1490): the "(L & 0x0c) != 0" arm of
// the mode-idle object dispatcher, entered from loc_144c with the object byte in
// L. It reconciles the phase byte at 0x801a against L, then either dispatches on
// L bit2 (0x186a / 0x1a02) or defers the frame (0x1b5b). This test drives every
// internal branch and all three exits:
//   - phase already == L, L bit2 set   -> loc_1468_disp -> jp nz 0x186a
//   - phase already == L, L bit2 clear -> loc_1468_disp -> jp 0x1a02
//   - phase == 0                        -> seed 0x801a = L|0xc0 -> disp -> 0x186a
//   - phase != 0/!=L, masked == L       -> loc_1468_adj -> jp z 0x1b5b
//   - phase != 0/!=L, masked != L       -> loc_1468_adj -> snap 0x801a=L, 0x1b5b
// Each path asserts the exact T-state total, the instruction-boundary step
// sequence, the tail-jump target, the residual A/L, and the value written to
// 0x801a. It then re-runs a mutant whose FIRST `jr z` target is corrupted
// 0x148b -> 0x148c and proves the step-target assertion catches it even though a
// taken jr is 12T either way (the cycle total is unchanged).

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_1468, loc_1468_disp } from "../loc_1468.js";

// Minimal leaf-routine machine double: exactly the surface loc_1468 touches
// (regs, mem, step, call). step records its target + charges cycles; call
// records the tail-jump target WITHOUT invoking a real routine (0x186a/0x1a02/
// 0x1b5b are separate units), so `return m.call(t)` models "control transferred
// to t and never came back". regL seeds the object byte handed to us in L.
function makeMachine(seed = {}, regL = 0) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x1468,
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
  // phase (0x801a) already == L, L bit2 set -> disp -> jp nz 0x186a.
  eq_disp_186a: {
    regL: 0x04,
    seed: { 0x801a: 0x04 },
    exp: {
      steps: [0x146b, 0x146c, 0x148b, 0x148d, 0x186a],
      calls: [0x186a],
      returned: false,
      cycles: 13 + 4 + 12 + 8 + 10,
      pc: 0x186a,
      a: 0x04,
      l: 0x04,
      mem801a: 0x04,
    },
  },
  // phase already == L, L bit2 clear -> disp -> jp 0x1a02.
  eq_disp_1a02: {
    regL: 0x02,
    seed: { 0x801a: 0x02 },
    exp: {
      steps: [0x146b, 0x146c, 0x148b, 0x148d, 0x1490, 0x1a02],
      calls: [0x1a02],
      returned: false,
      cycles: 13 + 4 + 12 + 8 + 10 + 10,
      pc: 0x1a02,
      a: 0x02,
      l: 0x02,
      mem801a: 0x02,
    },
  },
  // phase == 0 (and L != 0) -> and a gives Z -> seed 0x801a = L|0xc0, then the
  // dispatch runs; L=0x05 has bit2 set so it exits jp nz 0x186a.
  seed_disp_186a: {
    regL: 0x05,
    seed: { 0x801a: 0x00 },
    exp: {
      steps: [0x146b, 0x146c, 0x146e, 0x146f, 0x1471, 0x1472, 0x1474, 0x1477, 0x148b, 0x148d, 0x186a],
      calls: [0x186a],
      returned: false,
      cycles: 13 + 4 + 7 + 4 + 7 + 4 + 7 + 13 + 12 + 8 + 10,
      pc: 0x186a,
      a: 0xc5, // 0x05 | 0xc0
      l: 0x05,
      mem801a: 0xc5,
    },
  },
  // phase != 0 and != L -> loc_1468_adj. 0x2c - 0x20 = 0x0c; (0x0c & 0x0c) == L
  // -> jp z 0x1b5b. 0x801a is left holding the decremented 0x0c.
  adj_match_1b5b: {
    regL: 0x0c,
    seed: { 0x801a: 0x2c },
    exp: {
      steps: [0x146b, 0x146c, 0x146e, 0x146f, 0x1479, 0x147b, 0x147e, 0x1480, 0x1481, 0x1b5b],
      calls: [0x1b5b],
      returned: false,
      cycles: 13 + 4 + 7 + 4 + 12 + 7 + 13 + 7 + 4 + 10,
      pc: 0x1b5b,
      a: 0x0c,
      l: 0x0c,
      mem801a: 0x0c,
    },
  },
  // phase != 0 and != L -> loc_1468_adj. 0x30 - 0x20 = 0x10; (0x10 & 0x0c) == 0
  // != L(0x08) -> not the match branch: snap 0x801a = L, jp 0x1b5b.
  adj_snap_1b5b: {
    regL: 0x08,
    seed: { 0x801a: 0x30 },
    exp: {
      steps: [
        0x146b, 0x146c, 0x146e, 0x146f, 0x1479, 0x147b, 0x147e, 0x1480, 0x1481,
        0x1484, 0x1485, 0x1488, 0x1b5b,
      ],
      calls: [0x1b5b],
      returned: false,
      cycles: 13 + 4 + 7 + 4 + 12 + 7 + 13 + 7 + 4 + 10 + 4 + 13 + 10,
      pc: 0x1b5b,
      a: 0x08,
      l: 0x08,
      mem801a: 0x08,
    },
  },
};

for (const [name, { regL, seed, exp }] of Object.entries(PATHS)) {
  test(`path ${name}`, () => {
    const m = makeMachine(seed, regL);
    loc_1468(m);
    assertPath(m, exp);
  });
}

test("mutation: a corrupted internal jr-z target is caught", () => {
  // Byte-identical to loc_1468's entry up through `jr z,0x148b`, except its taken
  // target is 0x148c instead of 0x148b. A taken jr is 12T either way, so the
  // cycle total is UNCHANGED; it is precisely the step-target assertion that must
  // reject it — the real loc_1468_disp helper still runs and emits 0x148d/0x186a,
  // so only the one corrupted step (0x148c vs 0x148b) differs.
  function loc_1468_mutant(m) {
    const { regs, mem } = m;
    regs.a = mem.read8(0x801a);
    m.step(0x146b, 13);
    regs.cp(regs.l);
    m.step(0x146c, 4);
    if (regs.fZ) {
      m.step(0x148c, 12); // BUG: should be 0x148b
      return loc_1468_disp(m);
    }
    // (the phase-non-zero / seed paths are irrelevant to this mutation, omitted)
  }

  const { regL, seed, exp } = PATHS.eq_disp_186a;
  const m = makeMachine(seed, regL);
  loc_1468_mutant(m);
  // Only the internal jump target differs (0x148c vs 0x148b); cycles are
  // identical, so the step-target assertion is what must throw.
  assert.equal(m.cycles, exp.cycles, "mutation preserves the cycle total");
  assert.throws(() => assertPath(m, exp), /step targets/);
});
