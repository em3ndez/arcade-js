// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_08d8 (ROM 0x08d8-0x08e3): if mem[0x2082] >= 9 -> ret (rnc); else seat
// 0x207e = 0xfb and ret.
//
// Run: node --test games/invaders/translated/test/loc_08d8.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_08d8 } from "../loc_08d8.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x08d8, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

test("loc_08d8 arm LOW: mem[0x2082] < 9 -> seat 0x207e = 0xfb", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.mem.write8(0x2082, 0x05);

  loc_08d8(m);

  assert.equal(m.regs.fC, true, "0x05 - 0x09 borrows -> carry set -> rnc not taken");
  assert.equal(m.mem.read8(0x207e), 0xfb, "0x207e := 0xfb");
  assert.equal(m.regs.a, 0xfb, "A := 0xfb");
  assert.equal(m.tstates, 13 + 7 + 5 + 7 + 13 + 10, "T total (rnc not taken)");
  assert.equal(m.pc, CALLER_RET, "ret to caller");
  assert.deepEqual(m.pcSeq, [0x08db, 0x08dd, 0x08de, 0x08e0, 0x08e3, CALLER_RET], "step boundaries");
  assert.equal(m.regs.sp, 0x2400, "stack unwound by ret");
});

test("loc_08d8 arm HIGH: mem[0x2082] >= 9 -> early rnc, no write", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.mem.write8(0x2082, 0x0a);
  m.mem.write8(0x207e, 0x77); // sentinel: must stay untouched

  loc_08d8(m);

  assert.equal(m.regs.fC, false, "0x0a - 0x09 no borrow -> carry clear -> rnc taken");
  assert.equal(m.mem.read8(0x207e), 0x77, "0x207e untouched on the early-return arm");
  assert.equal(m.tstates, 13 + 7 + 11, "T total (rnc taken)");
  assert.equal(m.pc, CALLER_RET, "ret to caller");
  assert.deepEqual(m.pcSeq, [0x08db, 0x08dd, CALLER_RET], "step boundaries");
});

test("loc_08d8 boundary: mem[0x2082] == 9 -> rnc taken (cpi is >=, not >)", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.mem.write8(0x2082, 0x09);
  m.mem.write8(0x207e, 0x77);

  loc_08d8(m);

  assert.equal(m.mem.read8(0x207e), 0x77, "0x2082 == 9 returns early (equal -> no borrow)");
  assert.equal(m.tstates, 13 + 7 + 11, "T total (rnc taken)");
});

test("loc_08d8 MUTATION: rnc not-taken mis-charged 11T (not 5T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.mem.write8(0x2082, 0x05);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x08de ? 11 : c); // fall-through off rnc is 5T, not 11
  loc_08d8(m);
  assert.equal(m.tstates, 13 + 7 + 11 + 7 + 13 + 10, "mutation adds 6 T (5 -> 11)");
  assert.notEqual(m.tstates, 55, "golden T-state total catches the mutant");
});
