// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5334 (ROM 0x5334, Pooyan) -- the countdown/expiry handler, gated on
 * the latch (0x8d6e). Reads the live script pointer (0x8d71); when its target byte is 0xff it compares
 * the guard (0x8d6d) against (0x8901) and, on reach, clears guard/latch/(0x8d07); otherwise it ticks the
 * delay (0x8d73) and, on expiry, advances the pointer and sweeps the 6-entry stride-0x18 table at 0x8ae0
 * calling 0x5374 per entry (BC/DE/HL banked across the call via exx).
 *
 * The mock's `call` POPS the return the call site pushed (modelling 0x5374's `ret`); 0x5374 leaves no
 * main-register state this routine reads after the exx swap-back, so no further modelling is needed. A
 * call site missing its push16 desyncs the stack and fails the final ret assertion.
 *
 * Paths: A NOT-LATCHED (ret z), B DELAY-RUNNING (jr nz taken, ret nz), C SWEEP (delay expires -> table
 * loop, 6x call 0x5374), D THRESHOLD-NOT-MET (target 0xff, ret nc), E CLEAR (target 0xff, guard reached).
 * TEETH: mis-charge `ld de,(nn)` (20T ED-form) as 16T -> the 482-T SWEEP golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_5334.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5334 } from "../loc_5334.js";

const CALLER_RET = 0xabcd;
const PRE_SEAT = 0x8780;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5334, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write16(regs.sp, v); },
    pop16() { const v = mem.read16(regs.sp); regs.sp = (regs.sp + 2) & 0xffff; return v; },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // 0x5374's `ret` pops the return this call site pushed -- model that pop so the stack balances (a
    // missing push16 then desyncs SP and fails the final ret). 0x5374 leaves IX/B/DE (banked by exx) intact.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = PRE_SEAT;
  m.push16(CALLER_RET);
}

function tableSeq(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(0x536b, 0x5374, 0x536f, 0x5371);
    out.push(i === n - 1 ? 0x5373 : 0x536a);
  }
  return out;
}

test("loc_5334 A NOT-LATCHED: 0x8d6e == 0 -> ret z", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d6e, 0x00);

  loc_5334(m);

  assert.equal(m.tstates, 13 + 4 + 11, "ld a + and a + ret z");
  assert.deepEqual(m.pcSeq, [0x5337, 0x5338, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, PRE_SEAT);
});

test("loc_5334 B DELAY-RUNNING: target != 0xff, delay still ticking -> ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d6e, 0x01);
  m.mem.write16(0x8d71, 0x9000); // DE = 0x9000
  m.mem.write8(0x9000, 0x00);    // target != 0xff -> jr nz taken
  m.mem.write8(0x8d73, 0x02);    // dec -> 1 != 0 -> ret nz

  loc_5334(m);

  assert.equal(m.tstates, 13 + 4 + 5 + 20 + 7 + 4 + 12 + 10 + 11 + 11, "DELAY-RUNNING golden");
  assert.deepEqual(m.pcSeq, [0x5337, 0x5338, 0x5339, 0x533d, 0x533e, 0x533f, 0x5355, 0x5358, 0x5359, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x8d73), 0x01, "delay decremented, not expired");
  assert.equal(m.regs.sp, PRE_SEAT);
});

test("loc_5334 C SWEEP: delay expires -> advance pointer + 6x call 0x5374", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d6e, 0x01);
  m.mem.write16(0x8d71, 0x9000); // DE = 0x9000
  m.mem.write8(0x9000, 0x00);    // target != 0xff -> jr nz taken
  m.mem.write8(0x8d73, 0x01);    // dec -> 0 -> ret nz not taken -> sweep

  loc_5334(m);

  const prefixT = 13 + 4 + 5 + 20 + 7 + 4 + 12 + 10 + 11 + 5 + 4 + 7 + 6 + 20 + 14 + 10 + 7;
  const loopT = 5 * (4 + 17 + 4 + 15 + 13) + (4 + 17 + 4 + 15 + 8);
  assert.equal(m.tstates, prefixT + loopT + 10, "SWEEP golden");
  assert.equal(m.tstates, 482, "SWEEP golden literal");
  assert.deepEqual(m.pcSeq, [
    0x5337, 0x5338, 0x5339, 0x533d, 0x533e, 0x533f, 0x5355, 0x5358, 0x5359,
    0x535a, 0x535b, 0x535c, 0x535d, 0x5361, 0x5365, 0x5368, 0x536a,
    ...tableSeq(6), CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, Array(6).fill(0x5374), "6 sweep calls");
  assert.equal(m.mem.read8(0x8d73), 0x00, "delay latched to 0");
  assert.equal(m.mem.read16(0x8d71), 0x9001, "pointer advanced (DE+1) and stored");
  assert.equal(m.regs.ix, 0x8b70, "IX = 0x8ae0 + 6*0x18");
  assert.equal(m.regs.b, 0x00, "loop counter exhausted");
  // Every push16 matched a callee ret pop, and the final ret popped CALLER_RET.
  assert.equal(m.regs.sp, PRE_SEAT, "stack fully unwound to the pre-seat baseline");
});

test("loc_5334 D THRESHOLD-NOT-MET: target == 0xff, (0x8901) >= guard -> ret nc", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d6e, 0x01);
  m.mem.write16(0x8d71, 0x9000);
  m.mem.write8(0x9000, 0xff);    // target == 0xff -> inc a == 0 -> jr nz not taken
  m.mem.write8(0x8d6d, 0x05);    // guard
  m.mem.write8(0x8901, 0x05);    // >= guard -> cp gives NC -> ret nc

  loc_5334(m);

  assert.equal(m.tstates, 13 + 4 + 5 + 20 + 7 + 4 + 7 + 13 + 4 + 13 + 4 + 11, "THRESHOLD-NOT-MET golden");
  assert.deepEqual(m.pcSeq, [0x5337, 0x5338, 0x5339, 0x533d, 0x533e, 0x533f, 0x5341, 0x5344, 0x5345, 0x5348, 0x5349, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x8d6d), 0x05, "guard not cleared");
  assert.equal(m.regs.sp, PRE_SEAT);
});

test("loc_5334 E CLEAR: target == 0xff, (0x8901) < guard -> clear guard/latch/0x8d07", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d6e, 0x01);
  m.mem.write16(0x8d71, 0x9000);
  m.mem.write8(0x9000, 0xff);
  m.mem.write8(0x8d6d, 0x05);    // guard
  m.mem.write8(0x8901, 0x03);    // < guard -> carry -> ret nc not taken -> clear
  m.mem.write8(0x8d07, 0x77);

  loc_5334(m);

  assert.equal(m.tstates, 13 + 4 + 5 + 20 + 7 + 4 + 7 + 13 + 4 + 13 + 4 + 5 + 4 + 13 + 13 + 13 + 10, "CLEAR golden");
  assert.deepEqual(m.pcSeq, [
    0x5337, 0x5338, 0x5339, 0x533d, 0x533e, 0x533f, 0x5341, 0x5344, 0x5345, 0x5348, 0x5349,
    0x534a, 0x534b, 0x534e, 0x5351, 0x5354, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x8d6d), 0x00, "guard cleared");
  assert.equal(m.mem.read8(0x8d6e), 0x00, "latch cleared");
  assert.equal(m.mem.read8(0x8d07), 0x00, "0x8d07 cleared");
  assert.equal(m.regs.sp, PRE_SEAT);
});

test("loc_5334 MUTATION: `ld de,(nn)` mis-charged 16T (not 20T ED-form) is caught by the SWEEP golden", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x533d ? 16 : cycles);
  seatCaller(m);
  m.mem.write8(0x8d6e, 0x01);
  m.mem.write16(0x8d71, 0x9000);
  m.mem.write8(0x9000, 0x00);
  m.mem.write8(0x8d73, 0x01);

  loc_5334(m);

  assert.equal(m.tstates, 478, "mutation loses 4 T (20 -> 16)");
  assert.throws(
    () => assert.equal(m.tstates, 482, "SWEEP golden"),
    /482/,
    "the 482-T golden must fail on the mutant",
  );
});
