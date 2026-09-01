// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_067e (ROM 0x067e-0x0681): stores HL to 0x2048 then RETs. Pins the 16-bit
// memory write, the exact T-states, and the return to the seated caller.
//
// Run: node --test games/invaders/translated/test/loc_067e.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_067e } from "../loc_067e.js";

const CALLER_RET = 0xabcd;

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

test("loc_067e: shld 0x2048 then RET; 26 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.hl = 0x1234;

  loc_067e(m);

  assert.equal(m.mem.read8(0x2048), 0x34, "shld low byte -> 0x2048");
  assert.equal(m.mem.read8(0x2049), 0x12, "shld high byte -> 0x2049");
  assert.equal(m.tstates, 16 + 10, "T: shld(16)+ret(10)");
  assert.equal(m.pc, CALLER_RET, "RET returns to the seated caller");
  assert.equal(m.regs.sp, 0x2400, "RET pops the caller frame");
  assert.deepEqual(m.calls, [], "no delegates");
});

test("loc_067e MUTATION: `shld 0x2048` mis-charged 13T (not 16T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.hl = 0x1234;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0681 ? 13 : c);
  loc_067e(m);
  assert.equal(m.tstates, 13 + 10, "mutation loses 3 T (16 -> 13)");
  assert.notEqual(m.tstates, 26, "golden T-state total catches the mutant");
});
