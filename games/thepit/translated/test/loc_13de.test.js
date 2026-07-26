// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_13de (ROM 0x13de-0x141f): the main player/state
// dispatcher body. The routine is one long guard chain with ELEVEN exit points
// (two conditional rets, eight tail-jumps, and a fall-through into loc_1420).
// This test drives every one, asserting the exact T-state total, the
// instruction-boundary step sequence, the final A register (and DE where the
// routine loads it), and the control-flow outcome (ret vs which tail-jump
// target). It then re-runs a copy whose FIRST tail-jump target (0x1b5b) is
// corrupted to 0x1b5c and proves the step/call-target assertions catch it even
// though the cycle total is unchanged (jp cc is 10T taken or not).

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_13de } from "../loc_13de.js";

// Minimal leaf-routine machine double: exactly the surface loc_13de touches
// (regs, mem, step, ret, call). step records its target + charges cycles; ret
// records the early return + charges cycles; call records the tail-jump target
// WITHOUT invoking a real routine (0x1b5b/0x186a/0x1659/... and loc_1420 are all
// separate units), so `return m.call(t)` models "control transferred to t and
// never came back".
function makeMachine(seed = {}) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x13de,
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

// Shared step prefixes, so each path's expected list stays readable.
// P1: after the 0x807a/or gate falls through (jp nz not taken).
const P1 = [0x13e1, 0x13e2, 0x13e5];
// P2: after ret z (0x8079) not taken.
const P2 = [...P1, 0x13e8, 0x13e9, 0x13ea];
// P3: after ret nz (0x807b) not taken.
const P3 = [...P2, 0x13ed, 0x13ee, 0x13ef];
// P4: DE loaded, 0x80c1 read + dec.
const P4 = [...P3, 0x13f2, 0x13f3, 0x13f6, 0x13f7, 0x13fa, 0x13fb];
// P5: 0x80c1 dec/inc probe fell through (== 0), 0x8075 read + and.
const P5 = [...P4, 0x13fe, 0x13ff, 0x1402, 0x1405, 0x1406];
// P6: 0x8075 == 0 (jp m + jp nz both not taken), 0x80e7 read + and.
const P6 = [...P5, 0x1409, 0x140c, 0x140f, 0x1410];
// P7: 0x80e7 != 0 (jr z not taken), 0x8077 read + and.
const P7 = [...P6, 0x1412, 0x1415, 0x1416];
// P8: 0x8077 == 0 (jp nz not taken), 0x80e6 read + and.
const P8 = [...P7, 0x1419, 0x141c, 0x141d];

const PATHS = {
  // 0x807a busy -> first tail-jump to 0x1b5b.
  early_1b5b: {
    seed: { 0x807a: 0x05 },
    exp: { steps: [0x13e1, 0x13e2, 0x1b5b], calls: [0x1b5b], returned: false,
           cycles: 13 + 4 + 10, pc: 0x1b5b, a: 0x05 },
  },
  // 0x8079 == 0 -> ret z.
  ret_z: {
    seed: { 0x807a: 0x00, 0x8079: 0x00 },
    exp: { steps: [0x13e1, 0x13e2, 0x13e5, 0x13e8, 0x13e9], calls: [], returned: true,
           cycles: 13 + 4 + 10 + 13 + 4 + 11, pc: 0x13e9, a: 0x00 },
  },
  // 0x807b busy -> ret nz.
  ret_nz: {
    seed: { 0x807a: 0x00, 0x8079: 0x01, 0x807b: 0x01 },
    exp: { steps: [...P2, 0x13ed, 0x13ee], calls: [], returned: true,
           cycles: (13 + 4 + 10) + (13 + 4 + 5) + (13 + 4 + 11), pc: 0x13ee, a: 0x01 },
  },
  // 0x80c1 == 1 -> tail-jump 0x186a (A dec'd to 0).
  vec_186a: {
    seed: { 0x807a: 0x00, 0x8079: 0x01, 0x807b: 0x00, 0x80c1: 0x01, 0x806c: 0x34, 0x806d: 0x12 },
    exp: { steps: [...P4, 0x186a], calls: [0x186a], returned: false,
           cycles: 132, pc: 0x186a, a: 0x00, d: 0x12, e: 0x34 },
  },
  // 0x80c1 == 2 -> dec then inc leaves A=2 non-zero -> tail-jump 0x1b5b.
  mid_1b5b: {
    seed: { 0x807a: 0x00, 0x8079: 0x01, 0x807b: 0x00, 0x80c1: 0x02 },
    exp: { steps: [...P4, 0x13fe, 0x13ff, 0x1b5b], calls: [0x1b5b], returned: false,
           cycles: 146, pc: 0x1b5b, a: 0x02 },
  },
  // 0x8075 negative -> jp m 0x1659.
  jpm_1659: {
    seed: { 0x807a: 0x00, 0x8079: 0x01, 0x807b: 0x00, 0x80c1: 0x00, 0x8075: 0x80 },
    exp: { steps: [...P5, 0x1659], calls: [0x1659], returned: false,
           cycles: 173, pc: 0x1659, a: 0x80 },
  },
  // 0x8075 positive non-zero -> jp nz 0x184a.
  jpnz_184a: {
    seed: { 0x807a: 0x00, 0x8079: 0x01, 0x807b: 0x00, 0x80c1: 0x00, 0x8075: 0x05 },
    exp: { steps: [...P5, 0x1409, 0x184a], calls: [0x184a], returned: false,
           cycles: 183, pc: 0x184a, a: 0x05 },
  },
  // 0x8075 == 0, 0x80e7 == 0 -> jr z into loc_1420.
  jrz_1420: {
    seed: { 0x807a: 0x00, 0x8079: 0x01, 0x807b: 0x00, 0x80c1: 0x00, 0x8075: 0x00, 0x80e7: 0x00 },
    exp: { steps: [...P5, 0x1409, 0x140c, 0x140f, 0x1410, 0x1420], calls: [0x1420], returned: false,
           cycles: 212, pc: 0x1420, a: 0x00 },
  },
  // 0x80e7 != 0, 0x8077 != 0 -> jp nz 0x19d0.
  jpnz_19d0: {
    seed: { 0x807a: 0x00, 0x8079: 0x01, 0x807b: 0x00, 0x80c1: 0x00, 0x8075: 0x00, 0x80e7: 0x01, 0x8077: 0x01 },
    exp: { steps: [...P7, 0x19d0], calls: [0x19d0], returned: false,
           cycles: 234, pc: 0x19d0, a: 0x01 },
  },
  // 0x8077 == 0, 0x80e6 == 0 -> jp z 0x186f.
  jpz_186f: {
    seed: { 0x807a: 0x00, 0x8079: 0x01, 0x807b: 0x00, 0x80c1: 0x00, 0x8075: 0x00, 0x80e7: 0x01, 0x8077: 0x00, 0x80e6: 0x00 },
    exp: { steps: [...P8, 0x186f], calls: [0x186f], returned: false,
           cycles: 261, pc: 0x186f, a: 0x00 },
  },
  // 0x80e6 != 0 -> the final jp z is not taken; fall through into loc_1420.
  fall_1420: {
    seed: { 0x807a: 0x00, 0x8079: 0x01, 0x807b: 0x00, 0x80c1: 0x00, 0x8075: 0x00, 0x80e7: 0x01, 0x8077: 0x00, 0x80e6: 0x01 },
    exp: { steps: [...P8, 0x1420], calls: [0x1420], returned: false,
           cycles: 261, pc: 0x1420, a: 0x01 },
  },
};

for (const [name, { seed, exp }] of Object.entries(PATHS)) {
  test(`path ${name}`, () => {
    const m = makeMachine(seed);
    loc_13de(m);
    assertPath(m, exp);
    if (exp.d !== undefined) assert.equal(m.regs.d, exp.d, "D register");
    if (exp.e !== undefined) assert.equal(m.regs.e, exp.e, "E register");
  });
}

test("mutation: a corrupted tail-jump target is caught", () => {
  // Byte-identical to loc_13de except the FIRST tail-jump goes to 0x1b5c instead
  // of 0x1b5b. Cycles are UNCHANGED (jp cc is 10T either way), so it is precisely
  // the step/call-target assertions -- not the cycle count -- that must reject it.
  function loc_13de_mutant(m) {
    const { regs, mem } = m;
    regs.a = mem.read8(0x807a);
    m.step(0x13e1, 13);
    regs.or(regs.a);
    m.step(0x13e2, 4);
    if (regs.fNZ) {
      m.step(0x1b5c, 10); // BUG: should be 0x1b5b
      return m.call(0x1b5c); // BUG: should be 0x1b5b
    }
    m.step(0x13e5, 10);
    // (rest of the routine is irrelevant to this path and omitted)
  }

  const m = makeMachine({ 0x807a: 0x05 });
  loc_13de_mutant(m);
  // Only the tail-jump target differs (0x1b5c vs 0x1b5b); cycles are identical,
  // so the step-target assertion is what must throw.
  assert.equal(m.cycles, PATHS.early_1b5b.exp.cycles, "mutation preserves the cycle total");
  assert.throws(() => assertPath(m, PATHS.early_1b5b.exp), /step targets/);
});
