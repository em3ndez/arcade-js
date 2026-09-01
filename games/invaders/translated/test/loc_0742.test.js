// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0742 (ROM 0x0742-0x074a): seats HL=0x2087, calls 0x1a3b, tail-jumps
// into loc_1a47. Run: node --test games/invaders/translated/test/loc_0742.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0742 } from "../loc_0742.js";

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

test("loc_0742: HL:=0x2087, calls 0x1a3b, delegates to 0x1a47; 37 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;

  loc_0742(m);

  assert.equal(m.regs.hl, 0x2087, "HL := 0x2087");
  assert.equal(m.tstates, 10 + 17 + 10, "T: lxi(10)+call(17)+jmp(10)");
  assert.equal(m.pc, 0x1a47, "last step lands at the delegate");
  assert.deepEqual(m.calls, [0x1a3b, 0x1a47], "call 0x1a3b then tail-jmp 0x1a47");
  assert.deepEqual(m.pcSeq, [0x0745, 0x1a3b, 0x1a47], "step boundaries");
  assert.equal(m.mem.read16(0x23fe), 0x0748, "call 0x1a3b pushes return 0x0748");
});

test("loc_0742 MUTATION: call 0x1a3b mischarged 11T (cond) not 17T is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1a3b ? 11 : c);
  loc_0742(m);
  assert.equal(m.tstates, 10 + 11 + 10, "mutation loses 6 T");
  assert.notEqual(m.tstates, 37, "golden T-state total catches the mutant");
});
