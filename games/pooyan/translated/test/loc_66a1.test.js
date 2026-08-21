// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_66a1 (ROM 0x66a1, Pooyan). Decrements the 0x892b timer; while it
 * stays nonzero it rets (Path A). On zero it reloads 0x892b=0x08, advances the 0x892c phase, and
 * picks the sprite table by that phase's bit 0 -- 0x66bf when even (Path C, jr z taken) or 0x66c2
 * when odd (Path D, jr z not taken) -- then runs loc_2514 over three records and rets.
 *
 * The mock's `call` POPS the return the call site pushed (modelling the callee's `ret`); a call site
 * missing its push16 desyncs the stack. Run: node --test games/pooyan/translated/test/loc_66a1.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_66a1 } from "../loc_66a1.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x66a1, pcSeq: [],
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

// pcSeq through the on-zero prologue up to the table pick at 0x66b1, shared by Paths C and D.
const ZERO = [0x66a4, 0x66a5, 0x66a6, 0x66a7, 0x66a8, 0x66aa, 0x66ab, 0x66ac, 0x66ae, 0x66b1];
const ZERO_T = 10 + 11 + 7 + 4 + 5 + 10 + 6 + 11 + 12 + 10;

test("loc_66a1 Path A: timer still nonzero (0x892b=5 -> 4) -> ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x892b, 0x05);

  loc_66a1(m);

  assert.equal(m.tstates, 10 + 11 + 7 + 4 + 11, "ld hl + dec (hl) + ld a + and a + ret nz taken");
  assert.deepEqual(m.pcSeq, [0x66a4, 0x66a5, 0x66a6, 0x66a7, CALLER_RET], "ret nz to caller");
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x892b), 0x04, "timer decremented 5 -> 4");
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_66a1 Path C: timer -> 0, phase even (0x892c 1 -> 2, bit0=0) -> table 0x66bf, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x892b, 0x01);
  m.mem.write8(0x892c, 0x01);

  loc_66a1(m);

  assert.equal(m.tstates, ZERO_T + 12 + 10 + 7 + 17 + 10, "Path C T-state total");
  assert.deepEqual(m.pcSeq, [...ZERO, 0x66b6, 0x66b9, 0x66bb, 0x2514, CALLER_RET], "jr z taken -> 0x66bf");
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x2514]);
  assert.equal(m.mem.read8(0x892b), 0x08, "timer reloaded 0x08");
  assert.equal(m.mem.read8(0x892c), 0x02, "phase advanced 1 -> 2");
  assert.equal(m.regs.hl, 0x66bf, "even phase keeps table 0x66bf");
  assert.equal(m.regs.b, 0x03);
  assert.equal(m.regs.de, 0xffe8);
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_66a1 Path D: timer -> 0, phase odd (0x892c 0 -> 1, bit0=1) -> table 0x66c2, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x892b, 0x01);
  m.mem.write8(0x892c, 0x00);

  loc_66a1(m);

  assert.equal(m.tstates, ZERO_T + 7 + 10 + 10 + 7 + 17 + 10, "Path D T-state total");
  assert.deepEqual(m.pcSeq, [...ZERO, 0x66b3, 0x66b6, 0x66b9, 0x66bb, 0x2514, CALLER_RET], "jr z not taken -> 0x66c2");
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x2514]);
  assert.equal(m.mem.read8(0x892c), 0x01, "phase advanced 0 -> 1");
  assert.equal(m.regs.hl, 0x66c2, "odd phase overrides to table 0x66c2");
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_66a1 MUTATION: the 0x66a4 step mis-charged 9T (not 10T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x66a4 ? 9 : cycles);
  seatCaller(m);
  m.mem.write8(0x892b, 0x01);
  m.mem.write8(0x892c, 0x01);

  loc_66a1(m);

  const golden = ZERO_T + 12 + 10 + 7 + 17 + 10;
  assert.equal(m.tstates, golden - 1, "mutation loses 1 T");
  assert.throws(() => assert.equal(m.tstates, golden, "Path C T-state total"), /Path C/);
});
