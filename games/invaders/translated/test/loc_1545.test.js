// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_1545 (ROM 0x1545-0x1549): set prize state 0x2025 = 0x04, then fall
// through into loc_154a (recorded as a delegate).
//
// Run: node --test games/invaders/translated/test/loc_1545.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1545 } from "../loc_1545.js";

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
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

test("loc_1545: state 0x2025 := 0x04, delegates into loc_154a; 20 T", () => {
  const m = makeMachine();

  loc_1545(m);

  assert.equal(m.regs.a, 0x04, "A := 0x04");
  assert.equal(m.mem.read8(0x2025), 0x04, "state 0x2025 := 0x04");
  assert.equal(m.tstates, 7 + 13, "mvi + sta");
  assert.deepEqual(m.calls, [0x154a], "falls through into loc_154a");
  assert.equal(m.pc, 0x154a, "last step lands at the loc_154a entry");
});

test("loc_1545 MUTATION: `sta 0x2025` mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x154a ? 7 : c); // sta lands at 0x154a
  loc_1545(m);
  assert.notEqual(m.tstates, 20, "golden T-state total catches the mutant");
});
