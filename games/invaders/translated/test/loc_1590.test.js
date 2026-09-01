// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_1590 (ROM 0x1590-0x1596): normalize A upward. Pins the self-loop
// (inr C, adi 0x10, jm 0x1590) that runs while A is negative, the final register state, exact
// MAME i8080 T-states, and the terminating ret.
//
// Run: node --test games/invaders/translated/test/loc_1590.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1590 } from "../loc_1590.js";

const CALLER_RET = 0xd00d;

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

test("loc_1590: adds 0x10 / bumps C until A non-negative; 0xB0 -> 0x00 in 5 steps; 120 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.a = 0xb0; m.regs.c = 0x00;

  loc_1590(m);

  assert.equal(m.regs.a, 0x00, "0xB0 +0x10*5 = 0x100 & 0xff = 0x00 (sign clear -> exit)");
  assert.equal(m.regs.c, 0x05, "C bumped once per 0x10 step");
  assert.deepEqual(m.calls, [], "no delegations");
  assert.equal(m.pc, CALLER_RET, "ret pops the caller return");
  // 4 taken loops (5+7+10) + 1 exit pass (5+7+10) + ret(10) = 4*22 + 22 + 10 = 120
  assert.equal(m.tstates, 120, "5 iterations of inr/adi/jm + ret");
});

test("loc_1590 MUTATION: taken `jm` mis-charged 5T (not 10T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.a = 0xb0; m.regs.c = 0x00;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1590 ? 5 : c); // step-to-0x1590 = the taken jm arm
  loc_1590(m);
  assert.equal(m.tstates, 100, "mutation loses 4*5 T across the 4 taken jm arms");
  assert.notEqual(m.tstates, 120, "golden T-state total catches the mutant");
});
