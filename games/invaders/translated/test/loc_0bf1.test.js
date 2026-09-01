// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0bf1 (ROM 0x0bf1-0x0bf6): call 0x190a then tail-jump into 0x199a.
// Pins the call return address, the delegate sequence, and the exact T-states (MAME i8080).
//
// Run: node --test games/invaders/translated/test/loc_0bf1.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0bf1 } from "../loc_0bf1.js";

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

test("loc_0bf1: call 0x190a then tail-jump to 0x199a; 27 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;

  loc_0bf1(m);

  assert.equal(m.tstates, 17 + 10, "T: call(17)+jmp(10)");
  assert.equal(m.pc, 0x199a, "last step lands at the delegate target");
  assert.deepEqual(m.calls, [0x190a, 0x199a], "call 0x190a then delegate to 0x199a");
  assert.deepEqual(m.pcSeq, [0x190a, 0x199a], "step boundaries");
  assert.equal(m.regs.sp, 0x23fe, "one 2-byte push");
  assert.equal(m.mem.read16(0x23fe), 0x0bf4, "call 0x190a pushes return addr 0x0bf4");
});

test("loc_0bf1 MUTATION: call 0x190a mis-charged 11T (cond not-taken) not 17T is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x190a ? 11 : c);
  loc_0bf1(m);
  assert.notEqual(m.tstates, 27, "golden T-state total catches the mutant");
});
