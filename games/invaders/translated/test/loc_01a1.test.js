// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_01a1 (ROM 0x01a1-0x01be): DCR D then either abort to 0x01cd (D==0)
// or run the body (clear 0x2006/0x2007, call 0x01d9, toggle bit0 of 0x2005, H:=*0x2067, ret).
// The record-only mock does not unwind the internal call, so the final RET pops that call's own
// pushed frame (0x01b1) -- asserted directly. Both arms are covered.
//
// Run: node --test games/invaders/translated/test/loc_01a1.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_01a1 } from "../loc_01a1.js";

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

function seatBody() {
  const m = makeMachine();
  m.regs.d = 0x02;            // DCR -> 0x01, non-zero -> body arm
  m.regs.b = 0xaa;            // untouched sentinel
  m.regs.e = 0x77;            // untouched sentinel
  m.regs.sp = 0x2400;
  m.mem.write8(0x2007, 0x55); // -> C (read before it is zeroed)
  m.mem.write8(0x2005, 0x00); // toggled to 0x01
  m.mem.write8(0x2067, 0x24); // -> H
  return m;
}

test("loc_01a1 body arm: clears 0x2006/0x2007, calls 0x01d9, toggles 0x2005, H:=*0x2067; 141 T", () => {
  const m = seatBody();

  loc_01a1(m);

  assert.equal(m.regs.d, 0x01, "DCR D");
  assert.equal(m.regs.c, 0x55, "C loaded from 0x2007 before the zero-store");
  assert.equal(m.regs.a, 0x00, "XRA A at the tail");
  assert.equal(m.regs.b, 0xaa, "B untouched by this routine");
  assert.equal(m.regs.e, 0x77, "E untouched by this routine");
  assert.equal(m.regs.hl, 0x2467, "H:=*0x2067 (0x24), L still 0x67");
  assert.equal(m.mem.read8(0x2006), 0x00, "0x2006 cleared");
  assert.equal(m.mem.read8(0x2007), 0x00, "0x2007 cleared");
  assert.equal(m.mem.read8(0x2005), 0x01, "bit0 of 0x2005 toggled 0->1");
  assert.deepEqual(m.calls, [0x01d9], "delegates to the 0x01d9 tally");
  assert.equal(m.mem.read16(0x23fe), 0x01b1, "call 0x01d9 pushes return addr 0x01b1");
  assert.equal(m.regs.sp, 0x2400, "push16 + RET balance (RET pops the call frame in this mock)");
  assert.equal(m.pc, 0x01b1, "RET pops the internal call frame (record-only mock)");
  assert.equal(m.tstates, 141, "T total on the body arm");
});

test("loc_01a1 abort arm: D->0 delegates to loc_01cd; 15 T", () => {
  const m = makeMachine();
  m.regs.d = 0x01; // DCR -> 0x00 -> JZ taken
  m.regs.sp = 0x2400;

  loc_01a1(m);

  assert.equal(m.regs.d, 0x00, "DCR D reached zero");
  assert.deepEqual(m.calls, [0x01cd], "delegates to the abort block");
  assert.equal(m.pc, 0x01cd, "last step lands at the abort head");
  assert.equal(m.tstates, 15, "DCR(5) + JZ taken(10)");
});

test("loc_01a1 MUTATION: `call 0x01d9` mis-charged 11T (cond not-taken) not 17T is caught", () => {
  const m = seatBody();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x01d9 ? 11 : c);
  loc_01a1(m);
  assert.equal(m.tstates, 135, "mutation loses 6 T (17 -> 11)");
  assert.notEqual(m.tstates, 141, "golden T-state total catches the mutant");
});
