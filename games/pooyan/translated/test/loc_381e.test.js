// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for translated loc_381e (ROM 0x381e-0x3828, Pooyan) -- the SET ANIMATION
// helper: stores DE into (ix+0x0c:ix+0x0d) and zeroes the frame index (ix+0x0e), then `ret`.
// Flat-RAM mock (real Regs), record-only `call` (leaf routine makes none). The pushed caller
// return proves the exit, and the golden T-state (67) is independently hand-summed.
//
// Run: node --test games/pooyan/translated/test/loc_381e.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_381e } from "../loc_381e.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x381e, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_381e: DE=0x3bd1, IX=0x8b00 -> (ix+0x0c:0x0d)=DE, (ix+0x0e)=0; 67 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8b00;
  m.regs.de = 0x3bd1;
  m.mem.write8(0x8b0e, 0x99); // pre-existing frame index, must be cleared

  loc_381e(m);

  assert.equal(m.tstates, 67, "loc_381e T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.deepEqual(m.calls, [], "leaf: no calls");
  assert.equal(m.mem.read8(0x8b0c), 0xd1, "(ix+0x0c) = E");
  assert.equal(m.mem.read8(0x8b0d), 0x3b, "(ix+0x0d) = D");
  assert.equal(m.mem.read8(0x8b0e), 0x00, "(ix+0x0e) frame index zeroed");
  assert.deepEqual(m.pcSeq, [0x3821, 0x3824, 0x3828, CALLER_RET], "step boundaries");
});

test("loc_381e MUTATION: first `ld (ix+d),e` mis-charged 7T (not 19T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8b00;
  m.regs.de = 0x1234;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3821 ? 7 : c);
  loc_381e(m);
  assert.equal(m.tstates, 55, "mutation loses 12 T (19 -> 7)");
  assert.notEqual(m.tstates, 67, "golden T-state total catches the mutant");
});
