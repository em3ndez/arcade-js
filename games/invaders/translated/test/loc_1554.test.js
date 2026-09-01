// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_1554 (ROM 0x1554-0x1561): the scale/count helper. Pins the interior
// 0x155a loop (A += 0x10, C++ until A >= H via rnc), the `cnc 0x1590` delegation arm, register
// writes, exact MAME i8080 T-states, the m.calls sequence, and the pushed return address.
//
// Run: node --test games/invaders/translated/test/loc_1554.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1554 } from "../loc_1554.js";

const CALLER_RET = 0xbeef;

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

test("loc_1554: A<H loops 0x155a to A>=H, counts C; cnc not taken; 99 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.a = 0x05; m.regs.h = 0x25; m.regs.f = 0; // carry clear

  loc_1554(m);

  assert.equal(m.regs.c, 0x02, "C := two 0x10 steps (0x05->0x15->0x25)");
  assert.equal(m.regs.a, 0x25, "A ends at 0x25 (== H)");
  assert.deepEqual(m.calls, [], "cnc 0x1590 not taken (A<H at entry -> carry set)");
  assert.equal(m.pc, CALLER_RET, "rnc pops the caller return");
  assert.equal(m.regs.sp, 0x2400, "SP restored by the rnc pop");
  assert.equal(m.tstates, 99, "7+4+11 + 31 + 31 + 15 = 99 T");
});

test("loc_1554: A>=H at entry takes cnc 0x1590 then rnc; delegates, 43 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; // the cnc push doubles as the rnc pop source
  m.regs.a = 0x30; m.regs.h = 0x20; m.regs.f = 0;

  loc_1554(m);

  assert.deepEqual(m.calls, [0x1590], "cnc 0x1590 taken (A>=H -> carry clear)");
  assert.equal(m.pc, 0x155a, "rnc pops the 0x155a pushed by cnc");
  assert.equal(m.regs.c, 0x00, "record-only call leaves C untouched -> rnc immediately");
  assert.equal(m.regs.a, 0x30, "A untouched (loop body never runs)");
  assert.equal(m.tstates, 43, "7+4+17 + 4+11 = 43 T");
});

test("loc_1554 MUTATION: mis-charging the taken rnc 5T (not 11T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.a = 0x05; m.regs.h = 0x25; m.regs.f = 0;
  const realRet = m.ret.bind(m);
  m.ret = (c) => realRet(5); // mutant: charge the not-taken rnc value on the taken arm
  loc_1554(m);
  assert.equal(m.tstates, 93, "mutation loses 6 T (11 -> 5)");
  assert.notEqual(m.tstates, 99, "golden T-state total catches the mutant");
});
