// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0430 (ROM 0x0430-0x0435): a CALLed helper that seats HL at the object
// move-record base and tail-jmps loc_1a3b. Record-only mock pins the HL write, the delegate, and T.
//
// Run: node --test games/invaders/translated/test/loc_0430.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0430 } from "../loc_0430.js";

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
    io: { inte: false, outs: [], setInte(on) { this.inte = !!on; }, portOut(p, v) { this.outs.push([p, v & 0xff]); } },
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

test("loc_0430: seats HL=0x2027, delegates to loc_1a3b; 20 T", () => {
  const m = makeMachine();
  loc_0430(m);
  assert.equal(m.regs.hl, 0x2027, "HL := 0x2027");
  assert.equal(m.tstates, 10 + 10, "lxi(10) + jmp(10)");
  assert.deepEqual(m.calls, [0x1a3b], "tail-delegate loc_1a3b");
  assert.deepEqual(m.pcSeq, [0x0433, 0x1a3b], "step boundaries");
  assert.equal(m.pc, 0x1a3b, "last step lands at the delegate");
});

test("loc_0430 MUTATION: lxi mis-charged 7T (mvi) not 10T is caught", () => {
  const m = makeMachine();
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x0433 ? 7 : c);
  loc_0430(m);
  assert.notEqual(m.tstates, 20, "golden T total catches the mutant");
  assert.equal(m.tstates, 17, "mutation loses 3 T (10 -> 7)");
});
