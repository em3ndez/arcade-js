// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_69c6 (ROM 0x69c6, Pooyan) -- paired ix/iy object descent step.
 * Rets unless (ix+0) active and (ix+2)==0; runs loc_4006, decrements the iy then ix 16-bit positions
 * by their (+9) delta (low byte (+5), high byte (+6), borrow decrements the high byte); on the ix high
 * byte ==6 it bumps the 0x892b gate (inc only while it reads 0), ==0 it wipes both 0x18-byte records
 * via rst 0x10 (loc_0010) at ix and iy.
 *
 * The mock's `call` POPS the pushed return (models the callee ret); the stack tooth. Paths cover:
 * the two early rets; the no-borrow arms landing (ix+6)==6 with the gate open (inc path) vs already
 * set; the borrow arms landing ==6; and the ==0 clear path (both rst 0x10 fills). Plus a T-mutation.
 *
 * Run: node --test games/pooyan/translated/test/loc_69c6.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_69c6 } from "../loc_69c6.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x69c6, pcSeq: [],
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
}

test("loc_69c6 Path A: (ix+0)==0 -> ret z", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x9000, 0x00); // (ix+0) inactive

  loc_69c6(m);

  assert.equal(m.tstates, 34, "Path A: 19 + 4 + 11");
  assert.deepEqual(m.pcSeq, [0x69c9, 0x69ca, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_69c6 Path B: (ix+2)!=0 -> ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x9000, 0x01);
  m.mem.write8(0x9002, 0x01); // sub-state busy

  loc_69c6(m);

  assert.equal(m.tstates, 62, "Path B: 19 + 4 + 5 + 19 + 4 + 11");
  assert.deepEqual(m.pcSeq, [0x69c9, 0x69ca, 0x69cb, 0x69ce, 0x69cf, CALLER_RET]);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_69c6 Path C: borrow arms, (ix+6)==6, gate open -> inc (0x892b)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.regs.iy = 0x9100;
  m.mem.write8(0x9000, 0x01); // active
  m.mem.write8(0x9002, 0x00); // sub-state idle
  m.mem.write8(0x9105, 0x00); m.mem.write8(0x9109, 0x10); // (iy+5)-(iy+9) borrows
  m.mem.write8(0x9106, 0x08); // (iy+6) high byte
  m.mem.write8(0x9005, 0x00); m.mem.write8(0x9009, 0x10); // (ix+5)-(ix+9) borrows
  m.mem.write8(0x9006, 0x07); // (ix+6) -> 0x06 after borrow
  m.mem.write8(0x892b, 0x00); // gate open

  loc_69c6(m);

  assert.equal(m.tstates, 327, "Path C T-state total");
  assert.deepEqual(m.pcSeq, [
    0x69c9, 0x69ca, 0x69cb, 0x69ce, 0x69cf, 0x69d0, 0x4006, 0x69d6, 0x69d9, 0x69db, 0x69de,
    0x69e1, 0x69e4, 0x69e7, 0x69e9, 0x69ec, 0x69ef, 0x69f2, 0x69f4, 0x69f6, 0x69f9, 0x69fa,
    0x69fb, 0x69fc, 0x69fd, CALLER_RET]);
  assert.deepEqual(m.calls, [0x4006]);
  assert.equal(m.mem.read8(0x9105), 0xf0, "(iy+5) = 0x00 - 0x10");
  assert.equal(m.mem.read8(0x9106), 0x07, "(iy+6) borrow-decremented");
  assert.equal(m.mem.read8(0x9005), 0xf0, "(ix+5) = 0x00 - 0x10");
  assert.equal(m.mem.read8(0x9006), 0x06, "(ix+6) borrow-decremented to 6");
  assert.equal(m.mem.read8(0x892b), 0x01, "gate incremented");
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_69c6 Path C': (ix+6)==6, gate already set -> ret nz, no inc", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.regs.iy = 0x9100;
  m.mem.write8(0x9000, 0x01);
  m.mem.write8(0x9105, 0x40); m.mem.write8(0x9109, 0x10); // no borrow
  m.mem.write8(0x9005, 0x40); m.mem.write8(0x9009, 0x10); // no borrow
  m.mem.write8(0x9006, 0x06); // (ix+6) == 6, no borrow
  m.mem.write8(0x892b, 0x05); // gate already set

  loc_69c6(m);

  assert.deepEqual(m.pcSeq, [
    0x69c9, 0x69ca, 0x69cb, 0x69ce, 0x69cf, 0x69d0, 0x4006, 0x69d6, 0x69d9, 0x69de,
    0x69e1, 0x69e4, 0x69e7, 0x69ec, 0x69ef, 0x69f2, 0x69f4, 0x69f6, 0x69f9, 0x69fa, 0x69fb, CALLER_RET]);
  assert.equal(m.mem.read8(0x892b), 0x05, "gate untouched (ret nz before inc)");
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_69c6 Path D: no-borrow arms, (ix+6)==0 -> wipe both records via rst 0x10", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.regs.iy = 0x9100;
  m.mem.write8(0x9000, 0x01);
  m.mem.write8(0x9105, 0x40); m.mem.write8(0x9109, 0x10); // no borrow
  m.mem.write8(0x9005, 0x40); m.mem.write8(0x9009, 0x10); // no borrow
  m.mem.write8(0x9006, 0x00); // (ix+6) == 0 -> clear path

  loc_69c6(m);

  assert.equal(m.tstates, 361, "Path D T-state total");
  assert.deepEqual(m.pcSeq, [
    0x69c9, 0x69ca, 0x69cb, 0x69ce, 0x69cf, 0x69d0, 0x4006, 0x69d6, 0x69d9, 0x69de,
    0x69e1, 0x69e4, 0x69e7, 0x69ec, 0x69ef, 0x69f2, 0x69f4, 0x69fe, 0x6a00, 0x6a01,
    0x6a02, 0x6a04, 0x6a05, 0x6a07, 0x0010, 0x6a0a, 0x6a0b, 0x6a0d, 0x0010, CALLER_RET]);
  assert.deepEqual(m.calls, [0x4006, 0x0010, 0x0010]);
  assert.equal(m.mem.read8(0x9005), 0x30, "(ix+5) = 0x40 - 0x10, no borrow");
  assert.equal(m.mem.read8(0x9006), 0x00, "(ix+6) untouched (no borrow)");
  assert.equal(m.regs.sp, 0x8780, "both fills unwound the stack to baseline");
});

test("loc_69c6 MUTATION: the loc_4006 call mis-charged 16T (not 17T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x4006 ? 16 : cycles);
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x9000, 0x01);
  m.mem.write8(0x9105, 0x40); m.mem.write8(0x9109, 0x10);
  m.mem.write8(0x9005, 0x40); m.mem.write8(0x9009, 0x10);
  m.mem.write8(0x9006, 0x00);

  loc_69c6(m);

  assert.equal(m.tstates, 360, "mutation loses 1 T");
  assert.throws(() => assert.equal(m.tstates, 361, "Path D T-state total"), /Path D/);
});
