// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_08f1 (ROM 0x08f1-0x08f2): seed C=0x03, then fall through into loc_08f3.
// The mock records the m.call target rather than running it, so this pins the C seat, the single
// mvi's T-state (MAME i8080), the fall-through step boundary, and the delegate to loc_08f3.
//
// Run: node --test games/invaders/translated/test/loc_08f1.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_08f1 } from "../loc_08f1.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x08f1, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

test("loc_08f1: seeds C=0x03, delegates to loc_08f3; 7 T", () => {
  const m = makeMachine();
  m.regs.c = 0xff; // clobber to prove the routine seats it

  loc_08f1(m);

  assert.equal(m.regs.c, 0x03, "C := 0x03 (3-entry count)");
  assert.equal(m.tstates, 7, "T total: mvi c,0x03 (7T)");
  assert.equal(m.pc, 0x08f3, "step lands at loc_08f3");
  assert.deepEqual(m.calls, [0x08f3], "delegates to loc_08f3");
  assert.deepEqual(m.pcSeq, [0x08f3], "single step boundary");
});

test("loc_08f1 MUTATION: mvi c mis-charged 5T (not 7T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x08f3 ? 5 : c);
  loc_08f1(m);
  assert.equal(m.tstates, 5, "mutation loses 2 T (7 -> 5)");
  assert.notEqual(m.tstates, 7, "golden T-state total catches the mutant");
});
