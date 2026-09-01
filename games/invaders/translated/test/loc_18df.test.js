// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_18df (ROM 0x18df-0x18e6): write 0x20cf := 8, then tail-jmp to loc_0aea.
// The record-only mock records the delegate; no ret, no push -- a straight-line 3-instruction head.
//
// Run: node --test games/invaders/translated/test/loc_18df.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_18df } from "../loc_18df.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x18df, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

test("loc_18df: 0x20cf := 8, tail-jmp loc_0aea; 30 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;

  loc_18df(m);

  assert.equal(m.mem.read8(0x20cf), 0x08, "0x20cf := 8");
  assert.equal(m.regs.a, 0x08, "A := 8");
  assert.deepEqual(m.calls, [0x0aea], "tail-delegates to loc_0aea");
  assert.equal(m.tstates, 7 + 13 + 10, "mvi(7)+sta(13)+jmp(10)");
  assert.equal(m.pc, 0x0aea, "last step lands at loc_0aea");
  assert.deepEqual(m.pcSeq, [0x18e1, 0x18e4, 0x0aea], "step boundaries");
});

test("loc_18df MUTATION: `sta 0x20cf` mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x18e4 ? 7 : c); // sta -> step 0x18e4, real 13T
  loc_18df(m);
  assert.equal(m.tstates, 24, "mutation loses 6 T (13 -> 7)");
  assert.notEqual(m.tstates, 30, "golden T-state total catches the mutant");
});
