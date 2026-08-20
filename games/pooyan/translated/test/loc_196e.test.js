// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_196e (ROM 0x196e, Pooyan) -- the gated multi-flag periodic driver.
 * Bails while (0x8d55)!=0; (0x8902) picks a mode (<5 tail, ==5 arm loc_0f58, >5 latch + loc_0f6c);
 * the shared tail runs a (0x8d22) countdown that on expiry fires loc_0f76.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`), so a
 * call site that forgot its push16 desyncs the stack and the final ret misses CALLER_RET.
 *
 * Path GT (mode 6, 0x8d32==0 -> call 0x0f6c, tail countdown decrements 0x8d22): full pcSeq + T=215,
 * ends via `dec (hl)` + ret to the seated caller. TEETH: mis-charge `dec (hl)` (11 T) as 7 T.
 *
 * Run: node --test games/pooyan/translated/test/loc_196e.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_196e } from "../loc_196e.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x196e, pcSeq: [],
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
    // The callee's `ret` pops the return address loc_196e pushed at the call site -- model that pop so
    // the stack stays balanced (a missing push16 at the call site then desyncs SP and fails the test).
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

const PC_GT = [
  0x1971, 0x1972, 0x1973, 0x1976, 0x1978, 0x197a, 0x197c, // mode>5 branch selection
  0x197f, 0x1982, 0x1983, 0x1985, 0x0f6c, 0x19a0,         // latch mode, call 0x0f6c -> target, jr tail
  0x19a3, 0x19a4, 0x19a5, 0x19a8, 0x19a9, 0x19aa,         // tail: both bail flags clear
  0x19ad, 0x19ae, 0x19af, 0x19b1, 0x19b2,                 // countdown: 0x8d22 non-zero -> dec (hl)
  CALLER_RET,
];

test("loc_196e Path GT: mode 6 -> call 0x0f6c, tail decrements 0x8d22, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d55, 0x00); // not busy
  m.mem.write8(0x8902, 0x06); // mode > 5
  m.mem.write8(0x8d32, 0x00); // gate open -> call 0x0f6c
  m.mem.write8(0x8d21, 0x00); // tail bail flags clear
  m.mem.write8(0x8f24, 0x00);
  m.mem.write8(0x8d22, 0x03); // countdown non-zero -> dec (hl) path

  loc_196e(m);

  assert.equal(m.tstates, 215, "Path GT T-state total");
  assert.deepEqual(m.pcSeq, PC_GT, "step boundaries match the ROM bytes");
  assert.deepEqual(m.calls, [0x0f6c], "only loc_0f6c fired");
  assert.equal(m.mem.read8(0x8d55), 0x06, "mode latched into 0x8d55");
  assert.equal(m.mem.read8(0x8d22), 0x02, "countdown decremented 0x03 -> 0x02");
  assert.equal(m.pc, CALLER_RET, "ret at 0x19b2 to the seated caller");
  // Stack fully unwinds: call 0x0f6c's callee ret pops the pushed 0x1988, final ret pops CALLER_RET.
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline (push16 matched the callee ret)");
});

test("loc_196e busy: (0x8d55)!=0 -> ret nz immediately", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d55, 0x01);

  loc_196e(m);

  assert.equal(m.tstates, 13 + 4 + 11, "ld a + and a + ret nz");
  assert.deepEqual(m.pcSeq, [0x1971, 0x1972, CALLER_RET]);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780, "ret consumed CALLER_RET");
});

test("loc_196e Path EQ: mode 5 arms 0x8d68 pair + fires loc_0f58, tail expiry fires loc_0f76", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d55, 0x00);
  m.mem.write8(0x8902, 0x05); // mode == 5
  m.mem.write8(0x8d32, 0x00); // -> HL stays 0x8d68 (jr nz not taken)
  m.mem.write8(0x8d68, 0x00); // slot free -> arm + call 0x0f58
  m.mem.write8(0x8d21, 0x00);
  m.mem.write8(0x8f24, 0x00);
  m.mem.write8(0x8d22, 0x00); // countdown expired -> reload + call 0x0f76

  loc_196e(m);

  assert.deepEqual(m.pcSeq, [
    0x1971, 0x1972, 0x1973, 0x1976, 0x1978, 0x197a, 0x198a, // mode==5 branch
    0x198d, 0x198e, 0x1990, 0x1993, 0x1994, 0x1995,         // 0x8d32==0 -> HL=0x8d68, slot free
    0x1997, 0x1999, 0x199a, 0x199b, 0x199d, 0x0f58,         // arm pair, call 0x0f58 -> target
    0x19a3, 0x19a4, 0x19a5, 0x19a8, 0x19a9, 0x19aa,         // (0x0f58 returns to 0x19a0 -> tail, no step)
    0x19ad, 0x19ae, 0x19af, 0x19b3, 0x19b5, 0x19b6, 0x19b8, 0x0f76, // expiry -> call 0x0f76 -> target
    CALLER_RET,                                             // 0x0f76 returns to 0x19bb `ret` -> caller
  ], "mode==5 path arms 0x8d68 (=1) + 0x8d6a (=1) then countdown reload + loc_0f76");
  assert.deepEqual(m.calls, [0x0f58, 0x0f76], "loc_0f58 then loc_0f76");
  assert.equal(m.mem.read8(0x8d68), 0x01, "0x8d68 armed");
  assert.equal(m.mem.read8(0x8d6a), 0x01, "0x8d6a armed (inc l twice)");
  assert.equal(m.mem.read8(0x8d22), 0x20, "countdown reloaded to 0x20 at expiry");
  assert.equal(m.mem.read8(0x8d21), 0x01, "0x8d21 set (dec l then ld (hl),0x01)");
  assert.equal(m.pc, CALLER_RET, "ret at 0x19bb to the seated caller");
  assert.equal(m.regs.sp, 0x8780, "two matched push16/callee-ret pairs + final ret -> baseline");
});

test("loc_196e MUTATION: `dec (hl)` mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x19b2 ? 7 : cycles);
  seatCaller(m);
  m.mem.write8(0x8d55, 0x00);
  m.mem.write8(0x8902, 0x06);
  m.mem.write8(0x8d32, 0x00);
  m.mem.write8(0x8d21, 0x00);
  m.mem.write8(0x8f24, 0x00);
  m.mem.write8(0x8d22, 0x03);

  loc_196e(m);

  assert.equal(m.tstates, 211, "mutation loses 4 T (11 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 215, "Path GT T-state total"),
    /215/,
    "the 215-T golden must fail on the mutant",
  );
});
