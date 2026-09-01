// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for translated loc_01f5 (ROM 0x01f5-0x01f7): seeds HL=0x2242, then falls through
// into the shared body loc_01f8. Record-only mock pins the seat, T-states, step boundary, and the
// delegate. Run: node --test games/invaders/translated/test/loc_01f5.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_01f5 } from "../loc_01f5.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x01f5, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

test("loc_01f5: seeds HL=0x2242, falls through to loc_01f8; 10 T", () => {
  const m = makeMachine();

  loc_01f5(m);

  assert.equal(m.regs.hl, 0x2242, "HL := 0x2242");
  assert.equal(m.tstates, 10, "T: lxi(10)");
  assert.equal(m.pc, 0x01f8, "last step lands at the fall-through head");
  assert.deepEqual(m.pcSeq, [0x01f8], "single step boundary");
  assert.deepEqual(m.calls, [0x01f8], "falls through into loc_01f8");
});

test("loc_01f5 MUTATION: `lxi h` mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x01f8 ? 7 : c);
  loc_01f5(m);
  assert.equal(m.tstates, 7, "mutation loses 3 T (10 -> 7)");
  assert.notEqual(m.tstates, 10, "golden T-state total catches the mutant");
});
