// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_3423 (ROM 0x3423, Pooyan) -- enemy actor state-1 entry prologue.
 * Advances the frame (call loc_4006), then on bit0 of (ix+0x01): clear -> dispatch on (ix+0x08)
 * (non-zero tails to loc_34f2, else delegate into loc_343e); set -> gate on 0x8f63 (non-zero
 * ret nz, else clear (ix+0x01) and jr loc_3473). loc_3423 ends at 0x343d and delegates to loc_343e.
 *
 * The mock's `call` POPS the seated return (the balance tooth): the call loc_4006 pushes 0x3426
 * (balanced by the pop) and each tail/delegate/ret pops the seated CALLER_RET -> SP to the pre-seat
 * baseline. TEETH: `bit 0,(ix+0x01)` (20T) mis-charged 7T is caught by the P1 golden.
 *
 * Run: node --test games/pooyan/translated/test/loc_3423.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_3423 } from "../loc_3423.js";

const CALLER_RET = 0xabcd;
const IX = 0x8a00;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x3423, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      mem.write8(regs.sp, v & 0xff);
      mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    },
    pop16() {
      const lo = mem.read8(regs.sp);
      const hi = mem.read8((regs.sp + 1) & 0xffff);
      regs.sp = (regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.regs.ix = IX;
}

test("loc_3423 P1: (ix+1) bit0 set, 0x8f63 != 0 -> ret nz at 0x3430", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x01, 0x01); // bit0 set -> jr z not taken -> gate
  m.mem.write8(0x8f63, 0x01);    // != 0 -> ret nz

  loc_3423(m);

  assert.deepEqual(m.pcSeq, [0x4006, 0x342a, 0x342c, 0x342f, 0x3430, CALLER_RET], "P1 boundaries");
  assert.equal(m.tstates, 72, "P1 T-total");
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x4006], "call loc_4006 only");
  assert.equal(m.regs.sp, 0x8780, "call balanced; ret pops seated CALLER_RET");
});

test("loc_3423 P2: (ix+1) bit0 set, 0x8f63 == 0 -> clear (ix+1), jr loc_3473", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x01, 0x01);
  m.mem.write8(0x8f63, 0x00);    // == 0 -> ret nz not taken

  loc_3423(m);

  assert.deepEqual(m.pcSeq, [
    0x4006, 0x342a, 0x342c, 0x342f, 0x3430, 0x3431, 0x3435, 0x3473,
  ], "P2 boundaries");
  assert.equal(m.tstates, 97, "P2 T-total");
  assert.equal(m.pc, 0x3473, "tail into loc_3473");
  assert.deepEqual(m.calls, [0x4006, 0x3473]);
  assert.equal(m.regs.sp, 0x8780);
  assert.equal(m.mem.read8(IX + 0x01), 0x00, "(ix+1) cleared");
});

test("loc_3423 P3: (ix+1) bit0 clear, (ix+8) != 0 -> jp nz loc_34f2 (tail)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x01, 0x00); // bit0 clear -> jr z taken -> 0x3437
  m.mem.write8(IX + 0x08, 0x05); // != 0 -> jp nz taken

  loc_3423(m);

  assert.deepEqual(m.pcSeq, [0x4006, 0x342a, 0x3437, 0x343a, 0x343b, 0x34f2], "P3 boundaries");
  assert.equal(m.tstates, 82, "P3 T-total");
  assert.equal(m.pc, 0x34f2, "tail into loc_34f2");
  assert.deepEqual(m.calls, [0x4006, 0x34f2]);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_3423 P4: (ix+1) bit0 clear, (ix+8) == 0 -> delegate loc_343e", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x01, 0x00);
  m.mem.write8(IX + 0x08, 0x00); // == 0 -> jp nz not taken -> fall into loc_343e

  loc_3423(m);

  assert.deepEqual(m.pcSeq, [0x4006, 0x342a, 0x3437, 0x343a, 0x343b, 0x343e], "P4 boundaries");
  assert.equal(m.tstates, 82, "P4 T-total");
  assert.equal(m.pc, 0x343e, "delegate lands on loc_343e");
  assert.deepEqual(m.calls, [0x4006, 0x343e]);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_3423 MUTATION: `bit 0,(ix+0x01)` mis-charged 7T (not 20T) is caught on P1", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x342a ? 7 : cycles);
  seatCaller(m);
  m.mem.write8(IX + 0x01, 0x01); m.mem.write8(0x8f63, 0x01);

  loc_3423(m);

  assert.equal(m.tstates, 59, "mutation loses 13 T");
  assert.throws(() => assert.equal(m.tstates, 72, "P1 golden"), /72/,
    "the 72-T golden must fail on the mutant");
});
