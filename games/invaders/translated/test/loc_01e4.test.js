// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_01e4 (ROM 0x01e4-0x01e5): preset B=0xc0 then fall through into the
// shared entry loc_01e6 (next band). Pins the B seat, the fall-through delegate, and 7 T.
//
// Run: node --test games/invaders/translated/test/loc_01e4.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_01e4 } from "../loc_01e4.js";

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

test("loc_01e4: presets B=0xc0, falls through into loc_01e6; 7 T", () => {
  const m = makeMachine();

  loc_01e4(m);

  assert.equal(m.regs.b, 0xc0, "B := 0xc0");
  assert.deepEqual(m.calls, [0x01e6], "falls through into loc_01e6");
  assert.equal(m.pc, 0x01e6, "last step lands at the shared entry");
  assert.equal(m.tstates, 7, "mvi b is 7 T");
});

test("loc_01e4 MUTATION: `mvi b` mis-charged 4T (not 7) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x01e6 ? 4 : c);
  loc_01e4(m);
  assert.equal(m.tstates, 4, "mutation loses 3 T (7 -> 4)");
  assert.notEqual(m.tstates, 7, "golden T-state total catches the mutant");
});
