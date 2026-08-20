// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_0f76 (ROM 0x0f76, Pooyan) -- when gate 0x8d68 is clear, draw
 * tile 0x1a + (0x8907 bit0) via loc_0ea2 (BOUNDARY) and TAIL jp to loc_0fc3 (BOUNDARY); otherwise
 * `ret nz` immediately.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`).
 * The `call 0x0ea2` pushes a return address the callee pops (balanced); the tail `jp 0x0fc3`
 * pushes NOTHING, so loc_0fc3's ret consumes the seated CALLER_RET -- the stack unwinds to the
 * PRE-SEAT baseline (assert SP, not "CALLER_RET still on the stack").
 *
 * Paths: P1 gate set (ret nz), P2 gate clear (draw + tail jp, exercising the 0x01 mask + add).
 * TEETH: mis-charge `add a,0x1a` (7 T) as 4 T on P2.
 *
 * Run: node --test games/pooyan/translated/test/loc_0f76.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0f76 } from "../loc_0f76.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0f76, pcSeq: [],
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
    // The callee's `ret` pops the return address the call site pushed -- a missing push16 then
    // desyncs SP and fails the baseline tooth. No callee result is read, so no reg effect.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_0f76 P1: gate 0x8d68 set -> ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d68, 0x01);

  loc_0f76(m);

  assert.equal(m.tstates, 28, "ld a + or a + ret nz");
  assert.deepEqual(m.pcSeq, [0x0f79, 0x0f7a, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780, "stack unwound");
});

test("loc_0f76 P2: gate clear -> draw 0x1a+bit0, tail jp loc_0fc3", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d68, 0x00);
  m.mem.write8(0x8907, 0xff); // and 0x01 -> 0x01, add 0x1a -> 0x1b

  loc_0f76(m);

  assert.equal(m.tstates, 76);
  assert.deepEqual(m.pcSeq, [0x0f79, 0x0f7a, 0x0f7b, 0x0f7e, 0x0f80, 0x0f82, 0x0ea2, 0x0fc3]);
  assert.deepEqual(m.calls, [0x0ea2, 0x0fc3]);
  assert.equal(m.pc, 0x0fc3, "tail jp lands on loc_0fc3");
  assert.equal(m.regs.a, 0x1b, "0xff & 0x01 = 0x01, + 0x1a = 0x1b");
  assert.equal(m.regs.sp, 0x8780, "tail call's callee ret consumes CALLER_RET -> pre-seat baseline");
});

test("loc_0f76 MUTATION: `add a,0x1a` mis-charged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x0f82 ? 4 : cycles);
  seatCaller(m);
  m.mem.write8(0x8d68, 0x00);
  m.mem.write8(0x8907, 0xff);

  loc_0f76(m);

  assert.equal(m.tstates, 73, "mutation loses 3 T (7 -> 4)");
  assert.throws(
    () => assert.equal(m.tstates, 76, "P2 T-state total"),
    /76/,
    "the 76-T golden must fail on the mutant",
  );
});
