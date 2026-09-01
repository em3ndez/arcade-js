// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_097c (ROM 0x097c-0x0987): map A into the 3-entry table at 0x1da0 --
// HL = 0x1da0 + (A>=2 ? 1 : 0) + (A>=4 ? 1 : 0). CPI does not alter A, so both compares use the
// original A. Expected values derived from dk.asm; one arm per table slot.
//
// Run: node --test games/invaders/translated/test/loc_097c.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_097c } from "../loc_097c.js";

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

function seatCaller(m) { m.regs.sp = 0x2400; m.mem.write16(0x2400, 0x1234); }

test("loc_097c A<2 -> HL=0x1da0 (slot 0); 28 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x00;

  loc_097c(m);

  assert.equal(m.regs.hl, 0x1da0, "A<2 returns before either inx h");
  assert.equal(m.tstates, 10 + 7 + 11, "lxi(10)+cpi(7)+rc taken(11)");
  assert.deepEqual(m.calls, [], "no delegation");
  assert.equal(m.pc, 0x1234, "returns to caller");
  assert.deepEqual(m.pcSeq, [0x097f, 0x0981, 0x1234], "step boundaries");
});

test("loc_097c 2<=A<4 -> HL=0x1da1 (slot 1); 45 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x03;

  loc_097c(m);

  assert.equal(m.regs.hl, 0x1da1, "one inx h before the second rc");
  assert.equal(m.tstates, 10 + 7 + 5 + 5 + 7 + 11, "45 T");
  assert.deepEqual(m.pcSeq, [0x097f, 0x0981, 0x0982, 0x0983, 0x0985, 0x1234], "step boundaries");
});

test("loc_097c A>=4 -> HL=0x1da2 (slot 2); 54 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x05;

  loc_097c(m);

  assert.equal(m.regs.hl, 0x1da2, "both inx h taken");
  assert.equal(m.tstates, 10 + 7 + 5 + 5 + 7 + 5 + 5 + 10, "54 T");
  assert.equal(m.pc, 0x1234, "final ret returns to caller");
  assert.deepEqual(
    m.pcSeq,
    [0x097f, 0x0981, 0x0982, 0x0983, 0x0985, 0x0986, 0x0987, 0x1234],
    "step boundaries",
  );
});

test("loc_097c MUTATION: lxi mis-charged 4T not 10T is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x05;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x097f ? 4 : c);
  loc_097c(m);
  assert.equal(m.tstates, 48, "mutation loses 6 T (lxi 10 -> 4)");
  assert.notEqual(m.tstates, 54, "golden T-state total catches the mutant");
});
