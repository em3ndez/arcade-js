// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_017a (ROM 0x017a-0x01a0): given L, walk the 0x2009/0x200a record --
// loop1 subtracts 0x0b in units of 0x10 while A>=0x0b (signed), loop2 adds 0x10 to C the
// remainder times, then RZ. Seats L=0x0c so loop1 runs one full body + one taken exit, and
// loop2 runs one body + the zero exit. Pins the register writes, T-states, and the RZ pop.
//
// Run: node --test games/invaders/translated/test/loc_017a.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_017a } from "../loc_017a.js";

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

function seat() {
  const m = makeMachine();
  m.regs.l = 0x0c;            // -> A = L = 0x0c
  m.regs.sp = 0x2400;
  m.push16(0xabcd);           // caller return frame for the RZ
  m.mem.write8(0x2009, 0x20); // -> B
  m.mem.write8(0x200a, 0x30); // -> C
  return m;
}

test("loc_017a: loop1 one body + exit, loop2 one body + exit; RZ returns; 195 T", () => {
  const m = seat();

  loc_017a(m);

  assert.equal(m.regs.a, 0x00, "A counted down to 0 -> RZ");
  assert.equal(m.regs.b, 0x30, "B: 0x20 + 0x10 (one loop1 body)");
  assert.equal(m.regs.c, 0x40, "C: 0x30 + 0x10 (one loop2 body)");
  assert.equal(m.regs.d, 0x01, "D bumped once in loop1");
  assert.equal(m.regs.e, 0x01, "E holds the last remainder");
  assert.equal(m.regs.hl, 0x2030, "H=0x20 (from 0x2009), L=B=0x30");
  assert.equal(m.tstates, 195, "T total across both loops");
  assert.equal(m.regs.sp, 0x2400, "RZ pops the pushed frame -> SP restored");
  assert.equal(m.pc, 0xabcd, "RZ returns to the seated frame");
  assert.deepEqual(m.calls, [], "no delegations on this arm");
});

test("loc_017a MUTATION: RZ-not-taken step mis-charged 4T (not 5) is caught", () => {
  const m = seat();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0197 ? 4 : c);
  loc_017a(m);
  assert.equal(m.tstates, 194, "mutation loses 1 T (5 -> 4)");
  assert.notEqual(m.tstates, 195, "golden T-state total catches the mutant");
});
