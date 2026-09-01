// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0248 (ROM 0x0248): seats HL at the table base 0x2010 then tail-delegates
// into loc_024b (a fall-through across a routine boundary, recorded in m.calls). Pins the HL seat,
// the single T-state, the landing address, and the delegate.
//
// Run: node --test games/invaders/translated/test/loc_0248.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0248 } from "../loc_0248.js";

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

test("loc_0248: seats HL=0x2010, delegates to loc_024b; 10 T", () => {
  const m = makeMachine();

  loc_0248(m);

  assert.equal(m.regs.hl, 0x2010, "HL := 0x2010 (table base)");
  assert.equal(m.tstates, 10, "lxi h is 10 T");
  assert.equal(m.pc, 0x024b, "last step lands at the loc_024b entry");
  assert.deepEqual(m.calls, [0x024b], "tail-delegates to loc_024b");
  assert.deepEqual(m.pcSeq, [0x024b], "single step boundary");
});

test("loc_0248 MUTATION: `lxi h,0x2010` mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x024b ? 7 : c);
  loc_0248(m);
  assert.equal(m.tstates, 7, "mutation loses 3 T (10 -> 7)");
  assert.notEqual(m.tstates, 10, "golden T-state total catches the mutant");
});
