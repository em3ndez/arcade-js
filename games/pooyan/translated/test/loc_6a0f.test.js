// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_6a0f (ROM 0x6a0f, Pooyan). Three early exits gated by the (0x892b)
 * block: (0x892b)==0 -> ret z; (0x892c)==0x06 -> ret z; (0x892a)!=0 -> dec (0x892a) and ret. When
 * (0x892a) reaches 0 it runs the 18-record sweep (ix from 0x8ae0, stride 0x18) through loc_6a35. The
 * mock's `call` POPS the pushed return (the stack tooth) and does NOT run the callee. Paths A-D cover
 * every exit and the loop; a T-state mutation guards the charges.
 *
 * Run: node --test games/pooyan/translated/test/loc_6a0f.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6a0f } from "../loc_6a0f.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6a0f, pcSeq: [],
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
    // model the callee's own ret: pop the pushed continuation into pc (a NORMAL return, e.g. loc_6a35's
    // `ret c`). loc_6a0f's skip-abort guard reads m.pc, so the mock must set it or the guard sees stale
    // pc. A SPAWN (pop-af; ret) is modelled per-test by overriding call to pop twice (see below).
    call(addr) { this.calls.push(addr); this.pc = this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_6a0f Path A: (0x892b)==0 -> ret z", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x892b, 0x00);

  loc_6a0f(m);

  assert.deepEqual(m.pcSeq, [0x6a12, 0x6a13, 0x6a14, CALLER_RET]);
  assert.deepEqual(m.calls, []);
  assert.equal(m.tstates, 10 + 7 + 4 + 11, "ld hl + ld a + and a + ret z taken");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_6a0f Path B: (0x892c)==0x06 -> ret z", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x892b, 0x01);
  m.mem.write8(0x892c, 0x06);

  loc_6a0f(m);

  assert.deepEqual(m.pcSeq, [0x6a12, 0x6a13, 0x6a14, 0x6a15, 0x6a16, 0x6a17, 0x6a19, CALLER_RET]);
  assert.deepEqual(m.calls, []);
  assert.equal(m.tstates, 10 + 7 + 4 + 5 + 6 + 7 + 7 + 11, "through the second ret z taken");
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_6a0f Path C: (0x892a)!=0 -> dec (0x892a) and ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x892b, 0x01);
  m.mem.write8(0x892c, 0x03);
  m.mem.write8(0x892a, 0x05);

  loc_6a0f(m);

  assert.deepEqual(m.pcSeq,
    [0x6a12, 0x6a13, 0x6a14, 0x6a15, 0x6a16, 0x6a17, 0x6a19, 0x6a1a, 0x6a1c, 0x6a1d, 0x6a1e, 0x6a20, 0x6a21, CALLER_RET]);
  assert.deepEqual(m.calls, []);
  assert.equal(m.tstates, 97, "through jr z not taken + dec (hl) + ret");
  assert.equal(m.mem.read8(0x892a), 0x04, "(0x892a) decremented");
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

const D_HEAD = [0x6a12, 0x6a13, 0x6a14, 0x6a15, 0x6a16, 0x6a17, 0x6a19, 0x6a1a, 0x6a1c, 0x6a1d, 0x6a1e, 0x6a22];
const D_SETUP = [0x6a26, 0x6a29, 0x6a2b];
const D_ITER = [0x6a2c, 0x6a35, 0x6a30, 0x6a32, 0x6a2b]; // djnz taken -> back to 0x6a2b
const D_LAST = [0x6a2c, 0x6a35, 0x6a30, 0x6a32, 0x6a34]; // djnz fall-through -> ret

test("loc_6a0f Path D: (0x892a)==0 -> 18-record sweep through loc_6a35", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x892b, 0x01);
  m.mem.write8(0x892c, 0x03);
  m.mem.write8(0x892a, 0x00);

  loc_6a0f(m);

  const expected = [...D_HEAD, ...D_SETUP];
  for (let i = 0; i < 17; i++) expected.push(...D_ITER);
  expected.push(...D_LAST, CALLER_RET);

  assert.deepEqual(m.pcSeq, expected);
  assert.deepEqual(m.calls, Array(18).fill(0x6a35));
  assert.equal(m.tstates, 1071, "81 head + 31 setup + 949 loop + 10 ret");
  assert.equal(m.regs.ix, 0x8c90, "ix = 0x8ae0 + 18*0x18");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_6a0f MUTATION: dec (hl) mis-charged 10T (not 11T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x6a21 ? 10 : cycles);
  seatCaller(m);
  m.mem.write8(0x892b, 0x01);
  m.mem.write8(0x892c, 0x03);
  m.mem.write8(0x892a, 0x05);

  loc_6a0f(m);

  assert.equal(m.tstates, 96, "mutation loses 1T on dec (hl)");
  assert.throws(() => assert.equal(m.tstates, 97), /97/);
});

test("loc_6a0f Path D-spawn: loc_6a35 spawning on record 1 aborts the sweep after ONE call (one-spawn)", () => {
  const m = makeMachine();
  // model loc_6a35 SPAWNING: its `pop af; ret` drops 6a0f's pushed continuation (0x6a2f) and returns to
  // the caller-caller, so pc ends at CALLER_RET -> loc_6a0f's guard fires and the record sweep aborts.
  m.call = function (addr) {
    this.calls.push(addr);
    this.pop16(); // pop af -- drop the pushed 0x6a2f continuation
    this.pc = this.pop16(); // ret -- to the caller-caller (CALLER_RET)
    return undefined;
  };
  seatCaller(m);
  m.mem.write8(0x892b, 0x01);
  m.mem.write8(0x892c, 0x03);
  m.mem.write8(0x892a, 0x00); // run the sweep

  loc_6a0f(m);

  assert.deepEqual(m.calls, [0x6a35], "spawn on record 1 -> exactly ONE call; the skip aborted the sweep");
  assert.equal(m.pc, CALLER_RET, "pop-af/ret unwound to the caller-caller (guard propagated the skip)");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});
