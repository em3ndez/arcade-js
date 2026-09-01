// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_19d3 (ROM 0x19d3-0x19d6): stores A at 0x20e9, returns.
// Run: node --test games/invaders/translated/test/loc_19d3.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_19d3 } from "../loc_19d3.js";

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

test("loc_19d3: (0x20e9) := A, ret; 23 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.push16(CALLER_RET);
  m.regs.a = 0x00; // entered A=0 via loc_19d7

  loc_19d3(m);

  assert.equal(m.mem.read8(0x20e9), 0x00, "(0x20e9) := A");
  assert.equal(m.tstates, 13 + 10, "T total: sta(13)+ret(10)");
  assert.equal(m.pc, CALLER_RET, "ret pops the caller return addr");
  assert.equal(m.regs.sp, 0x2400, "SP restored after ret");
  assert.deepEqual(m.calls, [], "no delegations");
});

test("loc_19d3 MUTATION: `sta 0x20e9` mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.push16(CALLER_RET);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x19d6 ? 7 : c);
  loc_19d3(m);
  assert.notEqual(m.tstates, 23, "golden T-state total catches the mutant");
});
