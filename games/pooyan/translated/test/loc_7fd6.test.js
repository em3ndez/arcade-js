// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_7fd6 (ROM 0x7fd6, Pooyan) -- a guarded trigger. Rets unless
 * (0x8802) is set; selects a status byte via (0x880e)/(0x880d); rets if A|(HL) is nonzero; else,
 * when (0x8810)&0x18 is set, calls 0x0ecf then tail-jps to 0x0d78.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`).
 * Path FULL exercises the one real CALL (0x7ff9 -> 0x0ecf, push16 0x7ffc) followed by the tail jp
 * to 0x0d78: the push16 balances against 0x0ecf's ret, and the tail target's ret consumes the seated
 * CALLER_RET -- SP unwinds to baseline. Drop the push16 and the final pops fall through the baseline.
 *
 * Paths: GATE (0x8802==0 -> ret z at 0x7fda); JRZ ((0x880e)==0 -> jr z, HL=0x880e, later ret z at
 * 0x7ff8); JRNZ ((0x880d)==0 -> ld l,0x88, or nonzero -> ret nz at 0x7ff1); FULL (jr nz branch,
 * or==0, trigger set -> call 0x0ecf + tail jp 0x0d78). TEETH: mis-charge `dec hl` (6T) as 4T.
 *
 * Run: node --test games/pooyan/translated/test/loc_7fd6.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_7fd6 } from "../loc_7fd6.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x7fd6, pcSeq: [],
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
    // stays balanced. A missing push16 before the 0x0ecf call would then desync SP (the tail jp's
    // pop would run past CALLER_RET) and the baseline assertion fails. 0x0ecf/0x0d78 need no regs here.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_7fd6 Path GATE: (0x8802)==0 -> ret z at 0x7fda", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8802, 0x00);

  loc_7fd6(m);

  assert.equal(m.tstates, 13 + 4 + 11, "ld a + and a + ret z");
  assert.deepEqual(m.pcSeq, [0x7fd9, 0x7fda, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "ret z to the seated caller");
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780, "SP unwound to baseline");
});

test("loc_7fd6 Path JRZ: (0x880e)==0 -> jr z (HL=0x880e), trigger clear -> ret z at 0x7ff8", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8802, 0x01);       // gate open
  m.mem.write8(0x880e, 0x00);       // jr z taken -> HL stays 0x880e, A = 0
  m.mem.write8(0x8810, 0x00);       // (0x8810)&0x18 == 0 -> ret z at 0x7ff8

  loc_7fd6(m);

  assert.equal(m.tstates, 106, "Path JRZ T-state total");
  assert.deepEqual(m.pcSeq, [
    0x7fd9, 0x7fda, 0x7fdb, 0x7fde, 0x7fdf, 0x7fe0, 0x7fef, 0x7ff0, 0x7ff1,
    0x7ff2, 0x7ff5, 0x7ff7, 0x7ff8, CALLER_RET,
  ], "jr z branch keeps HL=0x880e; final ret z at 0x7ff8");
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780, "SP unwound to baseline");
});

test("loc_7fd6 Path JRNZ: (0x880d)==0 -> ld l,0x88, or nonzero -> ret nz at 0x7ff1", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8802, 0x01);       // gate open
  m.mem.write8(0x880e, 0x01);       // jr z not taken
  m.mem.write8(0x880d, 0x00);       // and a -> Z -> jr nz not taken -> ld l,0x88 (HL=0x8988)
  m.mem.write8(0x8908, 0x04);       // A = 0x04
  m.mem.write8(0x8988, 0x00);       // or (hl) = 0x04 -> nonzero -> ret nz

  loc_7fd6(m);

  assert.equal(m.tstates, 126, "Path JRNZ T-state total");
  assert.deepEqual(m.pcSeq, [
    0x7fd9, 0x7fda, 0x7fdb, 0x7fde, 0x7fdf, 0x7fe0, 0x7fe2, 0x7fe3, 0x7fe4, 0x7fe5,
    0x7fe8, 0x7feb, 0x7fed, 0x7fef, 0x7ff0, 0x7ff1, CALLER_RET,
  ], "ld l,0x88 branch; ret nz at 0x7ff1");
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.l, 0x88, "HL low byte forced to 0x88");
  assert.equal(m.regs.sp, 0x8780, "SP unwound to baseline");
});

test("loc_7fd6 Path FULL: jr nz branch, or==0, trigger set -> call 0x0ecf + tail jp 0x0d78", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8802, 0x01);       // gate open
  m.mem.write8(0x880e, 0x01);       // jr z not taken
  m.mem.write8(0x880d, 0x01);       // and a -> NZ -> jr nz taken -> HL=0x8948
  m.mem.write8(0x8908, 0x00);       // A = 0
  m.mem.write8(0x8948, 0x00);       // or (hl) = 0 -> ret nz not taken
  m.mem.write8(0x8810, 0x08);       // &0x18 = 0x08 -> ret z not taken -> reach the call

  loc_7fd6(m);

  assert.equal(m.tstates, 174, "Path FULL T-state total");
  assert.deepEqual(m.pcSeq, [
    0x7fd9, 0x7fda, 0x7fdb, 0x7fde, 0x7fdf, 0x7fe0, 0x7fe2, 0x7fe3, 0x7fe4, 0x7fe5,
    0x7fe8, 0x7feb, 0x7fef, 0x7ff0, 0x7ff1, 0x7ff2, 0x7ff5, 0x7ff7, 0x7ff8, 0x7ff9,
    0x0ecf, 0x0d78,
  ], "jr nz taken (HL=0x8948); call 0x0ecf then tail jp 0x0d78");
  assert.equal(m.pc, 0x0d78, "tail jp lands on 0x0d78");
  assert.deepEqual(m.calls, [0x0ecf, 0x0d78], "one real call then the tail jp");
  // push16(0x7ffc) balances 0x0ecf's ret; the tail target's ret consumes the seated CALLER_RET.
  assert.equal(m.regs.sp, 0x8780, "SP unwound to baseline (push16 matched, tail consumed CALLER_RET)");
});

test("loc_7fd6 MUTATION: `dec hl` mis-charged 4T (not 6T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  // mis-charge dec hl (steps to 0x7fe3) as 4T
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x7fe3 ? 4 : cycles);
  seatCaller(m);
  m.mem.write8(0x8802, 0x01);
  m.mem.write8(0x880e, 0x01);
  m.mem.write8(0x880d, 0x01);
  m.mem.write8(0x8908, 0x00);
  m.mem.write8(0x8948, 0x00);
  m.mem.write8(0x8810, 0x08);

  loc_7fd6(m);

  assert.equal(m.tstates, 172, "mutation loses 2 T (6 -> 4)");
  assert.throws(
    () => assert.equal(m.tstates, 174, "Path FULL T-state total"),
    /174/,
    "the 174-T golden must fail on the mutant",
  );
});
