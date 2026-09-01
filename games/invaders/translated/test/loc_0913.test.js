// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0913 (ROM 0x0913-0x092d): early-out if (0x2009) >= 0x78; else on
// underflow (16-bit counter at 0x2091 == 0) reload HL=0x0600 + set flag (0x2083)=1, then always
// decrement the counter and store it back. Expected values derived from dk.asm.
//
// Run: node --test games/invaders/translated/test/loc_0913.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0913 } from "../loc_0913.js";

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

// Seat a caller return addr so ret lands on a known PC (loc_0913 pushes nothing itself).
function seatCaller(m) { m.regs.sp = 0x2400; m.mem.write16(0x2400, 0x1234); }

test("loc_0913 PATH A: (0x2009) >= 0x78 -> rnc early-out; 31 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x2009, 0x80);

  loc_0913(m);

  assert.equal(m.regs.a, 0x80, "A := (0x2009)");
  assert.ok(m.regs.fNC, "0x80 - 0x78 has no borrow -> carry clear");
  assert.equal(m.tstates, 13 + 7 + 11, "lda(13)+cpi(7)+rnc taken(11)");
  assert.deepEqual(m.calls, [], "no delegation on the early-out");
  assert.equal(m.mem.read16(0x2091), 0x0000, "counter untouched");
  assert.equal(m.mem.read8(0x2083), 0x00, "flag untouched");
  assert.equal(m.regs.sp, 0x2402, "ret pops the caller return");
  assert.equal(m.pc, 0x1234, "returns to caller");
  assert.deepEqual(m.pcSeq, [0x0916, 0x0918, 0x1234], "step boundaries");
});

test("loc_0913 PATH B: below 0x78 + counter 0 -> reload HL=0x0600, flag=1, counter=0x05ff; 121 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x2009, 0x00);
  m.mem.write16(0x2091, 0x0000);

  loc_0913(m);

  assert.equal(m.regs.a, 0x01, "A := 0x01 (mvi before sta)");
  assert.equal(m.regs.hl, 0x05ff, "HL := 0x0600 then dcx h");
  assert.equal(m.mem.read8(0x2083), 0x01, "underflow sets flag (0x2083)=1");
  assert.equal(m.mem.read16(0x2091), 0x05ff, "counter stored back as 0x05ff");
  assert.equal(m.tstates, 13 + 7 + 5 + 16 + 5 + 4 + 10 + 10 + 7 + 13 + 5 + 16 + 10, "121 T");
  assert.equal(m.pc, 0x1234, "returns to caller");
  assert.deepEqual(
    m.pcSeq,
    [0x0916, 0x0918, 0x0919, 0x091c, 0x091d, 0x091e, 0x0921, 0x0924, 0x0926, 0x0929, 0x092a, 0x092d, 0x1234],
    "step boundaries (jnz not taken -> reload arm)",
  );
});

test("loc_0913 PATH C: below 0x78 + counter != 0 -> just decrement, no flag; 91 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x2009, 0x00);
  m.mem.write16(0x2091, 0x0600);

  loc_0913(m);

  assert.equal(m.regs.hl, 0x05ff, "HL := (0x2091) then dcx h");
  assert.equal(m.mem.read8(0x2083), 0x00, "no underflow -> flag NOT written");
  assert.equal(m.mem.read16(0x2091), 0x05ff, "counter decremented");
  assert.equal(m.tstates, 13 + 7 + 5 + 16 + 5 + 4 + 10 + 5 + 16 + 10, "91 T (jnz taken)");
});

test("loc_0913 MUTATION: lhld mis-charged 10T not 16T is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x2009, 0x00);
  m.mem.write16(0x2091, 0x0000);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x091c ? 10 : c);
  loc_0913(m);
  assert.equal(m.tstates, 115, "mutation loses 6 T (lhld 16 -> 10)");
  assert.notEqual(m.tstates, 121, "golden T-state total catches the mutant");
});
