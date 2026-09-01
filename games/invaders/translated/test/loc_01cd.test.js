// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_01cd (ROM 0x01cd-0x01ce): POP H then RET -- a two-level unwind. The
// top-of-stack word lands in HL (discarded frame); the next word is the return address. Pins
// both pops, SP balance, and the 20 T total.
//
// Run: node --test games/invaders/translated/test/loc_01cd.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_01cd } from "../loc_01cd.js";

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
  m.regs.sp = 0x2400;
  m.push16(0x5678); // deeper frame -> the RET target
  m.push16(0x1234); // top frame -> discarded into HL
  return m;
}

test("loc_01cd: POP H discards top frame into HL, RET to the frame below; 20 T", () => {
  const m = seat();

  loc_01cd(m);

  assert.equal(m.regs.hl, 0x1234, "top-of-stack word popped into HL");
  assert.equal(m.pc, 0x5678, "RET returns to the deeper frame");
  assert.equal(m.regs.sp, 0x2400, "both words popped -> SP restored");
  assert.equal(m.tstates, 20, "POP H(10) + RET(10)");
  assert.deepEqual(m.calls, [], "no delegations");
});

test("loc_01cd MUTATION: POP H mis-charged 5T (not 10) is caught", () => {
  const m = seat();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x01ce ? 5 : c);
  loc_01cd(m);
  assert.equal(m.tstates, 15, "mutation loses 5 T (10 -> 5)");
  assert.notEqual(m.tstates, 20, "golden T-state total catches the mutant");
});
