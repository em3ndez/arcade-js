// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_36fe (ROM 0x36fe-0x3747): a straight-line, one-shot RAM
// initializer — 14 `ld a,n` (7T) + 15 `ld (nn),a` (13T) + `ret` (10T) = 303 T,
// seeding a primary actor block at 0x810a-0x8112, a twin at 0x811b-0x8123, and
// clearing the phase flag at 0x807b. There are 15 stores but only 14 loads
// because A=0x00 (loaded at 0x373a) feeds BOTH 0x811f and 0x8120. The test
// asserts the instruction-boundary step sequence, the exact T-state total, the
// final PC/A, that F is untouched (these opcodes set no flags), that every one of
// the 15 target bytes holds its exact seeded value, and the ret. It then re-runs
// a mutant that reloads A before the second of the shared stores (writing 0x08 to
// 0x8120 instead of the reused 0x00) and proves the assertions reject it.

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_36fe } from "../loc_36fe.js";

// Leaf-routine machine double: exactly the surface loc_36fe touches (regs, mem,
// step, ret). `step` records its target + charges cycles; `ret` records the
// return + charges cycles. All targets are work RAM, seeded/read through write8.
function makeMachine() {
  const romImg = new Uint8Array(0x5000); // ROM_END + 1
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x36fe,
    steps: [],
    returned: false,
    ret(cycles = 10) {
      this.cycles += cycles;
      this.returned = true;
    },
  };
  m.mem = new AddressSpace(romImg, m.io);
  m.step = (nextAddr, cycles) => {
    m.pc = nextAddr;
    m.cycles += cycles;
    m.steps.push(nextAddr);
  };
  return m;
}

// One step per instruction (29 = 14 loads + 15 stores); the ret is m.ret, not a
// step. Final PC after the last step is the ret opcode address, 0x3747.
const STEPS = [
  0x3700, 0x3703, 0x3705, 0x3708, 0x370a, 0x370d, 0x370f, 0x3712,
  0x3714, 0x3717, 0x3719, 0x371c, 0x371e, 0x3721, 0x3723, 0x3726,
  0x3728, 0x372b, 0x372d, 0x3730, 0x3732, 0x3735, 0x3737, 0x373a,
  0x373c, 0x373f, 0x3742, 0x3744, 0x3747,
];

// 14 loads * 7 + 15 stores * 13 = 98 + 195 = 293, plus the trailing ret (10).
const TOTAL_T = 14 * 7 + 15 * 13 + 10; // 303

// The full contract of the routine: address -> exact seeded byte.
const EXPECT_MEM = {
  0x810b: 0x2e,
  0x810a: 0x24,
  0x810d: 0x00,
  0x810c: 0x97,
  0x810e: 0x00,
  0x810f: 0x01,
  0x8112: 0x01,
  0x807b: 0x00,
  0x811c: 0x2f,
  0x811b: 0x34,
  0x811e: 0x00,
  0x811d: 0x97,
  0x811f: 0x00,
  0x8120: 0x00,
  0x8123: 0x01,
};

function assertContract(m) {
  assert.deepEqual(m.steps, STEPS, "step targets");
  assert.equal(m.returned, true, "ret");
  assert.equal(m.cycles, TOTAL_T, "T-state total");
  assert.equal(m.pc, 0x3747, "final PC (ret opcode)");
  assert.equal(m.regs.a, 0x01, "A = last immediate loaded (0x01)");
  for (const [addr, val] of Object.entries(EXPECT_MEM)) {
    assert.equal(m.mem.read8(Number(addr)), val, `mem[0x${Number(addr).toString(16)}]`);
  }
}

test("seeds every actor byte, charges 303 T, touches no flags", () => {
  const m = makeMachine();
  m.regs.f = 0xa5; // sentinel: no opcode here writes F
  loc_36fe(m);
  assertContract(m);
  assert.equal(m.regs.f, 0xa5, "F unchanged -- ld/ret set no flags");
});

test("A=0x00 at 0x373a feeds both 0x811f and 0x8120 (15 stores, 14 loads)", () => {
  // Guards the shared-A store: 0x8120 gets A WITHOUT its own `ld a,n`. Pre-poison
  // 0x8120 so a routine that skipped the store would leave the poison behind.
  const m = makeMachine();
  m.mem.write8(0x8120, 0xff);
  loc_36fe(m);
  assert.equal(m.mem.read8(0x811f), 0x00, "0x811f = 0x00");
  assert.equal(m.mem.read8(0x8120), 0x00, "0x8120 = same A (0x00), not the poison");
});

test("mutation: an extra reload before the shared store (0x8120=0x08) is caught", () => {
  // Byte-identical to loc_36fe except a spurious `ld a,0x08` is inserted before
  // the 0x8120 store — the exact slip of treating 0x8120 as needing its own load.
  // That both stores the wrong value (0x08) at 0x8120 AND, because the inserted
  // load has its own step+7T, shifts every later step target and the T-total.
  function loc_36fe_mutant(m) {
    const { regs, mem } = m;
    regs.a = 0x2e; m.step(0x3700, 7);
    mem.write8(0x810b, regs.a); m.step(0x3703, 13);
    regs.a = 0x24; m.step(0x3705, 7);
    mem.write8(0x810a, regs.a); m.step(0x3708, 13);
    regs.a = 0x00; m.step(0x370a, 7);
    mem.write8(0x810d, regs.a); m.step(0x370d, 13);
    regs.a = 0x97; m.step(0x370f, 7);
    mem.write8(0x810c, regs.a); m.step(0x3712, 13);
    regs.a = 0x00; m.step(0x3714, 7);
    mem.write8(0x810e, regs.a); m.step(0x3717, 13);
    regs.a = 0x01; m.step(0x3719, 7);
    mem.write8(0x810f, regs.a); m.step(0x371c, 13);
    regs.a = 0x01; m.step(0x371e, 7);
    mem.write8(0x8112, regs.a); m.step(0x3721, 13);
    regs.a = 0x00; m.step(0x3723, 7);
    mem.write8(0x807b, regs.a); m.step(0x3726, 13);
    regs.a = 0x2f; m.step(0x3728, 7);
    mem.write8(0x811c, regs.a); m.step(0x372b, 13);
    regs.a = 0x34; m.step(0x372d, 7);
    mem.write8(0x811b, regs.a); m.step(0x3730, 13);
    regs.a = 0x00; m.step(0x3732, 7);
    mem.write8(0x811e, regs.a); m.step(0x3735, 13);
    regs.a = 0x97; m.step(0x3737, 7);
    mem.write8(0x811d, regs.a); m.step(0x373a, 13);
    regs.a = 0x00; m.step(0x373c, 7);
    mem.write8(0x811f, regs.a); m.step(0x373f, 13);
    regs.a = 0x08; m.step(0x3741, 7); // BUG: spurious reload; 0x8120 must reuse A=0x00
    mem.write8(0x8120, regs.a); m.step(0x3742, 13);
    regs.a = 0x01; m.step(0x3744, 7);
    mem.write8(0x8123, regs.a); m.step(0x3747, 13);
    m.ret();
  }

  const m = makeMachine();
  loc_36fe_mutant(m);
  assert.throws(() => assertContract(m), /step targets|T-state total|mem\[0x8120\]/);
});
