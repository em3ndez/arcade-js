// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_01c3 (ROM 0x01c3-0x01cc): HL-relative fill of 0x37 bytes with 0x01,
// then RET. Seats HL=0x2200 (not the loc_01c0 default) to prove the span follows HL. Pins both
// span boundaries, B=0, HL past the end, the RET pop, and the 55-iteration T total.
//
// Run: node --test games/invaders/translated/test/loc_01c3.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_01c3 } from "../loc_01c3.js";

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

function seat() {
  const m = makeMachine();
  m.regs.hl = 0x2200; // caller-supplied fill base
  m.regs.sp = 0x2400;
  m.push16(0xcafe);   // caller return frame
  return m;
}

test("loc_01c3: fills 0x2200..0x2236 with 0x01, RETs; 1667 T", () => {
  const m = seat();

  loc_01c3(m);

  for (let a = 0x2200; a <= 0x2236; a++) assert.equal(m.mem.read8(a), 0x01, `0x${a.toString(16)} filled`);
  assert.equal(m.mem.read8(0x21ff), 0x00, "byte before the span untouched");
  assert.equal(m.mem.read8(0x2237), 0x00, "byte after the span untouched");
  assert.equal(m.regs.b, 0x00, "counter drained to 0");
  assert.equal(m.regs.hl, 0x2237, "HL walked one past the last store");
  assert.equal(m.regs.sp, 0x2400, "RET pops the pushed frame");
  assert.equal(m.pc, 0xcafe, "RET returns to the caller");
  assert.deepEqual(m.calls, [], "no delegations");
  assert.equal(m.tstates, 1667, "7 + 55*(10+5+5+10) + 10");
});

test("loc_01c3 MUTATION: `mvi b` mis-charged 4T (not 7) is caught", () => {
  const m = seat();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x01c5 && m.tstates === 0 ? 4 : c);
  loc_01c3(m);
  assert.equal(m.tstates, 1664, "mutation loses 3 T (7 -> 4)");
  assert.notEqual(m.tstates, 1667, "golden T-state total catches the mutant");
});
