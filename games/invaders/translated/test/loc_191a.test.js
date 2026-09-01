// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_191a (ROM 0x191a-0x1924): seat C=0x1c, HL=0x241e, DE=0x1ae4, then
// tail-delegate to loc_08f3.
//
// Run: node --test games/invaders/translated/test/loc_191a.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_191a } from "../loc_191a.js";

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

test("loc_191a: seats C/HL/DE, delegates to loc_08f3; 37 T", () => {
  const m = makeMachine();
  loc_191a(m);
  assert.equal(m.regs.c, 0x1c, "C := 0x1c");
  assert.equal(m.regs.hl, 0x241e, "HL := 0x241e");
  assert.equal(m.regs.de, 0x1ae4, "DE := 0x1ae4");
  assert.equal(m.tstates, 7 + 10 + 10 + 10, "T: mvi+lxi+lxi+jmp");
  assert.equal(m.pc, 0x08f3, "last step lands at the delegate");
  assert.deepEqual(m.calls, [0x08f3], "tail-delegates to loc_08f3");
  assert.deepEqual(m.pcSeq, [0x191c, 0x191f, 0x1922, 0x08f3], "step boundaries");
});

test("loc_191a MUTATION: mvi c mis-charged 4T not 7T is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x191c ? 4 : c); // 0x191c is the mvi c successor
  loc_191a(m);
  assert.notEqual(m.tstates, 37, "golden T-state total catches the mutant");
});
