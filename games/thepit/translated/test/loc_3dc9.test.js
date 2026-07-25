// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_3dc9 (ROM 0x3dc9-0x3dda): from the tile offset word at
// 0x805a it derives two addresses for the SAME tile — colour-RAM (offset +
// 0x8800) stored at 0x805e, and video-RAM (offset + 0x9000) stored at 0x8060 —
// by carrying the running HL forward (+0x8800 then +0x0800). The test asserts
// the exact 100 T-state total, the instruction-boundary step sequence, the
// final HL/DE, both derived memory words, and the ret; it checks a 16-bit-wrap
// offset to prove HL is carried forward rather than recomputed; and it re-runs a
// mutant that SWAPS the two store addresses (an easy slip on adjacent 0x805e /
// 0x8060) and proves the assertions reject it.

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_3dc9 } from "../loc_3dc9.js";

// Leaf-routine machine double: exactly the surface loc_3dc9 touches (regs, mem,
// step, ret). `step` records its target + charges cycles; `ret` records the
// return + charges cycles. All addresses touched (0x805a/e, 0x8060) are work RAM.
function makeMachine({ ram = {} } = {}) {
  const romImg = new Uint8Array(0x5000); // ROM_END + 1
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x3dc9,
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
  for (const [addr, val] of Object.entries(ram)) m.mem.write8(Number(addr), val);
  return m;
}

// Straight-line routine: the step sequence is fixed on every input.
const STEPS = [0x3dcc, 0x3dcf, 0x3dd0, 0x3dd3, 0x3dd6, 0x3dd7, 0x3dda];
// 16 + 10 + 11 + 16 + 10 + 11 + 16  (seven instructions) + 10 (ret) = 100
const CYCLES = 16 + 10 + 11 + 16 + 10 + 11 + 16 + 10;

// Seed the offset word@0x805a (little-endian) and return the machine.
function machineForOffset(offset) {
  return makeMachine({
    ram: {
      0x805a: offset & 0xff, // low
      0x805b: (offset >> 8) & 0xff, // high
    },
  });
}

function assertResult(m, offset) {
  const colorAddr = (offset + 0x8800) & 0xffff; // stored at 0x805e
  const videoAddr = (offset + 0x9000) & 0xffff; // stored at 0x8060
  assert.deepEqual(m.steps, STEPS, "step targets");
  assert.equal(m.returned, true, "ret");
  assert.equal(m.cycles, CYCLES, "T-state total (100)");
  assert.equal(m.pc, 0x3dda, "final PC (ret opcode)");
  assert.equal(m.regs.hl, videoAddr, "HL carried forward to offset + 0x9000");
  assert.equal(m.regs.de, 0x0800, "DE = last immediate loaded");
  assert.equal(m.mem.read16(0x805e), colorAddr, "0x805e = offset + 0x8800 (colour RAM)");
  assert.equal(m.mem.read16(0x8060), videoAddr, "0x8060 = offset + 0x9000 (video RAM)");
}

test("derives colour (offset+0x8800) and video (offset+0x9000) addresses", () => {
  const offset = 0x0123;
  const m = machineForOffset(offset);
  loc_3dc9(m);
  assertResult(m, offset);
  // Spot-check the concrete values so the derivation is pinned, not just relative.
  assert.equal(m.mem.read16(0x805e), 0x8923, "colour addr 0x0123+0x8800");
  assert.equal(m.mem.read16(0x8060), 0x9123, "video addr 0x0123+0x9000");
});

test("16-bit wrap: HL is carried forward, not recomputed from the offset", () => {
  // offset 0xF800: first add wraps to 0x8000 (colour word), a SECOND +0x0800 on
  // that running HL gives 0x8800 (video word). If the second store recomputed
  // offset+0x9000 from scratch it would be 0x0800, so this pins the carry-forward.
  const offset = 0xf800;
  const m = machineForOffset(offset);
  loc_3dc9(m);
  assertResult(m, offset);
  assert.equal(m.mem.read16(0x805e), 0x8000, "colour word wrapped to 0x8000");
  assert.equal(m.mem.read16(0x8060), 0x8800, "video word = colour word + 0x0800");
});

test("mutation: swapping the two store addresses is caught", () => {
  // Byte-identical to loc_3dc9 except the two `ld (nn),hl` targets are swapped —
  // a plausible slip on the adjacent 0x805e / 0x8060. The colour word then lands
  // at 0x8060 and the video word at 0x805e, so both memory assertions reject it.
  function loc_3dc9_mutant(m) {
    const { regs, mem } = m;
    regs.hl = mem.read16(0x805a);
    m.step(0x3dcc, 16);
    regs.de = 0x8800;
    m.step(0x3dcf, 10);
    regs.addHl(regs.de);
    m.step(0x3dd0, 11);
    mem.write16(0x8060, regs.hl); // BUG: should be 0x805e
    m.step(0x3dd3, 16);
    regs.de = 0x0800;
    m.step(0x3dd6, 10);
    regs.addHl(regs.de);
    m.step(0x3dd7, 11);
    mem.write16(0x805e, regs.hl); // BUG: should be 0x8060
    m.step(0x3dda, 16);
    m.ret();
  }

  const offset = 0x0123;
  const m = machineForOffset(offset);
  loc_3dc9_mutant(m);
  assert.throws(() => assertResult(m, offset), /0x805e|0x8060/);
});
