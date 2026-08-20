// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_3680 (ROM 0x3680, Pooyan) -- scan the IY actor table for a free
 * slot ((iy+0)|(iy+1) bit0 clear) and initialise it, else ret when the table is full.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`), so a
 * missing push16 before `call 0x36de` desyncs the stack and the SP-baseline tooth fails. loc_3680
 * pushes 0x36db before `call 0x36de`; that callee ret pops it, then the tail `jp 0x379d`'s callee ret
 * pops the seated CALLER_RET -- the stack fully unwinds to baseline.
 *
 * Paths: FULL (table full -> ret at 0x368d), A (found; (ix+7) bit2 set, (0x8d79)!=0, 0x8d41 no-wrap,
 * bit1 set), B (found; bit2 clear, 0x8d41 wraps 0xff->0->1, bit1 clear), C (found; bit2 set,
 * (0x8d79)==0 -> jr z at 0x36a5). Together they exercise every branch outcome. MUTATION: `bit 2,(ix+7)`
 * (20 T) mis-charged 8 T -> the 400-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_3680.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_3680 } from "../loc_3680.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x3680, pcSeq: [],
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
    // The callee's `ret` pops the return address the call site pushed -- model that pop so the stack
    // stays balanced (a missing push16 then desyncs SP and fails the baseline tooth). 0x36de/0x379d
    // return nothing loc_3680 uses afterward.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_3680 FULL: no free slot in B entries -> ret at 0x368d", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x02;
  m.regs.de = 0x0010;
  m.regs.iy = 0x9000;
  m.mem.write8(0x9000, 0x01); m.mem.write8(0x9001, 0x00); // odd -> rrca carry -> not free
  m.mem.write8(0x9010, 0x01); m.mem.write8(0x9011, 0x00);

  loc_3680(m);

  assert.equal(m.tstates, 159, "FULL T-state total");
  assert.deepEqual(m.pcSeq, [
    0x3683, 0x3686, 0x3687, 0x3689, 0x368b, 0x3680,
    0x3683, 0x3686, 0x3687, 0x3689, 0x368b, 0x368d,
    CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET, "ret at 0x368d to seated caller");
  assert.equal(m.regs.iy, 0x9020, "IY advanced by DE twice");
  assert.deepEqual(m.calls, [], "no init work");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

const FOUND_TAIL = [
  0x36c9, 0x36cc, 0x36d0, 0x36d4, 0x36d8, 0x36de, 0x379d,
];

test("loc_3680 A: free slot; bit2 set, (0x8d79)!=0, 0x8d41 no-wrap, bit1 set", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x03;
  m.regs.iy = 0x9000;
  m.regs.ix = 0xa000;
  m.mem.write8(0x9000, 0x00); m.mem.write8(0x9001, 0x00); // first slot free
  m.mem.write8(0xa007, 0x06); // (ix+7): bit2=1 and bit1=1
  m.mem.write8(0x8d7b, 0x00);
  m.mem.write8(0x8d79, 0x03);
  m.mem.write8(0x8d41, 0x05);

  loc_3680(m);

  assert.equal(m.tstates, 400, "A T-state total");
  assert.deepEqual(m.pcSeq, [
    0x3683, 0x3686, 0x3687, 0x3696,
    0x369a, 0x369c, 0x369f, 0x36a0, 0x36a3, 0x36a4, 0x36a5, 0x36a7, 0x36a8, 0x36ab, 0x36ac, 0x36ad, 0x36af,
    0x36b2, 0x36b3, 0x36b6, 0x36b7, 0x36ba, 0x36bd, 0x36c1, 0x36c3, 0x36c6,
    ...FOUND_TAIL,
  ]);
  assert.equal(m.mem.read8(0x8d7b), 0x01, "0x8d7b incremented");
  assert.equal(m.mem.read8(0x8d79), 0x02, "0x8d79 decremented");
  assert.equal(m.mem.read8(0x8d75), 0x03, "0x8d75 = pre-dec (0x8d79)");
  assert.equal(m.mem.read8(0x8d76), 0x00, "0x8d76 cleared");
  assert.equal(m.mem.read8(0x8d41), 0x06, "0x8d41 incremented (no wrap)");
  assert.equal(m.mem.read8(0xa014), 0x06, "(ix+0x14) = slot id");
  assert.equal(m.mem.read8(0xa00c), 0x94, "(ix+0x0c) = 0x3994 lo (bit1 set)");
  assert.equal(m.mem.read8(0xa00d), 0x39, "(ix+0x0d) = 0x3994 hi");
  assert.equal(m.mem.read8(0xa00e), 0x00, "(ix+0x0e) cleared");
  assert.equal(m.mem.read8(0xa011), 0x28, "(ix+0x11) seeded");
  assert.equal(m.mem.read8(0xa002), 0x04, "(ix+0x02) seeded");
  assert.deepEqual(m.calls, [0x36de, 0x379d], "call 0x36de then tail 0x379d");
  assert.equal(m.pc, 0x379d, "tail lands on 0x379d");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline (push16 matched)");
});

test("loc_3680 B: free slot; bit2 clear, 0x8d41 wraps 0xff->0->1, bit1 clear", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x03;
  m.regs.iy = 0x9000;
  m.regs.ix = 0xa000;
  m.mem.write8(0x9000, 0x00); m.mem.write8(0x9001, 0x00);
  m.mem.write8(0xa007, 0x00); // bit2 clear, bit1 clear
  m.mem.write8(0x8d41, 0xff);

  loc_3680(m);

  assert.equal(m.tstates, 315, "B T-state total");
  assert.deepEqual(m.pcSeq, [
    0x3683, 0x3686, 0x3687, 0x3696,
    0x369a, 0x36af, 0x36b2, 0x36b3, 0x36b5, 0x36b6, 0x36b7, 0x36ba, 0x36bd, 0x36c1, 0x36c6,
    ...FOUND_TAIL,
  ]);
  assert.equal(m.mem.read8(0x8d41), 0x01, "0x8d41 wrapped 0xff->0 then re-incremented to 1");
  assert.equal(m.mem.read8(0xa014), 0x01, "(ix+0x14) = slot id 1");
  assert.equal(m.mem.read8(0xa00c), 0x88, "(ix+0x0c) = 0x3988 lo (bit1 clear)");
  assert.equal(m.mem.read8(0xa00d), 0x39, "(ix+0x0d) = 0x3988 hi");
  assert.equal(m.mem.read8(0x8d7b), 0x00, "0x8d7b untouched (bit2 clear)");
  assert.deepEqual(m.calls, [0x36de, 0x379d]);
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_3680 C: free slot; bit2 set but (0x8d79)==0 -> jr z at 0x36a5", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x03;
  m.regs.iy = 0x9000;
  m.regs.ix = 0xa000;
  m.mem.write8(0x9000, 0x00); m.mem.write8(0x9001, 0x00);
  m.mem.write8(0xa007, 0x06); // bit2 set, bit1 set
  m.mem.write8(0x8d7b, 0x00);
  m.mem.write8(0x8d79, 0x00); // zero -> jr z at 0x36a5 skips dec/writes
  m.mem.write8(0x8d41, 0x10);

  loc_3680(m);

  assert.equal(m.tstates, 363, "C T-state total");
  assert.deepEqual(m.pcSeq, [
    0x3683, 0x3686, 0x3687, 0x3696,
    0x369a, 0x369c, 0x369f, 0x36a0, 0x36a3, 0x36a4, 0x36a5, 0x36af,
    0x36b2, 0x36b3, 0x36b6, 0x36b7, 0x36ba, 0x36bd, 0x36c1, 0x36c3, 0x36c6,
    ...FOUND_TAIL,
  ]);
  assert.equal(m.mem.read8(0x8d7b), 0x01, "0x8d7b incremented");
  assert.equal(m.mem.read8(0x8d79), 0x00, "0x8d79 unchanged (dec skipped)");
  assert.equal(m.mem.read8(0x8d75), 0x00, "0x8d75 not written (block skipped)");
  assert.equal(m.mem.read8(0x8d41), 0x11, "0x8d41 incremented (no wrap)");
  assert.equal(m.mem.read8(0xa014), 0x11, "(ix+0x14) = slot id");
  assert.deepEqual(m.calls, [0x36de, 0x379d]);
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_3680 MUTATION: `bit 2,(ix+7)` mis-charged 8T (not 20T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x369a ? 8 : cycles);
  seatCaller(m);
  m.regs.b = 0x03;
  m.regs.iy = 0x9000;
  m.regs.ix = 0xa000;
  m.mem.write8(0x9000, 0x00); m.mem.write8(0x9001, 0x00);
  m.mem.write8(0xa007, 0x06);
  m.mem.write8(0x8d7b, 0x00);
  m.mem.write8(0x8d79, 0x03);
  m.mem.write8(0x8d41, 0x05);

  loc_3680(m);

  assert.equal(m.tstates, 388, "mutation loses 12 T (20 -> 8)");
  assert.throws(
    () => assert.equal(m.tstates, 400, "A T-state total"),
    /400/,
    "the 400-T golden must fail on the mutant",
  );
});
