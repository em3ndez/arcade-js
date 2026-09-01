// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_073c (ROM 0x073c-0x0741): calls 0x0742 then tail-jumps into loc_1439.
// Run: node --test games/invaders/translated/test/loc_073c.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_073c } from "../loc_073c.js";

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

test("loc_073c: calls 0x0742, delegates to 0x1439; 27 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;

  loc_073c(m);

  assert.equal(m.tstates, 17 + 10, "T: call(17)+jmp(10)");
  assert.equal(m.pc, 0x1439, "last step lands at the delegate");
  assert.deepEqual(m.calls, [0x0742, 0x1439], "call 0x0742 then tail-jmp 0x1439");
  assert.deepEqual(m.pcSeq, [0x0742, 0x1439], "step boundaries");
  assert.equal(m.mem.read16(0x23fe), 0x073f, "call 0x0742 pushes return 0x073f");
});

test("loc_073c MUTATION: call 0x0742 mischarged 11T not 17T is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0742 ? 11 : c);
  loc_073c(m);
  assert.equal(m.tstates, 11 + 10, "mutation loses 6 T");
  assert.notEqual(m.tstates, 27, "golden T-state total catches the mutant");
});
