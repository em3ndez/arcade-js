// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0ae2 (ROM 0x0ae2-0x0ae9): seats HL=0x20c2, B=0x0c, then tail-
// delegates into the helper at 0x1a32. Pins the register writes, the tail delegate, and the
// exact T-states (MAME i8080).
//
// Run: node --test games/invaders/translated/test/loc_0ae2.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0ae2 } from "../loc_0ae2.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

test("loc_0ae2: seats HL=0x20c2, B=0x0c, tail-jumps to 0x1a32; 27 T", () => {
  const m = makeMachine();

  loc_0ae2(m);

  assert.equal(m.regs.hl, 0x20c2, "HL := 0x20c2");
  assert.equal(m.regs.b, 0x0c, "B := 0x0c");
  assert.equal(m.tstates, 10 + 7 + 10, "T: lxi(10)+mvi(7)+jmp(10)");
  assert.equal(m.pc, 0x1a32, "last step lands at the delegate target");
  assert.deepEqual(m.calls, [0x1a32], "tail-delegates to 0x1a32");
  assert.deepEqual(m.pcSeq, [0x0ae5, 0x0ae7, 0x1a32], "step boundaries");
});

test("loc_0ae2 MUTATION: jmp mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1a32 ? 7 : c);
  loc_0ae2(m);
  assert.notEqual(m.tstates, 27, "golden T-state total catches the mutant");
});
