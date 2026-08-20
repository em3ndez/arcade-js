// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_6368 (ROM 0x6368, Pooyan) -- a two-pass loop that calls loc_6381
 * once per pass, walking iy across the 0x8848 table (+4/pass) and latching I as the pass selector
 * (0, then 4). The djnz body at 0x6374 is inlined (no external entry). exx brackets each call so the
 * loop counter B and stride DE survive loc_6381's clobber of the active BC/DE/HL bank.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling loc_6381's `ret`), then
 * CLOBBERS the active BC/DE/HL/A bank -- exactly what loc_6381 does. So the two exx's have real teeth:
 * drop either and add iy,de / djnz read the 0xEE garbage, corrupting iy and the final registers.
 * A missing push16 desyncs SP (the mock still pops) so the closing ret misses CALLER_RET.
 *
 * One path: B=2 loop runs twice. Full pcSeq (visiting call target 0x6381) + T=181.
 * TEETH: mis-charge `add iy,de` (15 T) as 11 T -> the 181-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_6368.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6368 } from "../loc_6368.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6368, pcSeq: [],
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
    // loc_6381's `ret` pops the address the call site pushed -- model that pop so a missing push16
    // desyncs SP. loc_6381 also clobbers the active BC/DE/HL/A bank; clobber it here so a dropped exx
    // leaks 0xEE into the loop state (iy stride / counter) and fails the test. It does NOT touch I/iy.
    call(addr) {
      this.calls.push(addr);
      this.pc = this.pop16();
      regs.a = 0xee; regs.b = 0xee; regs.c = 0xee;
      regs.d = 0xee; regs.e = 0xee; regs.h = 0xee; regs.l = 0xee;
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

const PC_MAIN = [
  0x636c, 0x636e, 0x6371, 0x6372, 0x6374,                 // ld iy / ld b / ld de / xor a / ld i,a
  0x6375, 0x6381, 0x6379, 0x637b, 0x637c, 0x637e, 0x6374, // pass 1: exx, call->target, exx, add iy, ld a,e, ld i,a, djnz taken
  0x6375, 0x6381, 0x6379, 0x637b, 0x637c, 0x637e, 0x6380, // pass 2: ... djnz falls out
  CALLER_RET,
];

test("loc_6368: two-pass loop, iy walks 0x8848 +4/pass, I latches 0 then 4", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.c = 0x11; m.regs.h = 0x22; m.regs.l = 0x33; // entry regs the exx dance must preserve

  loc_6368(m);

  assert.equal(m.tstates, 181, "T-state total");
  assert.deepEqual(m.pcSeq, PC_MAIN, "step boundaries visit call target 0x6381");
  assert.equal(m.pc, CALLER_RET, "ret lands on the seated caller");
  assert.deepEqual(m.calls, [0x6381, 0x6381], "loc_6381 called once per pass");
  assert.equal(m.regs.iy, 0x8850, "iy = 0x8848 + 4 + 4");
  assert.equal(m.regs.i, 0x04, "I latched to E (0x04) on the last pass");
  assert.equal(m.regs.a, 0x04, "A = E from ld a,e");
  assert.equal(m.regs.b, 0x00, "loop counter exhausted");
  assert.equal(m.regs.de, 0x0004, "stride DE preserved across both calls (exx)");
  assert.equal(m.regs.c, 0x11, "entry C preserved through the exx dance");
  assert.equal(m.regs.hl, 0x2233, "entry HL preserved through the exx dance");
  // Stack fully unwinds: each push16 matched loc_6381's ret pop, the closing ret pops CALLER_RET.
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline (every push16 balanced)");
});

test("loc_6368 MUTATION: `add iy,de` mis-charged 11T (not 15T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x637b ? 11 : cycles);
  seatCaller(m);

  loc_6368(m);

  assert.equal(m.tstates, 173, "mutation loses 8 T (15 -> 11, twice)");
  assert.throws(
    () => assert.equal(m.tstates, 181, "T-state total"),
    /181/,
    "the 181-T golden must fail on the mutant",
  );
});
