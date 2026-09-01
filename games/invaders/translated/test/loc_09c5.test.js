// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_09c5 (ROM 0x09c5-0x09c9): A += 0x1a (nibble -> glyph code) then tail-
// jump into the plotter at 0x08ff. Pins the add result/flags, the delegate, and the exact T-states.
//
// Run: node --test games/invaders/translated/test/loc_09c5.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_09c5 } from "../loc_09c5.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only tail dispatch
  };
}

test("loc_09c5: A=0x03 -> 0x1d, delegates to 0x08ff; 17 T", () => {
  const m = makeMachine();
  m.regs.a = 0x03;

  loc_09c5(m);

  assert.equal(m.regs.a, 0x1d, "A := 0x03 + 0x1a");
  assert.equal(m.regs.fC, false, "no carry out of 0x03+0x1a");
  assert.equal(m.pc, 0x08ff, "last step lands at the plotter");
  assert.deepEqual(m.calls, [0x08ff], "tail-delegates to loc_08ff");
  assert.deepEqual(m.pcSeq, [0x09c7, 0x08ff], "step boundaries");
  assert.equal(m.tstates, 7 + 10, "17 T total: adi(7)+jmp(10)");
});

test("loc_09c5 MUTATION: `jmp 0x08ff` mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  m.regs.a = 0x03;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x08ff ? 7 : c);
  loc_09c5(m);
  assert.equal(m.tstates, 7 + 7, "mutation loses 3 T (10 -> 7)");
  assert.notEqual(m.tstates, 17, "golden T-state total catches the mutant");
});
