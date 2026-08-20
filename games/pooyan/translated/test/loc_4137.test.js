// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_4137 (ROM 0x4137, Pooyan) -- a per-object descent step.
 * loc_4006 animates; (ix+03h) is advanced by the signed step (ix+0ah), borrowing one from the
 * sub-position (ix+04h) when the position is below -(step). While (ix+04h) is still >= 3 the object
 * is mid-travel and returns; when it drops below 3 it has landed -> latch (ix+17h)+1 into 0x8d1d,
 * reset the object (phase 2, dwell 0x18), and tail through loc_0c45 (HL=0x41b1) then jp loc_381e.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`); a
 * missing push16 then desyncs SP. Neither loc_4006, loc_0c45, nor loc_381e touches a cell/register
 * loc_4137 reads afterward, so the mock just pops. push de-less: the two mid-routine pushes (0x413a,
 * 0x416c) are matched by loc_4006's / loc_0c45's ret, and the tail jp's callee ret eats CALLER_RET.
 *
 * Path LAND (step -2, jr nc TAKEN, (ix+04h) 2 -> stays < 3): full descent -> tail jp loc_381e. T=271.
 * Path TRAVEL (step +2, jr nc NOT taken -> dec (ix+04h) 5->4, still >= 3): ret nc at 0x4155. T=180.
 * MUTATION: mis-charge `neg` (8 T) as 4 T -> the golden T fails.
 *
 * Run: node --test games/pooyan/translated/test/loc_4137.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_4137 } from "../loc_4137.js";

const CALLER_RET = 0xabcd;
const IX = 0x9100;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x4137, pcSeq: [],
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
    // Model the callee's `ret` consuming the pushed return address -- a missing push16 desyncs SP.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.regs.ix = IX;
}

test("loc_4137 Path LAND: step -2, jr nc taken, sub-position < 3 -> tail jp loc_381e", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x0a, 0xfe); // step = -2 -> neg -> b = 0x02
  m.mem.write8(IX + 0x03, 0x05); // position 5 >= 2 -> jr nc taken (no borrow)
  m.mem.write8(IX + 0x04, 0x02); // sub-position 2; cp 3 -> carry -> ret nc not taken -> landed
  m.mem.write8(IX + 0x17, 0x04); // sound id -> 0x8d1d = 5

  loc_4137(m);

  assert.equal(m.tstates, 271, "Path LAND T-state total");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x413d, 0x413f, 0x4140, 0x4143, 0x4144, 0x4149, // jr nc taken (skip dec)
    0x414c, 0x414f, 0x4150, 0x4153, 0x4155, 0x4156,         // ret nc not taken (landed)
    0x4159, 0x415a, 0x415d, 0x415e, 0x4162, 0x4166, 0x4169,
    0x0c45, 0x381e,                                         // call loc_0c45 -> tail jp loc_381e
  ]);
  assert.equal(m.pc, 0x381e, "tail jp lands on loc_381e");
  assert.deepEqual(m.calls, [0x4006, 0x0c45, 0x381e]);
  assert.equal(m.mem.read8(IX + 0x03), 0x03, "position += step: 5 + (-2) = 3");
  assert.equal(m.mem.read8(IX + 0x04), 0x02, "sub-position untouched (jr nc taken)");
  assert.equal(m.mem.read8(0x8d1d), 0x05, "sound latch = (ix+17h)+1");
  assert.equal(m.mem.read8(IX + 0x02), 0x02, "object reset to phase 2");
  assert.equal(m.mem.read8(IX + 0x11), 0x18, "dwell reset to 0x18");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_4137 Path TRAVEL: step +2, jr nc not taken -> dec (ix+04h), still >= 3 -> ret nc", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x0a, 0x02); // step = +2 -> neg -> b = 0xfe
  m.mem.write8(IX + 0x03, 0x10); // position 0x10 < 0xfe -> carry -> jr nc NOT taken -> borrow
  m.mem.write8(IX + 0x04, 0x05); // sub-position 5 -> dec -> 4; cp 3 -> no carry -> ret nc (travel)

  loc_4137(m);

  assert.equal(m.tstates, 180, "Path TRAVEL T-state total");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x413d, 0x413f, 0x4140, 0x4143, 0x4144, 0x4146, 0x4149, // jr nc not taken -> dec (ix+04h)
    0x414c, 0x414f, 0x4150, 0x4153, 0x4155, CALLER_RET,             // ret nc taken -> caller
  ]);
  assert.equal(m.pc, CALLER_RET, "ret nc returns to the seated caller");
  assert.deepEqual(m.calls, [0x4006], "only the animation call");
  assert.equal(m.mem.read8(IX + 0x04), 0x04, "sub-position borrowed one (5 -> 4)");
  assert.equal(m.mem.read8(IX + 0x03), 0x12, "position += step: 0x10 + 2 = 0x12");
  assert.equal(m.mem.read8(0x8d1d), 0x00, "no sound latch on the travel path");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_4137 MUTATION: `neg` mis-charged 4T (not 8T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x413f ? 4 : cycles);
  seatCaller(m);
  m.mem.write8(IX + 0x0a, 0xfe);
  m.mem.write8(IX + 0x03, 0x05);
  m.mem.write8(IX + 0x04, 0x02);
  m.mem.write8(IX + 0x17, 0x04);

  loc_4137(m);

  assert.equal(m.tstates, 267, "mutation loses 4 T (8 -> 4)");
  assert.throws(() => assert.equal(m.tstates, 271, "golden"), /271/, "the golden T must fail on the mutant");
});
