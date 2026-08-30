// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_13fe (ROM 0x13fe, Pooyan) -- advance the object's X (ix+0x05)
 * by its velocity (ix+0x0a), decrementing the lifetime/lap counter (ix+0x06) on a wrap. B is
 * the negated velocity; `cp b` decides the wrap via carry. Both paths re-add the raw velocity at
 * loc_140d and then fall through into loc_1410 (a separate registered routine, stubbed here as a
 * recorded m.call, so (ix+0x05) is NOT written by this routine).
 *
 * Pinned paths:
 *   no-wrap (X >= threshold, cp b => NO carry, jr nc taken, no dec):
 *     ix+0x0a=0x03 -> neg => B=0xFD; ix+0x05=0xFE. cp: 0xFE-0xFD => no borrow (NC) => jr taken.
 *     add: 0xFE + 0x03 = 0x01. (ix+0x06) untouched.
 *     T = 19 + 8 + 4 + 19 + 4 + 12 + 19 = 85.
 *   wrap (X < threshold, cp b => carry, jr nc NOT taken, dec (ix+0x06)):
 *     ix+0x0a=0x03 -> B=0xFD; ix+0x05=0x01. cp: 0x01-0xFD => borrow (C) => jr not taken => dec.
 *     (ix+0x06): 0x05 -> 0x04. add: 0x01 + 0x03 = 0x04.
 *     T = 19 + 8 + 4 + 19 + 4 + 7 + 23 + 19 = 103.
 *
 * TEETH: mis-charge `dec (ix+0x06)` (23 T) as 11 T on the wrap path -- the golden T must catch it.
 *
 * Run: node --test games/pooyan/translated/test/loc_13fe.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_13fe } from "../loc_13fe.js";

const CALLER_RET = 0xabcd;
const IX = 0x8800;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x13fe, pcSeq: [],
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
    call(addr, site) { this.calls.push(addr); this.site = site; return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_13fe: no-wrap (X >= threshold) skips dec, re-adds velocity, falls into loc_1410", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x0a, 0x03); // velocity -> neg => B = 0xFD
  m.mem.write8(IX + 0x05, 0xFE); // X: 0xFE >= 0xFD => no carry => jr nc taken
  m.mem.write8(IX + 0x06, 0x05); // lap counter -- must remain untouched
  loc_13fe(m);

  assert.equal(m.tstates, 85, "T = 19+8+4+19+4+12(jr taken)+19");
  assert.deepEqual(m.pcSeq, [0x1401, 0x1403, 0x1404, 0x1407, 0x1408, 0x140d, 0x1410],
    "jr nc taken jumps straight to loc_140d, then falls into loc_1410");
  assert.deepEqual(m.calls, [0x1410], "falls through into the separate routine loc_1410");
  assert.equal(m.regs.b, 0xFD, "B = negated velocity");
  assert.equal(m.regs.a, 0x01, "A = 0xFE + 0x03 = 0x01 (add wraps)");
  assert.equal(m.mem.read8(IX + 0x06), 0x05, "lap counter untouched on the no-wrap path");
  assert.equal(m.mem.read8(IX + 0x05), 0xFE, "loc_13fe does not write X (loc_1410 does)");
  assert.equal(m.pop16(), CALLER_RET, "caller return still seated (SP balanced)");
});

test("loc_13fe: wrap (X < threshold) decrements the lap counter (ix+0x06)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x0a, 0x03); // velocity -> B = 0xFD
  m.mem.write8(IX + 0x05, 0x01); // X: 0x01 < 0xFD => carry => jr nc NOT taken => dec
  m.mem.write8(IX + 0x06, 0x05); // lap counter -> 0x04
  loc_13fe(m);

  assert.equal(m.tstates, 103, "T = 19+8+4+19+4+7(jr nt)+23(dec ix+d)+19");
  assert.deepEqual(m.pcSeq, [0x1401, 0x1403, 0x1404, 0x1407, 0x1408, 0x140a, 0x140d, 0x1410],
    "jr nc not taken runs dec at 0x140a, then loc_140d, then loc_1410");
  assert.deepEqual(m.calls, [0x1410], "falls through into loc_1410");
  assert.equal(m.regs.b, 0xFD, "B = negated velocity");
  assert.equal(m.regs.a, 0x04, "A = 0x01 + 0x03 = 0x04");
  assert.equal(m.mem.read8(IX + 0x06), 0x04, "lap counter decremented on the wrap");
  assert.equal(m.pop16(), CALLER_RET, "caller return still seated (SP balanced)");
});

test("loc_13fe MUTATION: `dec (ix+0x06)` mis-charged 11T (not 23T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  // 0x140d is reached immediately after the dec on the wrap path; mis-charge that step.
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x140d ? 11 : cycles);
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x0a, 0x03);
  m.mem.write8(IX + 0x05, 0x01); // wrap path
  m.mem.write8(IX + 0x06, 0x05);
  loc_13fe(m);

  assert.equal(m.tstates, 91, "mutation loses 12 T on the dec (23 -> 11)");
});
