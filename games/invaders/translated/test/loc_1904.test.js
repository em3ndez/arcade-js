// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_1904 (ROM 0x1904-0x1909): seat HL=0x2200, tail-delegate to loc_01c3.
//
// Run: node --test games/invaders/translated/test/loc_1904.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1904 } from "../loc_1904.js";

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

test("loc_1904: HL:=0x2200, delegates to loc_01c3; 20 T", () => {
  const m = makeMachine();
  loc_1904(m);
  assert.equal(m.regs.hl, 0x2200, "HL := 0x2200");
  assert.equal(m.tstates, 10 + 10, "T: lxi + jmp");
  assert.equal(m.pc, 0x01c3, "last step lands at the delegate");
  assert.deepEqual(m.calls, [0x01c3], "tail-delegates to loc_01c3");
  assert.deepEqual(m.pcSeq, [0x1907, 0x01c3], "step boundaries");
});

test("loc_1904 MUTATION: jmp mis-charged 17T (call) not 10T is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x01c3 ? 17 : c);
  loc_1904(m);
  assert.notEqual(m.tstates, 20, "golden T-state total catches the mutant");
});
