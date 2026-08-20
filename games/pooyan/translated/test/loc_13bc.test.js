// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_13bc (ROM 0x13bc, Pooyan) -- scan five 0x18-byte slots at 0x8b70
 * for a free one; if found, stamp a wrapping counter and init the IX record then tail-jp 0x142c;
 * if none free, ret.
 *
 * The mock's `call` POPS the return address the call site pushed (models the callee's `ret`); the
 * only call here is the tail jp 0x142c (no push16), whose callee ret consumes the seated CALLER_RET
 * so the stack fully unwinds to the pre-seat baseline.
 *
 * Paths: RET (all 5 slots occupied -> djnz falls out -> ret); FOUND-keep (slot 2 free, counter
 * 0x40->0x41 non-zero); FOUND-wrap (slot 0 free, counter 0xff->0x00->0x01 via the skip-0 double inc).
 * TEETH: `add iy,de` (15 T) mis-charged 11 T -> the RET golden throws. There is no push16 in this
 * routine, so the push16-deletion control is N/A; a live T-state mutation was watched failing instead.
 *
 * Run: node --test games/pooyan/translated/test/loc_13bc.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_13bc } from "../loc_13bc.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x13bc, pcSeq: [],
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
    // The callee's `ret` pops whatever the call site pushed. The tail jp 0x142c pushes nothing, so
    // its ret consumes the seated CALLER_RET -- leaving SP at the pre-seat baseline (the stack tooth).
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

// Slot bases: 0x8b70 + i*0x18
const SLOT = (i) => (0x8b70 + i * 0x18) & 0xffff;

test("loc_13bc RET: all five slots occupied -> djnz falls out -> ret", () => {
  const m = makeMachine();
  seatCaller(m);
  for (let i = 0; i < 5; i++) { m.mem.write8(SLOT(i), 0x01); m.mem.write8(SLOT(i) + 1, 0x00); } // bit0 set

  loc_13bc(m);

  assert.equal(m.tstates, 421, "RET T-state total");
  assert.deepEqual(m.pcSeq, [
    0x13c0, 0x13c3, 0x13c5,
    0x13c8, 0x13cb, 0x13cc, 0x13ce, 0x13d0, 0x13c5,
    0x13c8, 0x13cb, 0x13cc, 0x13ce, 0x13d0, 0x13c5,
    0x13c8, 0x13cb, 0x13cc, 0x13ce, 0x13d0, 0x13c5,
    0x13c8, 0x13cb, 0x13cc, 0x13ce, 0x13d0, 0x13c5,
    0x13c8, 0x13cb, 0x13cc, 0x13ce, 0x13d0, 0x13d2,
    CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET, "ret to seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
  assert.deepEqual(m.calls, [], "no work");
  assert.equal(m.regs.iy, (0x8b70 + 5 * 0x18) & 0xffff, "IY advanced past all five slots");
});

test("loc_13bc FOUND-keep: slot 2 free, counter 0x40 -> 0x41 kept", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8ae0;
  m.mem.write8(SLOT(0), 0x01); m.mem.write8(SLOT(1), 0x01); // slots 0,1 occupied
  m.mem.write8(SLOT(2), 0x00); m.mem.write8(SLOT(2) + 1, 0x00); // slot 2 free
  m.mem.write8(0x8d41, 0x40); // counter

  loc_13bc(m);

  assert.equal(m.tstates, 413, "FOUND-keep T-state total");
  assert.deepEqual(m.pcSeq, [
    0x13c0, 0x13c3, 0x13c5,
    0x13c8, 0x13cb, 0x13cc, 0x13ce, 0x13d0, 0x13c5,
    0x13c8, 0x13cb, 0x13cc, 0x13ce, 0x13d0, 0x13c5,
    0x13c8, 0x13cb, 0x13cc, 0x13db,
    0x13de, 0x13df, 0x13e2, 0x13e3, 0x13e6, 0x13e9, 0x13ec, 0x13ef, 0x13f3, 0x13f7, 0x13fb, 0x142c,
  ]);
  assert.equal(m.pc, 0x142c, "tail jp lands on 0x142c");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline (tail call ret consumed CALLER_RET)");
  assert.deepEqual(m.calls, [0x142c], "one tail call");
  assert.equal(m.mem.read8(0x8d41), 0x41, "counter incremented, kept");
  assert.equal(m.mem.read8(0x8ae0 + 0x14), 0x41, "counter stamped into (ix+0x14)");
  assert.equal(m.mem.read8(0x8ae0 + 0x0c), 0x88, "(ix+0x0c)=anim ptr low (0x3988)");
  assert.equal(m.mem.read8(0x8ae0 + 0x0d), 0x39, "(ix+0x0d)=anim ptr high");
  assert.equal(m.mem.read8(0x8ae0 + 0x0e), 0x00, "(ix+0x0e)=0");
  assert.equal(m.mem.read8(0x8ae0 + 0x11), 0x28, "(ix+0x11)=0x28");
  assert.equal(m.mem.read8(0x8ae0 + 0x02), 0x04, "(ix+0x02)=0x04");
});

test("loc_13bc FOUND-wrap: slot 0 free, counter 0xff -> 0x00 -> 0x01 (skip 0)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8ae0;
  m.mem.write8(SLOT(0), 0x00); m.mem.write8(SLOT(0) + 1, 0x00); // slot 0 free
  m.mem.write8(0x8d41, 0xff); // counter wraps

  loc_13bc(m);

  assert.equal(m.tstates, 265, "FOUND-wrap T-state total");
  assert.deepEqual(m.pcSeq, [
    0x13c0, 0x13c3, 0x13c5,
    0x13c8, 0x13cb, 0x13cc, 0x13db,
    0x13de, 0x13df, 0x13e1, 0x13e2, 0x13e3, 0x13e6, 0x13e9, 0x13ec, 0x13ef, 0x13f3, 0x13f7, 0x13fb, 0x142c,
  ]);
  assert.equal(m.pc, 0x142c);
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
  assert.equal(m.mem.read8(0x8d41), 0x01, "counter skipped 0 -> 0x01");
  assert.equal(m.mem.read8(0x8ae0 + 0x14), 0x01, "counter stamped into (ix+0x14)");
});

test("loc_13bc MUTATION: `add iy,de` mis-charged 11 T (not 15 T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x13d0 ? 11 : cycles);
  seatCaller(m);
  for (let i = 0; i < 5; i++) { m.mem.write8(SLOT(i), 0x01); }

  loc_13bc(m);

  assert.equal(m.tstates, 421 - 5 * 4, "mutation loses 4 T per iteration (15 -> 11) x5");
  assert.throws(
    () => assert.equal(m.tstates, 421, "RET T-state total"),
    /421/,
    "the 421-T golden must fail on the mutant",
  );
});
