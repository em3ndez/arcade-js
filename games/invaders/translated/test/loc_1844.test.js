// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for translated loc_1844 (ROM 0x1844-0x184b): save BC, set B=0x10, draw via 0x1439,
// restore BC, ret. The mock `call` pops the pushed return (models the callee's ret) so push b/pop b
// stay balanced across the call -- BC comes back intact and ret lands on the seated caller.
// Run: node --test games/invaders/translated/test/loc_1844.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1844 } from "../loc_1844.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1844, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

test("loc_1844: preserves BC across the 0x1439 draw, rets; 55 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.bc = 0x1d55; // script pointer to preserve

  loc_1844(m);

  assert.equal(m.regs.bc, 0x1d55, "BC restored by pop b (push/pop balanced across call)");
  assert.equal(m.regs.sp, 0x2400, "stack fully unwound");
  assert.equal(m.pc, CALLER_RET, "ret returns to the seated caller");
  assert.equal(m.tstates, 11 + 7 + 17 + 10 + 10, "push+mvi+call+pop+ret");
  assert.deepEqual(m.calls, [0x1439], "one draw delegation");
  assert.deepEqual(m.pcSeq, [0x1845, 0x1847, 0x1439, 0x184b, CALLER_RET], "step boundaries");
  assert.equal(m.mem.read16(0x23fc), 0x1d55, "push b stored BC on the stack");
});

test("loc_1844 MUTATION: `push b` mis-charged 5T (not 11T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.bc = 0x1d55;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1845 ? 5 : c);
  loc_1844(m);
  assert.equal(m.tstates, 55 - 6, "mutation loses 6 T (11 -> 5)");
  assert.notEqual(m.tstates, 55, "golden T-state total catches the mutant");
});
