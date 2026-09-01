// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_1947 (ROM 0x1947-0x194f): read (0x20eb) into A, seat HL=0x3c01, then
// tail-delegate to loc_09b2.
//
// Run: node --test games/invaders/translated/test/loc_1947.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1947 } from "../loc_1947.js";

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

test("loc_1947: reads (0x20eb), seats HL, delegates to loc_09b2; 33 T", () => {
  const m = makeMachine();
  m.mem.write8(0x20eb, 0x5a);

  loc_1947(m);

  assert.equal(m.regs.a, 0x5a, "A := (0x20eb)");
  assert.equal(m.regs.hl, 0x3c01, "HL := 0x3c01");
  assert.equal(m.tstates, 13 + 10 + 10, "T: lda+lxi+jmp");
  assert.equal(m.pc, 0x09b2, "last step lands at the delegate");
  assert.deepEqual(m.calls, [0x09b2], "tail-delegates to loc_09b2");
  assert.deepEqual(m.pcSeq, [0x194a, 0x194d, 0x09b2], "step boundaries");
});

test("loc_1947 MUTATION: lda mis-charged 7T not 13T is caught", () => {
  const m = makeMachine();
  m.mem.write8(0x20eb, 0x5a);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x194a ? 7 : c);
  loc_1947(m);
  assert.notEqual(m.tstates, 33, "golden T-state total catches the mutant");
});
