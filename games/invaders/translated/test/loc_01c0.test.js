// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_01c0 (ROM 0x01c0-0x01c2): seat HL=0x2100 then fall through into the
// loc_01c3 fill (delegated -- the record-only mock does not run it). Pins the HL seat, the
// delegate target, and 10 T.
//
// Run: node --test games/invaders/translated/test/loc_01c0.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_01c0 } from "../loc_01c0.js";

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

test("loc_01c0: seats HL=0x2100, delegates to loc_01c3; 10 T", () => {
  const m = makeMachine();

  loc_01c0(m);

  assert.equal(m.regs.hl, 0x2100, "HL := 0x2100");
  assert.deepEqual(m.calls, [0x01c3], "falls through into the HL-relative fill");
  assert.equal(m.pc, 0x01c3, "last step lands at the fill entry");
  assert.equal(m.tstates, 10, "lxi h is 10 T");
});

test("loc_01c0 MUTATION: `lxi h` mis-charged 4T (not 10) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x01c3 ? 4 : c);
  loc_01c0(m);
  assert.equal(m.tstates, 4, "mutation loses 6 T (10 -> 4)");
  assert.notEqual(m.tstates, 10, "golden T-state total catches the mutant");
});
