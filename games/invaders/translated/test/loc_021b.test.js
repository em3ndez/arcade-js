// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for translated loc_021b (ROM 0x021b-0x021d): seeds DE=0x2142, then falls through
// into the shared body loc_021e. Record-only mock pins the seat, T-states, step boundary, and the
// delegate. Run: node --test games/invaders/translated/test/loc_021b.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_021b } from "../loc_021b.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x021b, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

test("loc_021b: seeds DE=0x2142, falls through to loc_021e; 10 T", () => {
  const m = makeMachine();

  loc_021b(m);

  assert.equal(m.regs.de, 0x2142, "DE := 0x2142");
  assert.equal(m.tstates, 10, "T: lxi(10)");
  assert.equal(m.pc, 0x021e, "last step lands at the fall-through head");
  assert.deepEqual(m.pcSeq, [0x021e], "single step boundary");
  assert.deepEqual(m.calls, [0x021e], "falls through into loc_021e");
});

test("loc_021b MUTATION: `lxi d` mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x021e ? 7 : c);
  loc_021b(m);
  assert.equal(m.tstates, 7, "mutation loses 3 T (10 -> 7)");
  assert.notEqual(m.tstates, 10, "golden T-state total catches the mutant");
});
