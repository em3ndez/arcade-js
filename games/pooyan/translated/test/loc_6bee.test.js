// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_6bee (ROM 0x6bee, Pooyan) -- step the timer selected by mode
 * byte 0x8d52. Mode 0 -> call loc_6c18 (BOUNDARY, redraw). Mode 1 sets bit2 / mode 2 sets bit3
 * of state byte 0x8a87 (clearing the other), then decrements counter 0x8d53; on the counter
 * reaching 0 it also zeroes the mode byte 0x8d52 (dec l: hl 0x8d53 -> 0x8d52).
 *
 * The mock's `call` POPS the return address the call site pushed (modelling loc_6c18's `ret`), so
 * the push16(0x6c17)/callee-ret pair stays balanced and the trailing ret unwinds CALLER_RET.
 *
 * Paths: P1 mode 0, P2 mode 1 / counter>1 (ret nz), P3 mode 1 / counter==1 (zero the mode),
 * P4 mode 2 / counter>1 (ret nz), P5 mode 2 / counter==1. TEETH: mis-charge `set 2,(hl)` (15 T)
 * as 11 T on P2.
 *
 * Run: node --test games/pooyan/translated/test/loc_6bee.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6bee } from "../loc_6bee.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6bee, pcSeq: [],
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
    // loc_6c18's `ret` pops the return address loc_6bee pushed -- model that pop so a missing push16
    // would desync SP and fail the baseline tooth. loc_6c18's result is not read, so no reg effect.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_6bee P1: mode 0 -> call loc_6c18 -> ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d52, 0x00);

  loc_6bee(m);

  assert.equal(m.tstates, 56);
  assert.deepEqual(m.pcSeq, [0x6bf1, 0x6bf2, 0x6c14, 0x6c18, CALLER_RET]);
  assert.deepEqual(m.calls, [0x6c18]);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780, "push16(0x6c17) matched loc_6c18 ret; ret 0x6c17 unwinds CALLER_RET");
});

test("loc_6bee P2: mode 1, counter>1 -> set bit2/clear bit3, ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d52, 0x01);
  m.mem.write8(0x8d53, 0x02);
  m.mem.write8(0x8a87, 0x08); // bit3 set -> res3 clears it, set2 sets bit2 -> 0x04

  loc_6bee(m);

  assert.equal(m.tstates, 112);
  assert.deepEqual(m.pcSeq, [0x6bf1, 0x6bf2, 0x6bf4, 0x6bf7, 0x6bf8, 0x6c07, 0x6c09, 0x6c0b, 0x6c0e, 0x6c0f, CALLER_RET]);
  assert.equal(m.mem.read8(0x8a87), 0x04, "bit2 set, bit3 cleared");
  assert.equal(m.mem.read8(0x8d53), 0x01, "counter decremented, still nonzero");
  assert.equal(m.mem.read8(0x8d52), 0x01, "mode byte untouched (ret nz)");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780);
  assert.deepEqual(m.calls, []);
});

test("loc_6bee P3: mode 1, counter==1 -> counter+mode zeroed", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d52, 0x01);
  m.mem.write8(0x8d53, 0x01);
  m.mem.write8(0x8a87, 0x08);

  loc_6bee(m);

  assert.equal(m.tstates, 131);
  assert.deepEqual(m.pcSeq, [
    0x6bf1, 0x6bf2, 0x6bf4, 0x6bf7, 0x6bf8, 0x6c07, 0x6c09, 0x6c0b, 0x6c0e, 0x6c0f,
    0x6c10, 0x6c11, 0x6c12, 0x6c13, CALLER_RET,
  ]);
  assert.equal(m.mem.read8(0x8a87), 0x04);
  assert.equal(m.mem.read8(0x8d53), 0x00, "counter reached 0");
  assert.equal(m.mem.read8(0x8d52), 0x00, "mode byte zeroed via dec l");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_6bee P4: mode 2, counter>1 -> set bit3/clear bit2, ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d52, 0x02);
  m.mem.write8(0x8d53, 0x02);
  m.mem.write8(0x8a87, 0x04); // bit2 set -> res2 clears it, set3 sets bit3 -> 0x08

  loc_6bee(m);

  assert.equal(m.tstates, 107);
  assert.deepEqual(m.pcSeq, [0x6bf1, 0x6bf2, 0x6bf4, 0x6bf7, 0x6bf8, 0x6bfa, 0x6bfc, 0x6bfe, 0x6c01, 0x6c02, CALLER_RET]);
  assert.equal(m.mem.read8(0x8a87), 0x08, "bit3 set, bit2 cleared");
  assert.equal(m.mem.read8(0x8d53), 0x01, "counter decremented, still nonzero");
  assert.equal(m.mem.read8(0x8d52), 0x02, "mode byte untouched (ret nz)");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_6bee P5: mode 2, counter==1 -> counter+mode zeroed", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d52, 0x02);
  m.mem.write8(0x8d53, 0x01);
  m.mem.write8(0x8a87, 0x04);

  loc_6bee(m);

  assert.equal(m.tstates, 126);
  assert.deepEqual(m.pcSeq, [
    0x6bf1, 0x6bf2, 0x6bf4, 0x6bf7, 0x6bf8, 0x6bfa, 0x6bfc, 0x6bfe, 0x6c01, 0x6c02,
    0x6c03, 0x6c04, 0x6c05, 0x6c06, CALLER_RET,
  ]);
  assert.equal(m.mem.read8(0x8a87), 0x08);
  assert.equal(m.mem.read8(0x8d53), 0x00, "counter reached 0");
  assert.equal(m.mem.read8(0x8d52), 0x00, "mode byte zeroed via dec l");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_6bee MUTATION: `set 2,(hl)` mis-charged 11T (not 15T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x6c09 ? 11 : cycles);
  seatCaller(m);
  m.mem.write8(0x8d52, 0x01);
  m.mem.write8(0x8d53, 0x02);
  m.mem.write8(0x8a87, 0x08);

  loc_6bee(m);

  assert.equal(m.tstates, 108, "mutation loses 4 T (15 -> 11)");
  assert.throws(
    () => assert.equal(m.tstates, 112, "P2 T-state total"),
    /112/,
    "the 112-T golden must fail on the mutant",
  );
});
