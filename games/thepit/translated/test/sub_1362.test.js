// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for sub_1362 (ROM 0x1362-0x13c8): the actor/level state-block
// seed. Asserts the exact T-state total, the instruction-boundary step
// sequence, the final register A, the control-flow (ends via ret), and every
// memory byte the routine writes -- then re-runs a deliberately mutated copy
// and proves the memory assertions catch it.

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { sub_1362 } from "../sub_1362.js";

// The exact final memory image sub_1362 leaves. Work RAM powers up to 0 so the
// zero-stores would be invisible; we pre-fill the touched addresses with 0xFF
// (below) so every one of these -- zeros included -- is an OBSERVED write.
const EXPECT_MEM = {
  0x8068: 0x00,
  0x8069: 0x32,
  0x806a: 0x02,
  0x806b: 0x23,
  0x806c: 0x01,
  0x806d: 0x01,
  0x8070: 0x01,
  0x8071: 0x05,
  0x8073: 0x19,
  0x801a: 0x00,
  0x8075: 0x00,
  0x80a2: 0x00,
  0x80a4: 0x00,
  0x80a7: 0x00,
  0x80a8: 0x00,
  0x8076: 0x00,
  0x8077: 0x00,
  0x8078: 0x00,
  0x8079: 0x00,
  0x807a: 0x00,
  0x807b: 0x00,
  0x807c: 0x00,
  0x807d: 0x00,
  0x807e: 0x00,
  0x807f: 0x00,
  0x8080: 0x00,
  0x8081: 0x00,
  0x8082: 0x00,
};

// The address after every instruction, in execution order -- each is a real
// instruction boundary in the disassembly (stepcheck's invariant). The final
// entry, 0x13c8, is the `ret` opcode itself.
const EXPECT_STEPS = [
  0x1364, 0x1367, 0x1369, 0x136c, 0x136e, 0x1371, 0x1373, 0x1376, 0x1378,
  0x137b, 0x137d, 0x1380, 0x1383, 0x1385, 0x1388, 0x138a, 0x138d, 0x138f,
  0x1392, 0x1395, 0x1398, 0x139b, 0x139e, 0x13a1, 0x13a4, 0x13a7, 0x13aa,
  0x13ad, 0x13b0, 0x13b3, 0x13b6, 0x13b9, 0x13bc, 0x13bf, 0x13c2, 0x13c5,
  0x13c8,
];

// 9 * ld a,n (7T) + 28 * ld (nn),a (13T) + ret (10T)
const EXPECT_TSTATES = 9 * 7 + 28 * 13 + 10; // 437

// Minimal leaf-routine machine double: exactly the surface sub_1362 touches
// (regs, mem, step, ret). Pre-seeds every written work-RAM address with 0xFF so
// the zero-stores are observable, and records the step targets + cycle total.
function makeMachine() {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x1362,
    steps: [],
    returned: false,
    ret(cycles = 10) {
      this.cycles += cycles;
      this.returned = true;
    },
    call() {
      throw new Error("sub_1362 makes no calls");
    },
  };
  m.mem = new AddressSpace(rom, m.io);
  m.step = (nextAddr, cycles) => {
    m.pc = nextAddr;
    m.cycles += cycles;
    m.steps.push(nextAddr);
  };
  for (const addr of Object.keys(EXPECT_MEM)) m.mem.write8(Number(addr), 0xff);
  return m;
}

function assertEffects(m) {
  assert.equal(m.cycles, EXPECT_TSTATES, "T-state total");
  assert.deepEqual(m.steps, EXPECT_STEPS, "step targets land on instruction boundaries");
  assert.equal(m.returned, true, "routine returns via ret");
  assert.equal(m.pc, 0x13c8, "final step target is the ret opcode");
  assert.equal(m.regs.a, 0x00, "A holds the last loaded immediate (0x00)");
  for (const [addr, val] of Object.entries(EXPECT_MEM)) {
    assert.equal(m.mem.read8(Number(addr)), val, `mem[0x${Number(addr).toString(16)}]`);
  }
}

test("sub_1362 seeds the state block with exact values, cycles and control flow", () => {
  const m = makeMachine();
  // Dirty A and F first so we prove the routine sets A itself (loads don't touch F).
  m.regs.a = 0xaa;
  const fBefore = m.regs.f;
  sub_1362(m);
  assertEffects(m);
  assert.equal(m.regs.f, fBefore, "ld does not touch flags");
});

test("mutation: a wrong stored value is caught", () => {
  // Deliberately break the routine: a byte-identical copy except the `ld a,0x32`
  // loads 0x33, so 0x8069 is seeded one off. Cycles and the step sequence are
  // untouched, so it is precisely the memory assertion that must reject it.
  function sub_1362_mutant(m) {
    const { regs, mem } = m;
    regs.a = 0x00;
    m.step(0x1364, 7);
    mem.write8(0x8068, regs.a);
    m.step(0x1367, 13);
    regs.a = 0x23;
    m.step(0x1369, 7);
    mem.write8(0x806b, regs.a);
    m.step(0x136c, 13);
    regs.a = 0x19;
    m.step(0x136e, 7);
    mem.write8(0x8073, regs.a);
    m.step(0x1371, 13);
    regs.a = 0x05;
    m.step(0x1373, 7);
    mem.write8(0x8071, regs.a);
    m.step(0x1376, 13);
    regs.a = 0x02;
    m.step(0x1378, 7);
    mem.write8(0x806a, regs.a);
    m.step(0x137b, 13);
    regs.a = 0x01;
    m.step(0x137d, 7);
    mem.write8(0x806c, regs.a);
    m.step(0x1380, 13);
    mem.write8(0x806d, regs.a);
    m.step(0x1383, 13);
    regs.a = 0x33; // BUG: should be 0x32
    m.step(0x1385, 7);
    mem.write8(0x8069, regs.a);
    m.step(0x1388, 13);
    regs.a = 0x01;
    m.step(0x138a, 7);
    mem.write8(0x8070, regs.a);
    m.step(0x138d, 13);
    regs.a = 0x00;
    m.step(0x138f, 7);
    mem.write8(0x801a, regs.a);
    m.step(0x1392, 13);
    mem.write8(0x8075, regs.a);
    m.step(0x1395, 13);
    mem.write8(0x80a2, regs.a);
    m.step(0x1398, 13);
    mem.write8(0x80a4, regs.a);
    m.step(0x139b, 13);
    mem.write8(0x80a7, regs.a);
    m.step(0x139e, 13);
    mem.write8(0x80a8, regs.a);
    m.step(0x13a1, 13);
    mem.write8(0x8076, regs.a);
    m.step(0x13a4, 13);
    mem.write8(0x8077, regs.a);
    m.step(0x13a7, 13);
    mem.write8(0x8078, regs.a);
    m.step(0x13aa, 13);
    mem.write8(0x807a, regs.a);
    m.step(0x13ad, 13);
    mem.write8(0x8079, regs.a);
    m.step(0x13b0, 13);
    mem.write8(0x807e, regs.a);
    m.step(0x13b3, 13);
    mem.write8(0x807f, regs.a);
    m.step(0x13b6, 13);
    mem.write8(0x8080, regs.a);
    m.step(0x13b9, 13);
    mem.write8(0x807c, regs.a);
    m.step(0x13bc, 13);
    mem.write8(0x807b, regs.a);
    m.step(0x13bf, 13);
    mem.write8(0x807d, regs.a);
    m.step(0x13c2, 13);
    mem.write8(0x8081, regs.a);
    m.step(0x13c5, 13);
    mem.write8(0x8082, regs.a);
    m.step(0x13c8, 13);
    m.ret();
  }

  const m = makeMachine();
  sub_1362_mutant(m);
  // Only 0x8069 differs (0x33 vs 0x32); assertEffects must throw on that byte.
  assert.throws(() => assertEffects(m), /mem\[0x8069\]/);
});
