// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_66fd (ROM 0x66fd, Pooyan) -- gated by the (0x8930) flag, it runs the
 * (0x892e) countdown. A live count is decremented and the routine rets; on zero it reloads 0x12, bumps
 * the actor's (ix+0x02) phase, clears (ix+0x03)/(ix+0x05), seats (ix+0x04)=0x15 and (ix+0x06)=0x02,
 * points the animation at table 0x3829 through loc_381e, and stores tile 0x2c into (ix+0x09).
 *
 * The mock's `call` POPS the return the call site pushed (modelling the callee's `ret`); the one call
 * (loc_381e) must be balanced by its push16, else the terminal ret pops garbage -- the stack tooth.
 * Three paths cover the flag gate, both jr-z arms, and the loc_381e call.
 *
 * Run: node --test games/pooyan/translated/test/loc_66fd.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_66fd } from "../loc_66fd.js";

const CALLER_RET = 0xabcd;
const IX = 0x8b00;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x66fd, pcSeq: [],
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
  m.regs.ix = IX;
  m.push16(CALLER_RET);
}

test("loc_66fd Path 1: flag (0x8930)=0 -> ret z", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8930, 0x00);

  loc_66fd(m);

  assert.equal(m.tstates, 13 + 4 + 11, "Path 1 T = ld a + and a + ret z taken");
  assert.deepEqual(m.pcSeq, [0x6700, 0x6701, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780, "ret unwound the stack to baseline");
});

test("loc_66fd Path 2: count live -> dec (0x892e), ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8930, 0x01);
  m.mem.write8(0x892e, 0x05);   // nonzero -> jr z not taken -> dec

  loc_66fd(m);

  assert.equal(m.tstates, 13+4+5 + 10+7+4 + 7 + 11 + 10, "Path 2 T-state total");
  assert.deepEqual(
    m.pcSeq,
    [0x6700, 0x6701, 0x6702, 0x6705, 0x6706, 0x6707, 0x6709, 0x670a, CALLER_RET],
    "jr z not taken -> dec (hl) -> ret",
  );
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x892e), 0x04, "count decremented 5 -> 4");
  assert.equal(m.regs.sp, 0x8780, "ret unwound the stack to baseline");
});

test("loc_66fd Path 3: count expired -> reload + reseat actor + anim, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8930, 0x01);
  m.mem.write8(0x892e, 0x00);   // zero -> jr z taken
  m.mem.write8(IX + 0x02, 0x00);

  loc_66fd(m);

  assert.equal(
    m.tstates,
    13+4+5 + 10+7+4 + 12 + 10 + 23 + 4 + 19+19+19+19 + 10 + 17 + 19 + 10,
    "Path 3 T-state total",
  );
  assert.deepEqual(m.pcSeq, [
    0x6700, 0x6701, 0x6702, 0x6705, 0x6706, 0x6707, 0x670b, 0x670d, 0x6710,
    0x6711, 0x6714, 0x6717, 0x671b, 0x671f, 0x6722, 0x381e, 0x6729, CALLER_RET,
  ], "jr z taken -> full reseat body, call loc_381e, ret");
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x381e]);
  assert.equal(m.mem.read8(0x892e), 0x12, "count reloaded to 0x12");
  assert.equal(m.mem.read8(IX + 0x02), 0x01, "(ix+0x02) phase bumped 0 -> 1");
  assert.equal(m.mem.read8(IX + 0x03), 0x00, "(ix+0x03) cleared");
  assert.equal(m.mem.read8(IX + 0x05), 0x00, "(ix+0x05) cleared");
  assert.equal(m.mem.read8(IX + 0x04), 0x15, "(ix+0x04) seated 0x15");
  assert.equal(m.mem.read8(IX + 0x06), 0x02, "(ix+0x06) seated 0x02");
  assert.equal(m.mem.read8(IX + 0x09), 0x2c, "(ix+0x09) tile id 0x2c");
  assert.equal(m.regs.sp, 0x8780, "call balanced, ret unwound the stack to baseline");
});

test("loc_66fd MUTATION: the ld a,(0x8930) mis-charged 12T (not 13T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x6700 ? 12 : cycles);
  seatCaller(m);
  m.mem.write8(0x8930, 0x01);
  m.mem.write8(0x892e, 0x00);
  m.mem.write8(IX + 0x02, 0x00);

  loc_66fd(m);

  const golden = 13+4+5 + 10+7+4 + 12 + 10 + 23 + 4 + 19+19+19+19 + 10 + 17 + 19 + 10;
  assert.equal(m.tstates, golden - 1, "mutation loses 1 T");
  assert.throws(() => assert.equal(m.tstates, golden, "Path 3 T-state total"), /Path 3/);
});
