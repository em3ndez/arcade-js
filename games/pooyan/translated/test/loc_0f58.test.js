// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_0f58 (ROM 0x0f58, Pooyan) -- queue four draws: loc_0ea2
 * (BOUNDARY) with A=0x96 then 0x97, loc_0eb3 with A=0x18, then a TAIL jp to loc_0eb3 with A=0x15.
 * Straight-line, single path.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`).
 * The three `call`s each push16 a return address the callee pops (balanced); the tail `jp 0x0eb3`
 * pushes NOTHING and reuses the caller frame, so loc_0eb3's ret consumes the seated CALLER_RET --
 * the stack unwinds to the PRE-SEAT baseline (assert SP, not "CALLER_RET still on the stack").
 *
 * TEETH: mis-charge `ld a,0x96` (7 T) as 4 T -> the 89-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_0f58.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0f58 } from "../loc_0f58.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0f58, pcSeq: [],
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

test("loc_0f58: four draws, tail jp to loc_0eb3", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_0f58(m);

  assert.equal(m.tstates, 89);
  assert.deepEqual(m.pcSeq, [0x0f5a, 0x0ea2, 0x0f5f, 0x0ea2, 0x0f64, 0x0eb3, 0x0f69, 0x0eb3]);
  assert.deepEqual(m.calls, [0x0ea2, 0x0ea2, 0x0eb3, 0x0eb3]);
  assert.equal(m.pc, 0x0eb3, "tail jp lands on loc_0eb3");
  assert.equal(m.regs.a, 0x15, "final A = last selector");
  assert.equal(m.regs.sp, 0x8780, "tail call's callee ret consumes CALLER_RET -> pre-seat baseline");
});

test("loc_0f58 MUTATION: `ld a,0x96` mis-charged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x0f5a ? 4 : cycles);
  seatCaller(m);

  loc_0f58(m);

  assert.equal(m.tstates, 86, "mutation loses 3 T (7 -> 4)");
  assert.throws(
    () => assert.equal(m.tstates, 89, "loc_0f58 T-state total"),
    /89/,
    "the 89-T golden must fail on the mutant",
  );
});
