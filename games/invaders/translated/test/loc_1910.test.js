// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_1910 (ROM 0x1910-0x1919): rrc of (0x2067) picks whether HL (=0x20e7)
// is bumped; here carry SET returns early (rc). Pins both arms and T totals.
//
// Run: node --test games/invaders/translated/test/loc_1910.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1910 } from "../loc_1910.js";

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

test("loc_1910 bit0=0 arm: rc not taken, HL bumped to 0x20e8; 47 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x2067, 0x00);

  loc_1910(m);

  assert.equal(m.regs.a, 0x00, "A: 0x00 rrc -> 0x00");
  assert.equal(m.regs.hl, 0x20e8, "HL: 0x20e7 + inx h");
  assert.equal(m.tstates, 10 + 13 + 4 + 5 + 5 + 10, "T: lxi+lda+rrc+rc(nt)+inx+ret");
  assert.equal(m.pc, CALLER_RET, "final ret to caller");
  assert.deepEqual(m.calls, [], "no delegations");
  assert.deepEqual(m.pcSeq, [0x1913, 0x1916, 0x1917, 0x1918, 0x1919, CALLER_RET], "step boundaries");
});

test("loc_1910 bit0=1 arm: rc taken, early return, HL stays 0x20e7; 38 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x2067, 0x01);

  loc_1910(m);

  assert.equal(m.regs.a, 0x80, "A: 0x01 rrc -> 0x80, carry set");
  assert.equal(m.regs.hl, 0x20e7, "HL not bumped on early return");
  assert.equal(m.tstates, 10 + 13 + 4 + 11, "T: lxi+lda+rrc+rc(taken)");
  assert.equal(m.pc, CALLER_RET, "rc returns to caller");
});

test("loc_1910 MUTATION: rc mis-charged 5T (not taken) on the taken arm is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x2067, 0x01);
  const realRet = m.ret.bind(m);
  m.ret = (c) => realRet(c === 11 ? 5 : c);
  loc_1910(m);
  assert.notEqual(m.tstates, 38, "golden T-state total catches the mutant");
});
