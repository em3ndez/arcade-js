// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1a01 (ROM 0x1a01, Pooyan) -- a gameplay-state handler. After the
 * loc_2527 reset it bumps the 0x8907 phase counter and seats the 0x8901 sprite attribute; the odd
 * frame tails straight into loc_1a47, the even frame checks the credit gate (0x8806) and then the
 * 0x8f50 latch, either arming it (0x8f4a=0x40) or clearing 0x8f45 via rst 0x10 before falling into
 * loc_1a47. Every exit is a TAIL (frame reuse, no push16): loc_1a47 or, gate-closed, loc_1d3c.
 *
 * The mock's `call` POPS the return the call site pushed (modelling the callee's `ret`); a call site
 * missing its push16 desyncs the stack and the final tail pops the seated CALLER_RET off-by-two. Since
 * every exit is a tail, the SP tooth is "unwound to the pre-seat baseline (0x8780)". Four paths cover
 * both jr nc outcomes, both jr nz-frame outcomes, the credit gate, and the 0x8f50 branch.
 *
 * Run: node --test games/pooyan/translated/test/loc_1a01.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1a01 } from "../loc_1a01.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1a01, pcSeq: [],
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
    // The callee's `ret` pops the return the call site pushed -- model that pop so the stack stays
    // balanced (a missing push16 then desyncs SP; the tail pops off-by-two). loc_2527/rst 0x10 (0x0010)
    // leave no register loc_1a01 depends on for control flow, so no further modelling is needed.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_1a01 Path A: even frame (0x8907=0) -> odd after bump -> tail into loc_1a47", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x77;              // survives the loc_2527 stub -> written to 0x8902/0x8934
  m.mem.write8(0x8907, 0x00);   // < 2 -> attribute 0x28; bump makes it odd -> jr nz taken

  loc_1a01(m);

  assert.equal(m.tstates, 17+13+13+7+13+7 + 7+7 + 10+7+7+11+7+7 + 12, "Path A T-state total");
  assert.deepEqual(m.pcSeq, [
    0x2527, 0x1a07, 0x1a0a, 0x1a0c, 0x1a0f, 0x1a11,
    0x1a13, 0x1a15, 0x1a18, 0x1a19, 0x1a1b, 0x1a1c, 0x1a1d, 0x1a1f, 0x1a47,
  ], "jr nc not taken (attr 0x28); jr nz taken tails to loc_1a47");
  assert.equal(m.pc, 0x1a47, "tail lands on loc_1a47");
  assert.deepEqual(m.calls, [0x2527, 0x1a47], "loc_2527 then the loc_1a47 tail");
  assert.equal(m.mem.read8(0x8902), 0x77, "0x8902 = A");
  assert.equal(m.mem.read8(0x8934), 0x77, "0x8934 = A");
  assert.equal(m.mem.read8(0x8901), 0x28, "attribute 0x28 (0x8907 < 2)");
  assert.equal(m.mem.read8(0x8907), 0x01, "0x8907 bumped 0 -> 1");
  assert.equal(m.regs.sp, 0x8780, "tail unwound the stack to the pre-seat baseline");
});

test("loc_1a01 Path B: even frame, credit gate closed (0x8806=0) -> tail to loc_1d3c", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x05);   // >= 2 -> attribute 0x30; bump makes it even -> jr nz not taken
  m.mem.write8(0x8806, 0x00);   // gate closed -> jp z taken

  loc_1a01(m);

  assert.equal(m.tstates, 17+13+13+7+13+7 + 12+10+7+7+11+7+7 + 7+13+4 + 10, "Path B T-state total");
  assert.deepEqual(m.pcSeq, [
    0x2527, 0x1a07, 0x1a0a, 0x1a0c, 0x1a0f, 0x1a11,
    0x1a15, 0x1a18, 0x1a19, 0x1a1b, 0x1a1c, 0x1a1d, 0x1a1f,
    0x1a21, 0x1a24, 0x1a25, 0x1d3c,
  ], "jr nc taken (attr 0x30); jr nz not taken; jp z tails to loc_1d3c");
  assert.equal(m.pc, 0x1d3c, "credit gate closed -> tail to loc_1d3c");
  assert.deepEqual(m.calls, [0x2527, 0x1d3c]);
  assert.equal(m.mem.read8(0x8901), 0x30, "attribute 0x30 (0x8907 >= 2)");
  assert.equal(m.mem.read8(0x8907), 0x06, "0x8907 bumped 5 -> 6");
  assert.equal(m.regs.sp, 0x8780, "tail unwound the stack to the pre-seat baseline");
});

test("loc_1a01 Path C: even frame, gate open, 0x8f50 clear -> arm latch -> tail into loc_1a47", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x03);   // >= 2 -> attribute 0x30; bump makes it even
  m.mem.write8(0x8806, 0x01);   // gate open -> jp z not taken
  m.mem.write8(0x8f50, 0x00);   // latch clear -> jr nz not taken -> arm path

  loc_1a01(m);

  assert.equal(
    m.tstates,
    17+13+13+7+13+7 + 12+10+7+7+11+7+7 + 7+13+4 + 10+13+4 + 7+11+7+13+13+7+13 + 12,
    "Path C T-state total",
  );
  assert.deepEqual(m.pcSeq, [
    0x2527, 0x1a07, 0x1a0a, 0x1a0c, 0x1a0f, 0x1a11,
    0x1a15, 0x1a18, 0x1a19, 0x1a1b, 0x1a1c, 0x1a1d, 0x1a1f,
    0x1a21, 0x1a24, 0x1a25, 0x1a28, 0x1a2b, 0x1a2c,
    0x1a2e, 0x1a2f, 0x1a31, 0x1a34, 0x1a37, 0x1a39, 0x1a3c, 0x1a47,
  ], "gate open, latch clear -> dec (hl), arm 0x8f50/0x8f4a, jr tails to loc_1a47");
  assert.equal(m.pc, 0x1a47, "tail lands on loc_1a47");
  assert.deepEqual(m.calls, [0x2527, 0x1a47]);
  assert.equal(m.mem.read8(0x8f50), 0x01, "latch armed");
  assert.equal(m.mem.read8(0x8901), 0x01, "0x8901 overwritten with 1");
  assert.equal(m.mem.read8(0x8f4a), 0x40, "0x8f4a = 0x40");
  assert.equal(m.mem.read8(0x8907), 0x03, "0x8907 bumped 3 -> 4 then dec back to 3");
  assert.equal(m.regs.sp, 0x8780, "tail unwound the stack to the pre-seat baseline");
});

test("loc_1a01 Path D: even frame, gate open, 0x8f50 set -> clear 0x8f45 (rst 0x10) -> fall into loc_1a47", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x01);   // < 2 -> attribute 0x28; bump makes it even
  m.mem.write8(0x8806, 0x01);   // gate open
  m.mem.write8(0x8f50, 0x01);   // latch set -> jr nz taken -> clear-block path

  loc_1a01(m);

  assert.equal(
    m.tstates,
    17+13+13+7+13+7 + 7+7 + 10+7+7+11+7+7 + 7+13+4 + 10+13+4 + 12+4+10+7+11 + 7,
    "Path D T-state total",
  );
  assert.deepEqual(m.pcSeq, [
    0x2527, 0x1a07, 0x1a0a, 0x1a0c, 0x1a0f, 0x1a11,
    0x1a13, 0x1a15, 0x1a18, 0x1a19, 0x1a1b, 0x1a1c, 0x1a1d, 0x1a1f,
    0x1a21, 0x1a24, 0x1a25, 0x1a28, 0x1a2b, 0x1a2c,
    0x1a3e, 0x1a3f, 0x1a42, 0x1a44, 0x0010, 0x1a47,
  ], "latch set -> xor/rst 0x10 fill, ld h,0x81, fall into loc_1a47");
  assert.equal(m.pc, 0x1a47, "fall-through lands on loc_1a47");
  assert.deepEqual(m.calls, [0x2527, 0x0010, 0x1a47], "loc_2527, rst 0x10 fill, then the loc_1a47 tail");
  assert.equal(m.mem.read8(0x8901), 0x28, "attribute 0x28 (0x8907 < 2)");
  assert.equal(m.mem.read8(0x8907), 0x02, "0x8907 bumped 1 -> 2 (not decremented on this path)");
  assert.equal(m.regs.h, 0x81, "H seeded 0x81 for loc_1a47's first store");
  assert.equal(m.regs.a, 0x00, "A cleared by xor a");
  assert.equal(m.regs.sp, 0x8780, "tail unwound the stack to the pre-seat baseline");
});

test("loc_1a01 MUTATION: `inc (hl)` mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1a1c ? 7 : cycles);
  seatCaller(m);
  m.regs.a = 0x77;
  m.mem.write8(0x8907, 0x00);

  loc_1a01(m);

  const golden = 17+13+13+7+13+7 + 7+7 + 10+7+7+11+7+7 + 12;
  assert.equal(m.tstates, golden - 4, "mutation loses 4 T (11 -> 7)");
  assert.throws(() => assert.equal(m.tstates, golden, "Path A T-state total"), /Path A/);
});
