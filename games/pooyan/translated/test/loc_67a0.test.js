// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_67a0 (ROM 0x67a0, Pooyan) -- the per-object frame update.
 * Frame counter 0x8929: non-zero -> dec + ret. On expiry -> call loc_4006, then step two 16-bit
 * positions ((iy+5):(iy+6) when the (ix+7/8) pointer's high byte is set, and (ix+5):(ix+6)) down by
 * (ix+9) with borrow, and inc (ix+2) when the high byte (ix+6) reaches 0.
 *
 * The mock's `call` POPS loc_4006's return address (its `ret`), so a missing push16 desyncs the
 * stack. loc_4006 writes (ix+0c..10) only -- offsets loc_67a0 never reads -- so the mock is pop-only.
 * push hl / pop iy (0x67b6/0x67b7) transfers HL->IY and self-balances; deleting its push16 makes
 * pop iy read CALLER_RET and the final ret miss the seated return (the stack-fidelity tooth).
 *
 * Paths: TIMER (counter != 0), B (linked record present, no borrows, (ix+6)!=0 -> ret nz),
 * C (linked record, both subtractions borrow, (ix+6) hits 0 -> inc (ix+2)), E (no linked record,
 * jr z skips the IY block).  Run: node --test games/pooyan/translated/test/loc_67a0.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_67a0 } from "../loc_67a0.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x67a0, pcSeq: [],
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
    // loc_4006's `ret` pops the pushed return address; it writes (ix+0c..10) only (not read here).
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_67a0 TIMER: counter != 0 -> dec (hl) + ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8929, 0x03);

  loc_67a0(m);

  assert.equal(m.tstates, 49, "TIMER T-state total");
  assert.deepEqual(m.pcSeq, [0x67a3, 0x67a4, 0x67a5, 0x67a7, 0x67a8, CALLER_RET]);
  assert.equal(m.mem.read8(0x8929), 0x02, "counter decremented");
  assert.deepEqual(m.calls, [], "no sequencer call on the hold path");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_67a0 B: linked record, no borrows, (ix+6)!=0 -> ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x8929, 0x00);      // expired -> do work
  m.mem.write8(0x9007, 0x34);      // (ix+7) low
  m.mem.write8(0x9008, 0x12);      // (ix+8) high != 0 -> IY = 0x1234
  m.mem.write8(0x1239, 0x50);      // (iy+5)
  m.mem.write8(0x9009, 0x10);      // (ix+9) step
  m.mem.write8(0x9005, 0x80);      // (ix+5)
  m.mem.write8(0x9006, 0x05);      // (ix+6) high byte, stays non-zero

  loc_67a0(m);

  assert.equal(m.tstates, 303, "Path B T-state total");
  assert.deepEqual(m.pcSeq, [
    0x67a3, 0x67a4, 0x67a5, 0x67a9, 0x4006, 0x67af, 0x67b2, 0x67b3, 0x67b4,
    0x67b6, 0x67b7, 0x67b9, 0x67bc, 0x67bf, 0x67c4, // IY block, jr nc taken (no borrow)
    0x67c7, 0x67ca, 0x67cd, 0x67d2,                 // IX block, jr nc taken (no borrow)
    0x67d5, 0x67d8, 0x67da, CALLER_RET,             // (ix+6)!=0 -> ret nz
  ]);
  assert.equal(m.regs.iy, 0x1234, "IY = (ix+7/8) pointer");
  assert.equal(m.mem.read8(0x1239), 0x40, "(iy+5) -= (ix+9)");
  assert.equal(m.mem.read8(0x9005), 0x70, "(ix+5) -= (ix+9)");
  assert.equal(m.mem.read8(0x9006), 0x05, "(ix+6) unchanged (no borrow)");
  assert.equal(m.mem.read8(0x9002), 0x00, "(ix+2) NOT advanced (still counting)");
  assert.deepEqual(m.calls, [0x4006]);
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound");
});

test("loc_67a0 C: linked record, both borrow, (ix+6) hits 0 -> inc (ix+2)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x8929, 0x00);
  m.mem.write8(0x9007, 0x00);      // (ix+7)
  m.mem.write8(0x9008, 0x80);      // (ix+8) high != 0 -> IY = 0x8000
  m.mem.write8(0x8005, 0x05);      // (iy+5) < step -> borrow
  m.mem.write8(0x8006, 0x03);      // (iy+6)
  m.mem.write8(0x9009, 0x10);      // (ix+9) step
  m.mem.write8(0x9005, 0x05);      // (ix+5) < step -> borrow
  m.mem.write8(0x9006, 0x01);      // (ix+6) -> dec to 0
  m.mem.write8(0x9002, 0x07);      // (ix+2) state

  loc_67a0(m);

  assert.equal(m.tstates, 366, "Path C T-state total");
  assert.deepEqual(m.pcSeq, [
    0x67a3, 0x67a4, 0x67a5, 0x67a9, 0x4006, 0x67af, 0x67b2, 0x67b3, 0x67b4,
    0x67b6, 0x67b7, 0x67b9, 0x67bc, 0x67bf, 0x67c1, 0x67c4, // IY block, borrow -> dec (iy+6)
    0x67c7, 0x67ca, 0x67cd, 0x67cf, 0x67d2,                 // IX block, borrow -> dec (ix+6)
    0x67d5, 0x67d8, 0x67da, 0x67db, 0x67de, CALLER_RET,     // (ix+6)==0 -> inc (ix+2) + ret
  ]);
  assert.equal(m.mem.read8(0x8006), 0x02, "(iy+6) decremented on borrow");
  assert.equal(m.mem.read8(0x8005), 0xf5, "(iy+5) after borrow");
  assert.equal(m.mem.read8(0x9006), 0x00, "(ix+6) decremented to 0");
  assert.equal(m.mem.read8(0x9005), 0xf5, "(ix+5) after borrow");
  assert.equal(m.mem.read8(0x9002), 0x08, "(ix+2) advanced");
  assert.equal(m.regs.iy, 0x8000);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_67a0 E: no linked record (high byte 0) -> jr z skips IY block", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x8929, 0x00);
  m.mem.write8(0x9007, 0x50);      // (ix+7)
  m.mem.write8(0x9008, 0x00);      // (ix+8) high == 0 -> skip IY block
  m.mem.write8(0x9009, 0x10);      // (ix+9) step
  m.mem.write8(0x9005, 0x20);      // (ix+5)
  m.mem.write8(0x9006, 0x02);      // (ix+6) stays non-zero

  loc_67a0(m);

  assert.equal(m.tstates, 214, "Path E T-state total");
  assert.deepEqual(m.pcSeq, [
    0x67a3, 0x67a4, 0x67a5, 0x67a9, 0x4006, 0x67af, 0x67b2, 0x67b3, 0x67b4,
    0x67c7, 0x67ca, 0x67cd, 0x67d2, 0x67d5, 0x67d8, 0x67da, CALLER_RET,
  ]);
  assert.equal(m.mem.read8(0x9005), 0x10, "(ix+5) -= (ix+9)");
  assert.equal(m.regs.a, 0x02, "A = (ix+6)");
  assert.deepEqual(m.calls, [0x4006]);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_67a0 MUTATION: `ld a,(ix+5)` mis-charged 7T (not 19T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x67ca ? 7 : cycles);
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x8929, 0x00);
  m.mem.write8(0x9008, 0x12);
  m.mem.write8(0x9007, 0x34);
  m.mem.write8(0x1239, 0x50);
  m.mem.write8(0x9009, 0x10);
  m.mem.write8(0x9005, 0x80);
  m.mem.write8(0x9006, 0x05);

  loc_67a0(m);

  assert.equal(m.tstates, 291, "mutation loses 12 T (19 -> 7)");
  assert.throws(() => assert.equal(m.tstates, 303, "Path B total"), /303/);
});
