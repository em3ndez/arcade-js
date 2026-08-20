// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_6404 (ROM 0x6404, Pooyan) -- a guarded two-pass loop calling
 * loc_6435 per pass, mirroring loc_6368 (iy walks 0x8848 +4/pass, I latches 0 then 4, exx brackets
 * the call). Guard: if 0x8f50 is set, run the loop; else run only when 0x8907 bit0 is clear, else
 * `ret nz`. The djnz body at 0x641c is inlined (no external entry).
 *
 * The mock's `call` POPS the pushed return address (loc_6435's `ret`) and CLOBBERS the active
 * BC/DE/HL/A bank (what loc_6435 does), so the exx's have teeth and a missing push16 desyncs SP.
 *
 * Three paths: LOOP-NZ (0x8f50 set -> jr nz -> loop, T=210); LOOP-FALL (0x8f50=0, bit0 clear ->
 * fall through -> loop, T=230); GUARD-RET (0x8f50=0, bit0 set -> ret nz, T=55).
 * TEETH: mis-charge `add iy,de` (15 T) as 11 T -> the 210-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_6404.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6404 } from "../loc_6404.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6404, pcSeq: [],
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
    // loc_6435's `ret` pops the pushed return address; it also clobbers the active BC/DE/HL/A bank.
    // Model both so a missing push16 desyncs SP and a dropped exx leaks 0xEE into the loop state.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
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

const PC_SETUP = [0x6414, 0x6416, 0x6419, 0x641a, 0x641c];
const PC_LOOP = [
  0x641d, 0x6435, 0x6421, 0x6423, 0x6424, 0x6426, 0x641c, // pass 1: exx, call->target, exx, add iy, ld a,e, ld i,a, djnz taken
  0x641d, 0x6435, 0x6421, 0x6423, 0x6424, 0x6426, 0x6428, // pass 2: ... djnz falls out
];

function assertLoopFinalState(m) {
  assert.equal(m.pc, CALLER_RET, "ret lands on the seated caller");
  assert.deepEqual(m.calls, [0x6435, 0x6435], "loc_6435 called once per pass");
  assert.equal(m.regs.iy, 0x8850, "iy = 0x8848 + 4 + 4");
  assert.equal(m.regs.i, 0x04, "I latched to E (0x04) on the last pass");
  assert.equal(m.regs.a, 0x04, "A = E from ld a,e");
  assert.equal(m.regs.b, 0x00, "loop counter exhausted");
  assert.equal(m.regs.de, 0x0004, "stride DE preserved across both calls (exx)");
  assert.equal(m.regs.c, 0x11, "entry C preserved through the exx dance");
  assert.equal(m.regs.hl, 0x2233, "entry HL preserved through the exx dance");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline (every push16 balanced)");
}

test("loc_6404 Path LOOP-NZ: 0x8f50 set -> jr nz -> two-pass loop", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.c = 0x11; m.regs.h = 0x22; m.regs.l = 0x33;
  m.mem.write8(0x8f50, 0x01); // nonzero -> jr nz taken, bit0 gate skipped

  loc_6404(m);

  assert.equal(m.tstates, 210, "Path LOOP-NZ T-state total");
  assert.deepEqual(m.pcSeq, [0x6407, 0x6408, 0x6410, ...PC_SETUP, ...PC_LOOP, CALLER_RET],
    "jr nz taken straight to 0x6410 then the loop");
  assertLoopFinalState(m);
});

test("loc_6404 Path LOOP-FALL: 0x8f50=0, 0x8907 bit0 clear -> fall through -> loop", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.c = 0x11; m.regs.h = 0x22; m.regs.l = 0x33;
  m.mem.write8(0x8f50, 0x00); // zero -> jr nz not taken
  m.mem.write8(0x8907, 0x00); // bit0 clear -> ret nz not taken -> fall to loop

  loc_6404(m);

  assert.equal(m.tstates, 230, "Path LOOP-FALL T-state total");
  assert.deepEqual(m.pcSeq,
    [0x6407, 0x6408, 0x640a, 0x640d, 0x640f, 0x6410, ...PC_SETUP, ...PC_LOOP, CALLER_RET],
    "bit0 gate falls through to 0x6410 then the loop");
  assertLoopFinalState(m);
});

test("loc_6404 Path GUARD-RET: 0x8f50=0, 0x8907 bit0 set -> ret nz, no loop", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f50, 0x00); // zero -> jr nz not taken
  m.mem.write8(0x8907, 0x01); // bit0 set -> and 0x01 nonzero -> ret nz taken

  loc_6404(m);

  assert.equal(m.tstates, 55, "T = ld a + and a + jr nz(not) + ld a + and n + ret nz(taken)");
  assert.deepEqual(m.pcSeq, [0x6407, 0x6408, 0x640a, 0x640d, 0x640f, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "ret nz to the seated caller");
  assert.deepEqual(m.calls, [], "guard closed -- no loop, no calls");
  assert.equal(m.regs.a, 0x01, "A = mem[0x8907] & 0x01");
  assert.equal(m.regs.sp, 0x8780, "no push -- stack at baseline, ret nz pops CALLER_RET");
});

test("loc_6404 MUTATION: `add iy,de` mis-charged 11T (not 15T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x6423 ? 11 : cycles);
  seatCaller(m);
  m.mem.write8(0x8f50, 0x01);

  loc_6404(m);

  assert.equal(m.tstates, 202, "mutation loses 8 T (15 -> 11, twice)");
  assert.throws(
    () => assert.equal(m.tstates, 210, "Path LOOP-NZ T-state total"),
    /210/,
    "the 210-T golden must fail on the mutant",
  );
});
