// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for sub_4b44 (ROM 0x4b44-0x4b54, The Pit). The routine is a
// straight-line entry: force A=0x00, store it to the 0x8057 mode cell, run the
// three-call setup sequence (0x4c11/0x4c27/0x4c37), then TAIL-JUMP to 0x4c1c.
// The test asserts the exact T-state total, the per-instruction step boundaries,
// the call/tail-jump target sequence, the return-address pushes (3 real calls,
// the jp pushes nothing), the mode-cell write, and the control-flow outcome
// (never an early ret; final PC lands in the tail target). Then a byte-identical
// mutant whose tail-jump goes to the WRONG target proves the invariant has teeth.

import { test } from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { sub_4b44 } from "../sub_4b44.js";

// Minimal faithful machine double: real Regs/AddressSpace/Io and
// step/call/ret/push16 modelled like the DK machine. call RECORDS its target
// (0x4c11/0x4c27/0x4c37/0x4c1c are separate units, stubbed) and returns
// undefined, so `return m.call(0x4c1c)` models "control transferred and never
// came back". SP seeded inside work RAM so push16 lands in mapped RAM.
class MockMachine {
  constructor() {
    this.regs = new Regs();
    this.io = new Io();
    this.mem = new AddressSpace(new Uint8Array(0x5000), this.io);
    this.regs.sp = 0x8780; // stack inside work RAM
    this.cycles = 0;
    this.pc = 0x4b44;
    this.steps = [];
    this.calls = [];
    this.returned = false;
  }
  step(nextAddr, cycles) {
    this.pc = nextAddr;
    this.cycles += cycles;
    this.steps.push(nextAddr);
  }
  call(addr) {
    this.calls.push(addr);
    return undefined; // stubbed callee -- assert only that control transferred
  }
  ret(cycles = 10) {
    this.cycles += cycles;
    this.returned = true;
  }
  push16(value) {
    this.regs.sp = (this.regs.sp - 2) & 0xffff;
    this.mem.write8(this.regs.sp, value & 0xff);
    this.mem.write8((this.regs.sp + 1) & 0xffff, (value >> 8) & 0xff);
  }
}

const SP0 = 0x8780;

// The whole-routine invariant (single straight-line path; no branches).
const EXPECT = {
  steps: [0x4b46, 0x4b49, 0x4c11, 0x4c27, 0x4c37, 0x4c1c],
  calls: [0x4c11, 0x4c27, 0x4c37, 0x4c1c],
  returned: false, // tail-jump, not an early ret
  cycles: 7 + 13 + 17 + 17 + 17 + 10, // 81
  pc: 0x4c1c,
  a: 0x00,
  mode: 0x00, // 0x8057
};

function assertRoutine(m) {
  assert.deepEqual(m.steps, EXPECT.steps, "step targets (instruction boundaries)");
  assert.deepEqual(m.calls, EXPECT.calls, "call + tail-jump target sequence");
  assert.equal(m.returned, EXPECT.returned, "no early ret (tail-jump propagates)");
  assert.equal(m.cycles, EXPECT.cycles, "T-state total");
  assert.equal(m.pc, EXPECT.pc, "final PC = tail-jump target");
  assert.equal(m.regs.a, EXPECT.a, "A forced to 0x00 by ld a,0x00");
  assert.equal(m.mem.read8(0x8057), EXPECT.mode, "0x8057 mode cell = A");
  // Exactly THREE real calls pushed a 2-byte return addr; the jp pushed nothing.
  assert.equal(m.regs.sp, (SP0 - 6) & 0xffff, "SP moved by 3 pushes (jp pushes nothing)");
  assert.equal(m.mem.read16((SP0 - 2) & 0xffff), 0x4b4c, "call 0x4c11 return addr");
  assert.equal(m.mem.read16((SP0 - 4) & 0xffff), 0x4b4f, "call 0x4c27 return addr");
  assert.equal(m.mem.read16((SP0 - 6) & 0xffff), 0x4b52, "call 0x4c37 return addr");
}

test("sub_4b44: forces A=0, writes mode cell, runs the setup sequence, tail-jumps to 0x4c1c", () => {
  const m = new MockMachine();
  m.regs.a = 0xff; // prove `ld a,0x00` actually overwrites A (the entry's whole job)
  sub_4b44(m);
  assertRoutine(m);
});

// ---- MUTATION --------------------------------------------------------------
// Byte-identical to sub_4b44 EXCEPT the tail-jump targets 0x4c11 instead of
// 0x4c1c (a plausible "reused the wrong address" slip). `jp nn` is 10T to either
// target, so the CYCLE total is unchanged (81) -- it is precisely the call/step
// target sequence and final PC that must reject it, proving those assertions
// carry the weight and are not riding on the cycle count.
function sub_4b44_MUTANT(m) {
  const { regs, mem } = m;
  regs.a = 0x00;
  m.step(0x4b46, 7);
  mem.write8(0x8057, regs.a);
  m.step(0x4b49, 13);
  m.push16(0x4b4c);
  m.step(0x4c11, 17);
  m.call(0x4c11);
  m.push16(0x4b4f);
  m.step(0x4c27, 17);
  m.call(0x4c27);
  m.push16(0x4b52);
  m.step(0x4c37, 17);
  m.call(0x4c37);
  m.step(0x4c11, 10); // BUG: tail-jump should target 0x4c1c
  return m.call(0x4c11); // BUG: should be 0x4c1c
}

test("MUTATION caught: tail-jump to the wrong target (cycles identical)", () => {
  const good = new MockMachine();
  good.regs.a = 0xff;
  sub_4b44(good);
  assertRoutine(good); // sanity: the real routine passes

  const bad = new MockMachine();
  bad.regs.a = 0xff;
  sub_4b44_MUTANT(bad);
  // Document precisely what the mutant broke: it transferred to 0x4c11, not 0x4c1c.
  assert.deepEqual(bad.calls, [0x4c11, 0x4c27, 0x4c37, 0x4c11], "mutant tail-jumps to 0x4c11");
  assert.equal(bad.pc, 0x4c11, "mutant final PC is the wrong target");
  assert.equal(bad.cycles, EXPECT.cycles, "mutant preserves the cycle total (so cycles cannot catch it)");
  // The target-sequence assertions (step + call) must reject it even though cycles match.
  assert.throws(() => assertRoutine(bad), /targets/);
});
