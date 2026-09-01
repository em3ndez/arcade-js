// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for translated loc_1815 (ROM 0x1815-0x1833): print, set pace 0x206c=0x0a, then
// walk the 0x1dbe script via 0x1856 (draw each with 0x1844) until carry (end) -> delegate loc_1837.
// The mock `call` pops the pushed return (models the callee's ret) and flags carry on the 2nd 0x1856
// so the loop runs one full pass then exits. Golden = loop-then-delegate + a T-state mutation.
// Run: node --test games/invaders/translated/test/loc_1815.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1815 } from "../loc_1815.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1815, pcSeq: [], _n1856: 0, carryOn: 2,
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // model callee ret (pop pushed return) for the real internal calls only -- 0x1837 is a
    // tail-delegate (jc, no push). Flag carry on the 2nd 0x1856 to end the script walk.
    call(addr) { this.calls.push(addr); if (addr === 0x08f3 || addr === 0x1856 || addr === 0x1844) this.pop16(); if (addr === 0x1856 && ++this._n1856 >= this.carryOn) regs.fC = true; return undefined; },
  };
}

test("loc_1815: one draw pass then carry -> delegate loc_1837; 155 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;

  loc_1815(m);

  assert.equal(m.regs.hl, 0x2810, "lxi h,0x2810");
  assert.equal(m.regs.de, 0x1ca3, "lxi d,0x1ca3");
  assert.equal(m.regs.bc, 0x1dbe, "lxi b,0x1dbe (script pointer)");
  assert.equal(m.regs.a, 0x0a, "mvi a,0x0a");
  assert.equal(m.mem.read8(0x206c), 0x0a, "0x206c := pace 0x0a");
  assert.equal(m.regs.sp, 0x2400, "stack balanced (every call push matched a ret pop)");
  assert.equal(m.tstates, 74 + 54 + 27, "setup(74)+pass1(54)+pass2-to-delegate(27)");
  assert.deepEqual(m.calls, [0x08f3, 0x1856, 0x1844, 0x1856, 0x1837], "print, walk (draw once), delegate 0x1837");
  assert.deepEqual(m.pcSeq, [0x1818, 0x181b, 0x181d, 0x08f3, 0x1822, 0x1825, 0x1828, 0x1856, 0x182e, 0x1844, 0x1828, 0x1856, 0x1837], "step boundaries");
});

test("loc_1815 MUTATION: `sta 0x206c` mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1825 ? 7 : c);
  loc_1815(m);
  assert.equal(m.tstates, 155 - 6, "mutation loses 6 T (13 -> 7)");
  assert.notEqual(m.tstates, 155, "golden T-state total catches the mutant");
});
