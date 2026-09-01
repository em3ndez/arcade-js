// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for translated loc_01ef (ROM 0x01ef-0x01f4): seeds HL=0x2142, then tail-delegates
// into the shared body loc_01f8. Record-only mock pins the seat, T-states, step boundaries, and
// the delegate. Run: node --test games/invaders/translated/test/loc_01ef.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_01ef } from "../loc_01ef.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x01ef, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

test("loc_01ef: seeds HL=0x2142, tail-delegates to loc_01f8; 20 T", () => {
  const m = makeMachine();

  loc_01ef(m);

  assert.equal(m.regs.hl, 0x2142, "HL := 0x2142");
  assert.equal(m.tstates, 10 + 10, "T: lxi(10)+jmp(10)");
  assert.equal(m.pc, 0x01f8, "last step lands at the tail target");
  assert.deepEqual(m.pcSeq, [0x01f2, 0x01f8], "step boundaries");
  assert.deepEqual(m.calls, [0x01f8], "tail-delegates to loc_01f8");
});

test("loc_01ef MUTATION: `jmp` mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x01f8 ? 7 : c);
  loc_01ef(m);
  assert.equal(m.tstates, 10 + 7, "mutation loses 3 T (10 -> 7)");
  assert.notEqual(m.tstates, 20, "golden T-state total catches the mutant");
});
