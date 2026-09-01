// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_1979 (ROM 0x1979-0x1981): call 0x19d7, call 0x1947, tail-jmp loc_193c.
// Pins the two calls + delegate, T-states, and the push return addresses.
// Run: node --test games/invaders/translated/test/loc_1979.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1979 } from "../loc_1979.js";

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

test("loc_1979: calls 19d7+1947, delegates to 193c; 44 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;

  loc_1979(m);

  assert.equal(m.tstates, 17 + 17 + 10, "T total: call(17)+call(17)+jmp(10)");
  assert.equal(m.pc, 0x193c, "last step lands at the delegate");
  assert.deepEqual(m.calls, [0x19d7, 0x1947, 0x193c], "two calls then delegate to loc_193c");
  assert.deepEqual(m.pcSeq, [0x19d7, 0x1947, 0x193c], "step boundaries");
  assert.equal(m.mem.read16(0x23fe), 0x197c, "call 0x19d7 pushes return addr 0x197c");
  assert.equal(m.mem.read16(0x23fc), 0x197f, "call 0x1947 pushes return addr 0x197f");
});

test("loc_1979 MUTATION: `call 0x19d7` mis-charged 11T (not 17T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x19d7 ? 11 : c);
  loc_1979(m);
  assert.notEqual(m.tstates, 44, "golden T-state total catches the mutant");
});
