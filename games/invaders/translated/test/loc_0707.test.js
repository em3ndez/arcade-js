// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0707 (ROM 0x0707-0x070b): B := 0xfe then unconditional tail-jump
// into loc_19dc (delegation recorded in m.calls). Pins the register write, the two step
// boundaries, the exact T-states (MAME i8080), and the delegate.
//
// Run: node --test games/invaders/translated/test/loc_0707.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0707 } from "../loc_0707.js";

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

test("loc_0707: B := 0xfe, tail-jumps to loc_19dc; 17 T", () => {
  const m = makeMachine();

  loc_0707(m);

  assert.equal(m.regs.b, 0xfe, "B := 0xfe");
  assert.equal(m.tstates, 7 + 10, "T total: mvi(7)+jmp(10)");
  assert.equal(m.pc, 0x19dc, "last step lands at the tail-jump target");
  assert.deepEqual(m.calls, [0x19dc], "tail-delegates to loc_19dc");
  assert.deepEqual(m.pcSeq, [0x0709, 0x19dc], "step boundaries");
});

test("loc_0707 MUTATION: `jmp 0x19dc` mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x19dc ? 7 : c);
  loc_0707(m);
  assert.equal(m.tstates, 7 + 7, "mutation loses 3 T (10 -> 7)");
  assert.notEqual(m.tstates, 17, "golden T-state total catches the mutant");
});
