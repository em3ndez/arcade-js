// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_09ad (ROM 0x09ad-0x09b1): emit D then E as hex -- A:=D, call 0x09b2,
// A:=E, then fall through into loc_09b2 (a second m.call, no step). Expected values from dk.asm.
// The record-only call leaves its pushed return (0x09b1) on the stack; there is no ret here, so it
// simply remains -- asserted directly.
//
// Run: node --test games/invaders/translated/test/loc_09ad.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_09ad } from "../loc_09ad.js";

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

test("loc_09ad: A:=D, call 09b2, A:=E, fall through to 09b2; 27 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.regs.d = 0x12;
  m.regs.e = 0x34;

  loc_09ad(m);

  assert.equal(m.regs.a, 0x34, "A := E after the first emit");
  assert.equal(m.regs.d, 0x12, "D preserved");
  assert.equal(m.regs.e, 0x34, "E preserved");
  assert.equal(m.tstates, 5 + 17 + 5, "mov(5)+call(17)+mov(5); fall-through call has no step");
  assert.deepEqual(m.calls, [0x09b2, 0x09b2], "call for D, then fall-through for E");
  assert.equal(m.mem.read16(0x23fe), 0x09b1, "call 0x09b2 pushes return addr 0x09b1");
  assert.equal(m.regs.sp, 0x23fe, "SP holds the un-popped internal push (no ret here)");
  assert.equal(m.pc, 0x09b2, "last step is A:=E landing at 0x09b2");
  assert.deepEqual(m.pcSeq, [0x09ae, 0x09b2, 0x09b2], "step boundaries");
});

test("loc_09ad MUTATION: mov a,d mis-charged 4T not 5T is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x09ae ? 4 : c);
  loc_09ad(m);
  assert.equal(m.tstates, 4 + 17 + 5, "mutation loses 1 T (mov 5 -> 4)");
  assert.notEqual(m.tstates, 27, "golden T-state total catches the mutant");
});
