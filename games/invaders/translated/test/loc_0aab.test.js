// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0aab (ROM 0x0aab-0x0ab0): HL=0x2050 then tail-delegate into 0x024b.
// The mock records the delegate rather than running it. Pins HL, the T-states, and the target.
//
// Run: node --test games/invaders/translated/test/loc_0aab.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0aab } from "../loc_0aab.js";

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
    regs, mem, ram, calls: [], pushed: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { this.pushed.push(v & 0xffff); regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

test("loc_0aab: HL=0x2050, tail-delegates to 0x024b; 20 T", () => {
  const m = makeMachine();

  loc_0aab(m);

  assert.equal(m.regs.hl, 0x2050, "HL := 0x2050");
  assert.equal(m.tstates, 10 + 10, "lxi(10)+jmp(10)");
  assert.equal(m.pc, 0x024b, "last step lands at the delegate target");
  assert.deepEqual(m.calls, [0x024b], "tail-delegates to loc_024b");
  assert.deepEqual(m.pcSeq, [0x0aae, 0x024b], "step boundaries");
});

test("loc_0aab MUTATION: `lxi h,0x2050` mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  const rs = m.step.bind(m);
  m.step = (n, c) => rs(n, n === 0x0aae ? 7 : c);
  loc_0aab(m);
  assert.equal(m.tstates, 7 + 10, "mutation loses 3 T (10 -> 7)");
  assert.notEqual(m.tstates, 20, "golden T-state total catches the mutant");
});
