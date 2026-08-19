// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_02a8 (ROM 0x02a8-0x02a9): writes tile 0x01 at (hl) then tail-
// delegates into loc_02aa (a fall-through across a routine boundary, recorded in m.calls).
//
// Run: node --test games/pooyan/translated/test/loc_02a8.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_02a8 } from "../loc_02a8.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only tail dispatch
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_02a8: writes 0x01 at (hl), tail-delegates to loc_02aa; 10 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x8740;

  loc_02a8(m);

  assert.equal(m.tstates, 10, "loc_02a8 T-state total");
  assert.equal(m.mem.read8(0x8740), 0x01, "(0x8740) := 0x01");
  assert.equal(m.pc, 0x02aa, "last step lands at the loc_02aa entry");
  assert.deepEqual(m.calls, [0x02aa], "tail-delegates to loc_02aa");
  assert.deepEqual(m.pcSeq, [0x02aa], "single step boundary");
});

test("loc_02a8 MUTATION: `ld (hl),0x01` mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x8740;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x02aa ? 7 : c);
  loc_02a8(m);
  assert.equal(m.tstates, 7, "mutation loses 3 T (10 -> 7)");
  assert.notEqual(m.tstates, 10, "golden T-state total catches the mutant");
});
