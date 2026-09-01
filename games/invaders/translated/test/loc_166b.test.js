// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_166b (ROM 0x166b-0x166c): the `stc; ret` tail entry jumped to from 0x15c9.
// Pins that it sets carry (starting from carry clear) and returns; 14 T.
//
// Run: node --test games/invaders/translated/test/loc_166b.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_166b } from "../loc_166b.js";

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
    regs, mem, ram, calls: [], pushes: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { this.pushes.push(v & 0xffff); regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

test("loc_166b: sets carry and returns; 14 T", () => {
  const m = makeMachine();
  m.regs.fC = false; // prove stc actually sets it
  m.push16(0xbeef); m.pushes.length = 0; // return address

  loc_166b(m);

  assert.equal(m.regs.fC, true, "stc set the carry flag");
  assert.equal(m.pc, 0xbeef, "ret pops the seeded return address");
  assert.deepEqual(m.calls, [], "no delegations");
  assert.deepEqual(m.pcSeq, [0x166c, 0xbeef], "step boundaries: after stc, then ret");
  assert.equal(m.tstates, 14, "stc(4) + ret(10)");
});

test("loc_166b MUTATION: `stc` mis-charged 10T (not 4T) is caught", () => {
  const m = makeMachine();
  m.push16(0xbeef); m.pushes.length = 0;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x166c ? 10 : c); // stc's step target
  loc_166b(m);
  assert.equal(m.tstates, 20, "mutation adds 6 T (4 -> 10)");
  assert.notEqual(m.tstates, 14, "golden T-state total catches the mutant");
});
