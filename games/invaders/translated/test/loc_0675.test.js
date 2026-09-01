// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0675 (ROM 0x0675-0x067d): points HL at 0x2079, calls 0x1a3b, tail-jumps
// loc_1452. Pins the HL seat, the exact T-states, the call/delegate sequence, and the return addr.
//
// Run: node --test games/invaders/translated/test/loc_0675.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0675 } from "../loc_0675.js";

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

test("loc_0675: HL:=0x2079, call 0x1a3b, tail-jump loc_1452; 37 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;

  loc_0675(m);

  assert.equal(m.regs.hl, 0x2079, "hl := 0x2079");
  assert.equal(m.tstates, 10 + 17 + 10, "T: lxi(10)+call(17)+jmp(10)");
  assert.deepEqual(m.calls, [0x1a3b, 0x1452], "call 0x1a3b then delegate loc_1452");
  assert.equal(m.mem.read16(0x23fe), 0x067b, "call 0x1a3b pushes return addr 0x067b");
  assert.equal(m.pc, 0x1452, "last step lands at the loc_1452 delegate");
});

test("loc_0675 MUTATION: `jmp 0x1452` mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1452 ? 7 : c);
  loc_0675(m);
  assert.equal(m.tstates, 10 + 17 + 7, "mutation loses 3 T (10 -> 7)");
  assert.notEqual(m.tstates, 37, "golden T-state total catches the mutant");
});
