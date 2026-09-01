// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_1579 (ROM 0x1579-0x1580): set the 0x2085 flag to 1 and tail-jump into
// loc_1545. Pins the memory write, register write, exact MAME i8080 T-states, and the delegation.
//
// Run: node --test games/invaders/translated/test/loc_1579.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1579 } from "../loc_1579.js";

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

test("loc_1579: 0x2085 := 1, tail-delegates to loc_1545; 30 T", () => {
  const m = makeMachine();

  loc_1579(m);

  assert.equal(m.regs.a, 0x01, "A := 0x01");
  assert.equal(m.mem.read8(0x2085), 0x01, "(0x2085) := 0x01");
  assert.deepEqual(m.calls, [0x1545], "tail-jumps into loc_1545");
  assert.equal(m.pc, 0x1545, "last step lands at the loc_1545 entry");
  assert.equal(m.tstates, 30, "7+13+10 = 30 T");
});

test("loc_1579 MUTATION: `sta 0x2085` mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x157e ? 7 : c); // 0x157e is the addr after sta
  loc_1579(m);
  assert.equal(m.tstates, 24, "mutation loses 6 T (13 -> 7)");
  assert.notEqual(m.tstates, 30, "golden T-state total catches the mutant");
});
