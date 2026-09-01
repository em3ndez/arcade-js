// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_1a47 (ROM 0x1a47-0x1a5b): save BC, shift HL right by 3 (through carry),
// force H into 0x20-0x3f, restore BC, ret. HL 0x0038 (carry 0) -> 0x0007 -> H forced -> 0x2007.
// Run: node --test games/invaders/translated/test/loc_1a47.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1a47 } from "../loc_1a47.js";

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
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

test("loc_1a47: HL 0x0038 >> 3 with H forced to 0x20xx -> 0x2007; BC preserved; 191 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.push16(CALLER_RET);
  m.regs.hl = 0x0038;
  m.regs.bc = 0x1234; // saved by push b, restored by pop b
  m.regs.fC = false;  // shift starts with carry clear

  loc_1a47(m);

  assert.equal(m.regs.hl, 0x2007, "HL := (0x0038 >> 3) with H forced into 0x20-0x3f");
  assert.equal(m.regs.bc, 0x1234, "BC restored by pop b");
  assert.equal(m.tstates, 191, "T total: push+mvi + 3 loop passes + tail + pop + ret");
  assert.equal(m.pc, CALLER_RET, "ret pops the caller return addr");
  assert.equal(m.regs.sp, 0x2400, "SP balanced (push b / pop b, caller push / final ret)");
  assert.deepEqual(m.calls, [], "no delegations");
});

test("loc_1a47 MUTATION: `push b` mis-charged 5T (not 11T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.push16(CALLER_RET);
  m.regs.hl = 0x0038;
  m.regs.bc = 0x1234;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1a48 ? 5 : c); // 0x1a48 is the addr AFTER push b
  loc_1a47(m);
  assert.notEqual(m.tstates, 191, "golden T-state total catches the mutant");
});
