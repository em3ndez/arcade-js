// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_6287 (ROM 0x6287, Pooyan) -- proximity test between actor IX and
 * target IY. E-bias is 6 or -2 per (0x881f); |dx| >= 6 or |dy| >= 7 -> jp 0x60f2 (miss); kind C ==
 * 0x50 -> jp 0x60d9; else latch IX = HL, advance the anim frame at (ix+0x0a), and fall through into
 * loc_62e6.
 *
 * The mock's `call` POPS the return the call site pushed (modelling the callee's `ret`); a call site
 * missing its push16 then desyncs SP and the final baseline assertion fails. rst 0x20 (0x0020) and
 * loc_381e are modelled pop-only -- loc_6287 reads A after rst 0x20 via `ld l,a`, so with a pop-only
 * mock A stays the pre-lookup (0x8907&7)>>1, which is what the (ix+0x0a) write reflects here.
 * All three exits (jp 0x60f2, jp 0x60d9, fall-through into loc_62e6) are tails: the tail callee's ret
 * consumes the seated CALLER_RET, so SP returns to the pre-seat baseline.
 *
 * Paths: HIT (full latch + tail 0x62e6, T=422); MISS_X (|dx|>=6 no-neg, jp 0x60f2, T=149);
 * DXNEG (0x881f=0 -> E=-2, dx-neg branch, jp 0x60f2, T=154); MISS_Y (dy-neg, jp 0x60f2, T=214);
 * C50 (kind 0x50 -> jp 0x60d9, T=229). Every jr/jp/neg outcome is exercised.
 * TEETH: mis-charge `pop ix` (14 T) as 10 T -> the 422-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_6287.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6287 } from "../loc_6287.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6287, pcSeq: [],
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
    // balanced (a missing push16 then desyncs SP). loc_381e / rst 0x20 leave A per the mock note above.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      return undefined;
    },
  };
}

function seat(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_6287 Path HIT: in range, kind != 0x50 -> latch IX, advance frame, fall into loc_62e6", () => {
  const m = makeMachine();
  seat(m);
  m.regs.a = 0x10;             // kind -> C = 0x10 (!= 0x50)
  m.regs.ix = 0x8b00;          // pre-latch base for (ix+0)/(ix+2)
  m.regs.iy = 0x8ac0;          // pre-reload base for (iy+0)/(iy+2)
  m.regs.hl = 0x8b80;          // latched into IX
  m.mem.write8(0x881f, 0x01);  // nonzero -> E = 6
  m.mem.write8(0x8b00, 0x20);  // (ix+0) actor X ; E = 0x20+6 = 0x26
  m.mem.write8(0x8b02, 0x40);  // (ix+2) actor Y ; D = 0x40+8 = 0x48
  m.mem.write8(0x8ac0, 0x28);  // (iy+0) target X ; dx = 0x28-0x26 = 2 (<6)
  m.mem.write8(0x8ac2, 0x42);  // (iy+2) target Y ; dy = (0x42+8)-0x48 = 2 (<7)
  m.mem.write8(0x8907, 0x04);  // frame index: (0x04 & 7) >> 1 = 2
  m.mem.write8(0x8b8a, 0x30);  // (ix+0x0a) current frame (ix now = 0x8b80)
  m.mem.write8(0x8b94, 0x00);  // (ix+0x14)

  loc_6287(m);

  assert.equal(m.tstates, 422, "Path HIT T-state total");
  assert.deepEqual(m.pcSeq, [
    0x6288, 0x628a, 0x628d, 0x628e, 0x6292,
    0x6295, 0x6296, 0x6297, 0x629a, 0x629c, 0x629d, 0x62a0, 0x62a1, 0x62a5, 0x62a7, 0x62aa,
    0x62ad, 0x62af, 0x62b0, 0x62b4, 0x62b6, 0x62b9, 0x62ba, 0x62bc, 0x62bf, 0x62c0, 0x62c2, 0x62c5,
    0x381e, 0x62cb, 0x62ce, 0x62d0, 0x62d1,
    0x0020, 0x62d3, 0x62d6, 0x62d7, 0x62da, 0x62de, 0x62e1, 0x62e3, 0x62e6,
  ], "full body: both in-range, latch, rst 0x20, tail into loc_62e6");
  assert.equal(m.pc, 0x62e6, "fall-through tail lands on loc_62e6");
  assert.deepEqual(m.calls, [0x381e, 0x0020, 0x62e6], "loc_381e, rst 0x20, tail loc_62e6");
  assert.equal(m.regs.ix, 0x8b80, "IX latched from HL");
  assert.equal(m.regs.iy, 0x8ae0, "IY reloaded");
  assert.equal(m.mem.read8(0x8b8a), 0x32, "frame advanced 0x30 + 2");
  assert.equal(m.regs.c, 0x06, "C reloaded for the loc_62e6 search");
  assert.equal(m.regs.de, 0x0018, "DE = 0x0018 stride for loc_62e6");
  assert.equal(m.regs.sp, 0x8780, "SP unwound to baseline (tail callee ret consumed CALLER_RET)");
});

test("loc_6287 Path MISS_X: |dx| >= 6 (no neg) -> jp 0x60f2", () => {
  const m = makeMachine();
  seat(m);
  m.regs.a = 0x10;
  m.regs.ix = 0x8b00;
  m.regs.iy = 0x8ac0;
  m.mem.write8(0x881f, 0x01);  // E = 6
  m.mem.write8(0x8b00, 0x20);  // E = 0x26
  m.mem.write8(0x8b02, 0x00);
  m.mem.write8(0x8ac0, 0x40);  // dx = 0x40-0x26 = 0x1a (>=6), carry clear -> no neg

  loc_6287(m);

  assert.equal(m.tstates, 149, "Path MISS_X T-state total");
  assert.deepEqual(m.pcSeq, [
    0x6288, 0x628a, 0x628d, 0x628e, 0x6292,
    0x6295, 0x6296, 0x6297, 0x629a, 0x629c, 0x629d, 0x62a0, 0x62a1, 0x62a5, 0x62a7, 0x60f2,
  ], "jr nc taken (no neg), jp nc taken on X");
  assert.equal(m.pc, 0x60f2, "tail to 0x60f2");
  assert.deepEqual(m.calls, [0x60f2], "single tail exit");
  assert.equal(m.regs.sp, 0x8780, "SP unwound to baseline");
});

test("loc_6287 Path DXNEG: 0x881f=0 -> E=-2, dx negative (neg) -> jp 0x60f2", () => {
  const m = makeMachine();
  seat(m);
  m.regs.a = 0x10;
  m.regs.ix = 0x8b00;
  m.regs.iy = 0x8ac0;
  m.mem.write8(0x881f, 0x00);  // zero -> jr nz not taken -> E = 0xfe (-2)
  m.mem.write8(0x8b00, 0x20);  // E = (0x20 + 0xfe) & 0xff = 0x1e
  m.mem.write8(0x8b02, 0x00);
  m.mem.write8(0x8ac0, 0x10);  // dx = 0x10-0x1e -> borrow; neg -> 0x0e (>=6)

  loc_6287(m);

  assert.equal(m.tstates, 154, "Path DXNEG T-state total");
  assert.deepEqual(m.pcSeq, [
    0x6288, 0x628a, 0x628d, 0x628e, 0x6290, 0x6292,
    0x6295, 0x6296, 0x6297, 0x629a, 0x629c, 0x629d, 0x62a0, 0x62a1, 0x62a3, 0x62a5, 0x62a7, 0x60f2,
  ], "jr nz not taken (E=-2), jr nc not taken (neg), jp nc taken on X");
  assert.equal(m.pc, 0x60f2, "tail to 0x60f2");
  assert.equal(m.regs.sp, 0x8780, "SP unwound to baseline");
});

test("loc_6287 Path MISS_Y: dx in range but |dy| >= 7 (neg) -> jp 0x60f2", () => {
  const m = makeMachine();
  seat(m);
  m.regs.a = 0x10;
  m.regs.ix = 0x8b00;
  m.regs.iy = 0x8ac0;
  m.mem.write8(0x881f, 0x01);  // E = 6
  m.mem.write8(0x8b00, 0x20);  // E = 0x26
  m.mem.write8(0x8b02, 0x40);  // D = 0x48
  m.mem.write8(0x8ac0, 0x22);  // dx = 0x22-0x26 -> borrow; neg -> 4 (<6), passes
  m.mem.write8(0x8ac2, 0x10);  // dy = (0x10+8)-0x48 -> borrow; neg -> 0x30 (>=7)

  loc_6287(m);

  assert.equal(m.tstates, 214, "Path MISS_Y T-state total");
  assert.deepEqual(m.pcSeq, [
    0x6288, 0x628a, 0x628d, 0x628e, 0x6292,
    0x6295, 0x6296, 0x6297, 0x629a, 0x629c, 0x629d, 0x62a0, 0x62a1, 0x62a3, 0x62a5, 0x62a7, 0x62aa,
    0x62ad, 0x62af, 0x62b0, 0x62b2, 0x62b4, 0x62b6, 0x60f2,
  ], "X neg passes, Y neg -> jp nc taken on Y");
  assert.equal(m.pc, 0x60f2, "tail to 0x60f2");
  assert.equal(m.regs.sp, 0x8780, "SP unwound to baseline");
});

test("loc_6287 Path C50: in range, kind == 0x50 -> jp 0x60d9", () => {
  const m = makeMachine();
  seat(m);
  m.regs.a = 0x50;             // kind -> C = 0x50
  m.regs.ix = 0x8b00;
  m.regs.iy = 0x8ac0;
  m.mem.write8(0x881f, 0x01);  // E = 6
  m.mem.write8(0x8b00, 0x20);  // E = 0x26
  m.mem.write8(0x8b02, 0x40);  // D = 0x48
  m.mem.write8(0x8ac0, 0x28);  // dx = 2 (<6)
  m.mem.write8(0x8ac2, 0x42);  // dy = 2 (<7)

  loc_6287(m);

  assert.equal(m.tstates, 229, "Path C50 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x6288, 0x628a, 0x628d, 0x628e, 0x6292,
    0x6295, 0x6296, 0x6297, 0x629a, 0x629c, 0x629d, 0x62a0, 0x62a1, 0x62a5, 0x62a7, 0x62aa,
    0x62ad, 0x62af, 0x62b0, 0x62b4, 0x62b6, 0x62b9, 0x62ba, 0x62bc, 0x60d9,
  ], "both in range, jp z taken on kind 0x50");
  assert.equal(m.pc, 0x60d9, "tail to 0x60d9");
  assert.deepEqual(m.calls, [0x60d9], "single tail exit");
  assert.equal(m.regs.sp, 0x8780, "SP unwound to baseline");
});

test("loc_6287 MUTATION: `pop ix` mis-charged 10T (not 14T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x62c2 ? 10 : cycles);
  seat(m);
  m.regs.a = 0x10;
  m.regs.ix = 0x8b00;
  m.regs.iy = 0x8ac0;
  m.regs.hl = 0x8b80;
  m.mem.write8(0x881f, 0x01);
  m.mem.write8(0x8b00, 0x20);
  m.mem.write8(0x8b02, 0x40);
  m.mem.write8(0x8ac0, 0x28);
  m.mem.write8(0x8ac2, 0x42);
  m.mem.write8(0x8907, 0x04);
  m.mem.write8(0x8b8a, 0x30);

  loc_6287(m);

  assert.equal(m.tstates, 418, "mutation loses 4 T (14 -> 10)");
  assert.throws(
    () => assert.equal(m.tstates, 422, "golden"),
    /422/,
    "the 422-T golden must fail on the mutant",
  );
});
