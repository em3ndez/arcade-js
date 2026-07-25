// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_1b5b (ROM 0x1b5b-0x1b77): build the 4-byte record at
// 0x8220 from the actor block at 0x8068-0x806b, with the bias at 0x8051
// subtracted from the leading byte and added to the trailing one. Asserts the
// exact T-state total, the instruction-boundary step sequence, the final
// registers (A/F from the closing `add a,b`, B = the preserved bias, HL = the
// final store pointer), the control flow (ends via ret), and every written
// byte -- then re-runs a deliberately mutated copy (add/sub swap on the leading
// byte) and proves the memory assertion catches it.

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_1b5b } from "../loc_1b5b.js";

// Inputs the routine reads. Chosen distinct so every derivation is observable:
// the bias 0x10 makes the sub (0x50 -> 0x40) and the add (0x44 -> 0x54) both
// visibly change the byte they touch.
const BIAS = 0x10; // (0x8051)
const INPUT = {
  0x8051: BIAS,
  0x8068: 0x50,
  0x8069: 0x22,
  0x806a: 0x33,
  0x806b: 0x44,
};

// The 4-byte record the routine leaves at 0x8220..0x8223.
const EXPECT_MEM = {
  0x8220: 0x40, // mem[0x8068] - bias = 0x50 - 0x10
  0x8221: 0x22, // mem[0x8069]
  0x8222: 0x33, // mem[0x806a]
  0x8223: 0x54, // mem[0x806b] + bias = 0x44 + 0x10
};

// The address after every instruction, in execution order -- each a real
// instruction boundary in the disassembly. Final entry 0x1b77 is the `ret`.
const EXPECT_STEPS = [
  0x1b5e, 0x1b61, 0x1b62, 0x1b65, 0x1b66, 0x1b67, 0x1b68, 0x1b6b,
  0x1b6c, 0x1b6d, 0x1b70, 0x1b71, 0x1b72, 0x1b75, 0x1b76, 0x1b77,
];

// 1 ld hl,nn (10) + 5 ld a,(nn) (13) + ld b,a (4) + sub b (4)
//   + 4 ld (hl),a (7) + 3 inc hl (6) + add a,b (4) + ret (10)
const EXPECT_TSTATES = 10 + 5 * 13 + 4 + 4 + 4 * 7 + 3 * 6 + 4 + 10; // 143

// Reference flags/A for the closing `add a,b` (a = mem[0x806b], operand = bias),
// computed through the same ALU helper the disassembly's `add` maps to -- so a
// value-only store that dropped the flag effects would be caught.
function expectedFinalAF() {
  const r = new Regs();
  r.a = INPUT[0x806b];
  r.add(BIAS);
  return { a: r.a, f: r.f };
}

// Minimal leaf-routine machine double: exactly the surface loc_1b5b touches
// (regs, mem, step, ret). Seeds the input bytes, pre-fills the output record
// with 0xFF so every store is observable, and records step targets + cycles.
function makeMachine() {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x1b5b,
    steps: [],
    returned: false,
    ret(cycles = 10) {
      this.cycles += cycles;
      this.returned = true;
    },
    call() {
      throw new Error("loc_1b5b makes no calls");
    },
  };
  m.mem = new AddressSpace(rom, m.io);
  m.step = (nextAddr, cycles) => {
    m.pc = nextAddr;
    m.cycles += cycles;
    m.steps.push(nextAddr);
  };
  for (const [addr, val] of Object.entries(INPUT)) m.mem.write8(Number(addr), val);
  for (const addr of Object.keys(EXPECT_MEM)) m.mem.write8(Number(addr), 0xff);
  return m;
}

function assertEffects(m) {
  const { a: expA, f: expF } = expectedFinalAF();
  assert.equal(m.cycles, EXPECT_TSTATES, "T-state total");
  assert.deepEqual(m.steps, EXPECT_STEPS, "step targets land on instruction boundaries");
  assert.equal(m.returned, true, "routine returns via ret");
  assert.equal(m.pc, 0x1b77, "final step target is the ret opcode");
  assert.equal(m.regs.a, expA, "A holds mem[0x806b] + bias after the closing add");
  assert.equal(m.regs.f, expF, "F is set by the closing `add a,b`");
  assert.equal(m.regs.b, BIAS, "B preserves the bias (mem[0x8051]) throughout");
  assert.equal(m.regs.hl, 0x8223, "HL ends at the last store address");
  for (const [addr, val] of Object.entries(EXPECT_MEM)) {
    assert.equal(m.mem.read8(Number(addr)), val, `mem[0x${Number(addr).toString(16)}]`);
  }
}

test("loc_1b5b builds the biased 4-byte record with exact values, cycles and control flow", () => {
  const m = makeMachine();
  // Dirty A so we prove the routine loads A itself.
  m.regs.a = 0xaa;
  loc_1b5b(m);
  assertEffects(m);
});

test("mutation: an add/sub swap on the leading byte is caught", () => {
  // Byte-identical copy except the leading `sub b` becomes `add` -- a classic
  // add/sub translation slip. Only mem[0x8220] changes (0x60 vs 0x40); the
  // final A/F/B/HL, cycles and steps are untouched, so it is precisely the
  // memory assertion on 0x8220 that must reject it.
  function loc_1b5b_mutant(m) {
    const { regs, mem } = m;
    regs.hl = 0x8220;
    m.step(0x1b5e, 10);
    regs.a = mem.read8(0x8051);
    m.step(0x1b61, 13);
    regs.b = regs.a;
    m.step(0x1b62, 4);
    regs.a = mem.read8(0x8068);
    m.step(0x1b65, 13);
    regs.add(regs.b); // BUG: should be sub b
    m.step(0x1b66, 4);
    mem.write8(regs.hl, regs.a);
    m.step(0x1b67, 7);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x1b68, 6);
    regs.a = mem.read8(0x8069);
    m.step(0x1b6b, 13);
    mem.write8(regs.hl, regs.a);
    m.step(0x1b6c, 7);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x1b6d, 6);
    regs.a = mem.read8(0x806a);
    m.step(0x1b70, 13);
    mem.write8(regs.hl, regs.a);
    m.step(0x1b71, 7);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x1b72, 6);
    regs.a = mem.read8(0x806b);
    m.step(0x1b75, 13);
    regs.add(regs.b);
    m.step(0x1b76, 4);
    mem.write8(regs.hl, regs.a);
    m.step(0x1b77, 7);
    m.ret();
  }

  const m = makeMachine();
  loc_1b5b_mutant(m);
  assert.throws(() => assertEffects(m), /mem\[0x8220\]/);
});
