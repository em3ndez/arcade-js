// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_193c (ROM 0x193c-0x1946): seat C=0x07, HL=0x3501, DE=0x1fa9, then
// tail-delegate to loc_08f3.
//
// Run: node --test games/invaders/translated/test/loc_193c.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_193c } from "../loc_193c.js";

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
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

test("loc_193c: seats C/HL/DE, delegates to loc_08f3; 37 T", () => {
  const m = makeMachine();
  loc_193c(m);
  assert.equal(m.regs.c, 0x07, "C := 0x07");
  assert.equal(m.regs.hl, 0x3501, "HL := 0x3501");
  assert.equal(m.regs.de, 0x1fa9, "DE := 0x1fa9");
  assert.equal(m.tstates, 7 + 10 + 10 + 10, "T: mvi+lxi+lxi+jmp");
  assert.equal(m.pc, 0x08f3, "last step lands at the delegate");
  assert.deepEqual(m.calls, [0x08f3], "tail-delegates to loc_08f3");
  assert.deepEqual(m.pcSeq, [0x193e, 0x1941, 0x1944, 0x08f3], "step boundaries");
});

test("loc_193c MUTATION: HL seated as 0x3500 (off by one) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1941 ? 4 : c); // mis-charge lxi h as 4T
  loc_193c(m);
  assert.notEqual(m.tstates, 37, "golden T-state total catches the mutant");
});
