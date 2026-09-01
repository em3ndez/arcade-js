// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0a59 (ROM 0x0a59-0x0a5e): reads [0x2015], compares to 0xff (flags only),
// then rets. Pins the Z/C the compare leaves (the poll answer loc_0a3c branches on) and the T-states.
//
// Run: node --test games/invaders/translated/test/loc_0a59.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0a59 } from "../loc_0a59.js";

const CALLER_RET = 0xbe2f;

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
    regs, mem, ram, calls: [], pushed: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { this.pushed.push(v & 0xffff); regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seat(m) { m.regs.sp = 0x2400; m.push16(CALLER_RET); m.pushed = []; m.calls = []; m.tstates = 0; m.pcSeq = []; m.pc = 0; }

test("loc_0a59: [0x2015]==0xff -> Z set, C clear, rets to caller; 30 T", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x2015, 0xff);

  loc_0a59(m);

  assert.equal(m.regs.a, 0xff, "A := [0x2015]");
  assert.equal(m.regs.fZ, true, "cpi 0xff of 0xff -> Z set");
  assert.equal(m.regs.fC, false, "no borrow -> C clear");
  assert.equal(m.tstates, 13 + 7 + 10, "lda(13)+cpi(7)+ret(10)");
  assert.equal(m.pc, CALLER_RET, "rets to the seated caller");
  assert.deepEqual(m.pcSeq, [0x0a5c, 0x0a5e, CALLER_RET], "step boundaries");
  assert.deepEqual(m.calls, [], "no delegations");
});

test("loc_0a59: [0x2015]!=0xff -> Z clear, C set (0x10 - 0xff borrows)", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x2015, 0x10);

  loc_0a59(m);

  assert.equal(m.regs.a, 0x10, "A unchanged by cpi");
  assert.equal(m.regs.fZ, false, "0x10 != 0xff -> Z clear");
  assert.equal(m.regs.fC, true, "0x10 - 0xff borrows -> C set");
  assert.equal(m.tstates, 30, "T total unchanged");
});

test("loc_0a59 MUTATION: `lda 0x2015` mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x2015, 0xff);
  const rs = m.step.bind(m);
  m.step = (n, c) => rs(n, n === 0x0a5c ? 7 : c);
  loc_0a59(m);
  assert.equal(m.tstates, 7 + 7 + 10, "mutation loses 6 T (13 -> 7)");
  assert.notEqual(m.tstates, 30, "golden T-state total catches the mutant");
});
