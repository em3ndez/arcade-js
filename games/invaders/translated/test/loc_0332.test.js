// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0332 (ROM 0x0332-0x0337): calls the 0x0209 setup helper then tail-jumps
// into loc_02f8. Pins the call return address, the delegate order, and the T-states. The routine
// never pops, so the mock's `call` stays record-only.
//
// Run: node --test games/invaders/translated/test/loc_0332.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0332 } from "../loc_0332.js";

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

test("loc_0332: calls 0x0209, delegates to loc_02f8; 27 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;

  loc_0332(m);

  assert.equal(m.tstates, 27, "call(17)+jmp(10)");
  assert.equal(m.mem.read16(0x23fe), 0x0335, "call 0x0209 pushes return addr 0x0335");
  assert.equal(m.pc, 0x02f8, "last step lands at the loc_02f8 entry");
  assert.deepEqual(m.calls, [0x0209, 0x02f8], "call 0x0209 then delegate to loc_02f8");
  assert.deepEqual(m.pcSeq, [0x0209, 0x02f8], "step boundaries");
});

test("loc_0332 MUTATION: `jmp 0x02f8` mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x02f8 ? 7 : c);
  loc_0332(m);
  assert.equal(m.tstates, 24, "mutation loses 3 T (10 -> 7)");
  assert.notEqual(m.tstates, 27, "golden T-state total catches the mutant");
});
