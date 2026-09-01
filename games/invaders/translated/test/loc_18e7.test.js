// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_18e7 (ROM 0x18e7-0x18f0): rrc of (0x2067) picks whether HL (=0x20e7)
// is bumped. Pins both arms, register/T-state totals, and no delegations.
//
// Run: node --test games/invaders/translated/test/loc_18e7.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_18e7 } from "../loc_18e7.js";

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

function seatCaller(m) { m.regs.sp = 0x2400; m.push16(CALLER_RET); }

test("loc_18e7 bit0=1 arm: rnc not taken, HL bumped to 0x20e8; 47 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x2067, 0x01);

  loc_18e7(m);

  assert.equal(m.regs.a, 0x80, "A: 0x01 rrc -> 0x80");
  assert.equal(m.regs.hl, 0x20e8, "HL: 0x20e7 + inx h");
  assert.equal(m.tstates, 13 + 10 + 4 + 5 + 5 + 10, "T: lda+lxi+rrc+rnc(nt)+inx+ret");
  assert.equal(m.pc, CALLER_RET, "final ret returns to caller");
  assert.deepEqual(m.calls, [], "no delegations");
  assert.deepEqual(m.pcSeq, [0x18ea, 0x18ed, 0x18ee, 0x18ef, 0x18f0, CALLER_RET], "step boundaries");
});

test("loc_18e7 bit0=0 arm: rnc taken, early return, HL stays 0x20e7; 38 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x2067, 0x00);

  loc_18e7(m);

  assert.equal(m.regs.hl, 0x20e7, "HL not bumped on early return");
  assert.equal(m.tstates, 13 + 10 + 4 + 11, "T: lda+lxi+rrc+rnc(taken)");
  assert.equal(m.pc, CALLER_RET, "rnc returns to caller");
});

test("loc_18e7 MUTATION: rnc mis-charged 11T (taken) on the not-taken arm is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x2067, 0x01);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x18ef ? 11 : c); // 0x18ef is the not-taken successor
  loc_18e7(m);
  assert.notEqual(m.tstates, 47, "golden T-state total catches the mutant");
});
