// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_18f1 (ROM 0x18f1-0x18f9): B:=2, and B->3 only when (0x2082)==1
// (dcr a -> zero -> rnz not taken). Pins both arms and T-state totals.
//
// Run: node --test games/invaders/translated/test/loc_18f1.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_18f1 } from "../loc_18f1.js";

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
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x2400; m.push16(CALLER_RET); }

test("loc_18f1 (0x2082)==1 arm: rnz not taken, B->3; 45 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x2082, 0x01);

  loc_18f1(m);

  assert.equal(m.regs.a, 0x00, "A: 1 dcr -> 0");
  assert.equal(m.regs.b, 0x03, "B: 2 + inr b");
  assert.equal(m.tstates, 7 + 13 + 5 + 5 + 5 + 10, "T: mvi+lda+dcr+rnz(nt)+inr+ret");
  assert.equal(m.pc, CALLER_RET, "final ret to caller");
  assert.deepEqual(m.calls, [], "no delegations");
  assert.deepEqual(m.pcSeq, [0x18f3, 0x18f6, 0x18f7, 0x18f8, 0x18f9, CALLER_RET], "step boundaries");
});

test("loc_18f1 (0x2082)!=1 arm: rnz taken, B stays 2; 36 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x2082, 0x05);

  loc_18f1(m);

  assert.equal(m.regs.a, 0x04, "A: 5 dcr -> 4");
  assert.equal(m.regs.b, 0x02, "B unchanged on early return");
  assert.equal(m.tstates, 7 + 13 + 5 + 11, "T: mvi+lda+dcr+rnz(taken)");
  assert.equal(m.pc, CALLER_RET, "rnz returns to caller");
});

test("loc_18f1 MUTATION: inr b written as B stays 2 (dropped) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x2082, 0x01);
  loc_18f1(m);
  assert.notEqual(m.regs.b, 0x02, "the golden B==3 catches a dropped inr b");
});
