// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_66c5 (ROM 0x66c5, Pooyan) -- steps three actor records (stride 0x18)
 * through the loc_66f1 pass with the alt register bank bracketing each call (exx/call/exx), then -- when
 * the (0x8ae2) flag is set -- runs the (0x892d) countdown: a live count is decremented and the routine
 * rets; on zero it reloads 0x10, bumps (0x892f), and enqueues display command 0x0612 (0x0692 when bit 0
 * of (0x892f) is clear) via rst 0x38.
 *
 * The mock's `call` POPS the return the call site pushed (modelling the callee's `ret`); each loop call
 * to loc_66f1 and the rst-0x38 enqueue must be push-balanced or the terminal ret pops garbage. Five
 * paths cover the djnz loop, the ret-z flag gate, both jr-z count arms, and both jr-nz command arms.
 *
 * Run: node --test games/pooyan/translated/test/loc_66c5.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_66c5 } from "../loc_66c5.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x66c5, pcSeq: [],
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
  m.regs.ix = 0x8b00;
  m.push16(CALLER_RET);
}

// The three-iteration djnz loop, then the flag load + `and a` (0x66d6, 0x66d7) shared by every path.
const LOOP = [
  0x66c8, 0x66ca,
  0x66cb, 0x66f1, 0x66cf, 0x66d1, 0x66ca,
  0x66cb, 0x66f1, 0x66cf, 0x66d1, 0x66ca,
  0x66cb, 0x66f1, 0x66cf, 0x66d1, 0x66d3,
];
const LOOP_T = 10 + 7 + (4+17+4+15+13) + (4+17+4+15+13) + (4+17+4+15+8); // 171
const PRE = [...LOOP, 0x66d6, 0x66d7];
const PRE_T = LOOP_T + 13 + 4; // 188
const LOOP_CALLS = [0x66f1, 0x66f1, 0x66f1];

test("loc_66c5 Path 1: loop then flag (0x8ae2)=0 -> ret z", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8ae2, 0x00);

  loc_66c5(m);

  assert.equal(m.tstates, PRE_T + 11, "Path 1 T = loop + flag load + ret z taken");
  assert.deepEqual(m.pcSeq, [...PRE, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, LOOP_CALLS);
  assert.equal(m.regs.sp, 0x8780, "loop calls balanced, ret to baseline");
});

test("loc_66c5 Path 2: flag set, count (0x892d) live -> dec, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8ae2, 0x01);
  m.mem.write8(0x892d, 0x03);   // nonzero -> jr z not taken -> dec

  loc_66c5(m);

  assert.equal(m.tstates, PRE_T + 5 + 10+7+4 + 7 + 11 + 10, "Path 2 T-state total");
  assert.deepEqual(
    m.pcSeq,
    [...PRE, 0x66d8, 0x66db, 0x66dc, 0x66dd, 0x66df, 0x66e0, CALLER_RET],
    "jr z not taken -> dec (hl) -> ret",
  );
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, LOOP_CALLS);
  assert.equal(m.mem.read8(0x892d), 0x02, "count decremented 3 -> 2");
  assert.equal(m.regs.sp, 0x8780, "ret to baseline");
});

test("loc_66c5 Path 3: count expired, bit 0 set -> command 0x0612, rst 0x38, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8ae2, 0x01);
  m.mem.write8(0x892d, 0x00);   // zero -> jr z taken
  m.mem.write8(0x892f, 0x00);   // inc -> 0x01, bit 0 set -> jr nz taken, DE stays 0x0612

  loc_66c5(m);

  assert.equal(
    m.tstates,
    PRE_T + 5 + 10+7+4 + 12 + 10+6+6+11 + 12 + 10 + 12 + 11 + 10,
    "Path 3 T-state total",
  );
  assert.deepEqual(m.pcSeq, [
    ...PRE, 0x66d8, 0x66db, 0x66dc, 0x66dd, 0x66e1, 0x66e3, 0x66e4, 0x66e5,
    0x66e6, 0x66e8, 0x66eb, 0x66ef, 0x0038, CALLER_RET,
  ], "jr z taken -> reload, inc, bit set -> jr nz taken -> rst 0x38 -> ret");
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [...LOOP_CALLS, 0x0038]);
  assert.equal(m.mem.read8(0x892d), 0x10, "count reloaded to 0x10");
  assert.equal(m.mem.read8(0x892f), 0x01, "(0x892f) bumped 0 -> 1");
  assert.equal(m.regs.de, 0x0612, "DE holds command 0x0612 (bit 0 set)");
  assert.equal(m.regs.sp, 0x8780, "rst balanced, ret to baseline");
});

test("loc_66c5 Path 4: count expired, bit 0 clear -> command 0x0692, rst 0x38, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8ae2, 0x01);
  m.mem.write8(0x892d, 0x00);   // zero -> jr z taken
  m.mem.write8(0x892f, 0x01);   // inc -> 0x02, bit 0 clear -> jr nz not taken, ld e,0x92

  loc_66c5(m);

  assert.equal(
    m.tstates,
    PRE_T + 5 + 10+7+4 + 12 + 10+6+6+11 + 12 + 10 + 7 + 7 + 11 + 10,
    "Path 4 T-state total",
  );
  assert.deepEqual(m.pcSeq, [
    ...PRE, 0x66d8, 0x66db, 0x66dc, 0x66dd, 0x66e1, 0x66e3, 0x66e4, 0x66e5,
    0x66e6, 0x66e8, 0x66eb, 0x66ed, 0x66ef, 0x0038, CALLER_RET,
  ], "bit clear -> jr nz not taken -> ld e,0x92 -> rst 0x38 -> ret");
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [...LOOP_CALLS, 0x0038]);
  assert.equal(m.mem.read8(0x892f), 0x02, "(0x892f) bumped 1 -> 2");
  assert.equal(m.regs.e, 0x92, "E overwritten to 0x92 -> DE=0x0692");
  assert.equal(m.regs.sp, 0x8780, "rst balanced, ret to baseline");
});

test("loc_66c5 MUTATION: the ld de,0x0018 mis-charged 9T (not 10T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x66c8 ? 9 : cycles);
  seatCaller(m);
  m.mem.write8(0x8ae2, 0x01);
  m.mem.write8(0x892d, 0x00);
  m.mem.write8(0x892f, 0x00);

  loc_66c5(m);

  const golden = PRE_T + 5 + 10+7+4 + 12 + 10+6+6+11 + 12 + 10 + 12 + 11 + 10;
  assert.equal(m.tstates, golden - 1, "mutation loses 1 T");
  assert.throws(() => assert.equal(m.tstates, golden, "Path 3 T-state total"), /Path 3/);
});
