// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_075f (ROM 0x075f-0x0764): seats DE=0x1b83 then tail-jumps into loc_1a32.
// Run: node --test games/invaders/translated/test/loc_075f.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_075f } from "../loc_075f.js";

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

test("loc_075f: DE:=0x1b83, delegates to 0x1a32; 20 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;

  loc_075f(m);

  assert.equal(m.regs.de, 0x1b83, "DE := 0x1b83");
  assert.equal(m.tstates, 10 + 10, "T: lxi(10)+jmp(10)");
  assert.equal(m.pc, 0x1a32, "last step lands at the delegate");
  assert.deepEqual(m.calls, [0x1a32], "tail-jmp 0x1a32");
  assert.deepEqual(m.pcSeq, [0x0762, 0x1a32], "step boundaries");
});

test("loc_075f MUTATION: lxi d mischarged 7T not 10T is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0762 ? 7 : c);
  loc_075f(m);
  assert.equal(m.tstates, 7 + 10, "mutation loses 3 T");
  assert.notEqual(m.tstates, 20, "golden T-state total catches the mutant");
});
