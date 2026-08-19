// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_0899 (ROM 0x0899, Pooyan) -- the rst 0x28 sub-state
 * dispatcher. It pushes 0x0bb5 (the return address the SELECTED state handler will `ret`
 * to), reads the selector at 0x8e51, then `rst 0x28` -> loc_0028 reads the inline table at
 * 0x08a1 and jp (hl)'s to the handler.
 *
 * Pinned path: selector = 1. T = 10 + 11 + 13 + 11 = 45. pcSeq lands on each boundary and
 * finally 0x0028 (the rst target); the routine delegates to loc_0028 (recorded as a call).
 * The stack ends with 0x08a1 (rst's own return = table base) on top and 0x0bb5 beneath it,
 * with the seated caller address below that.
 *
 * TEETH: mis-charge `ld a,(0x8e51)` (13 T) as 7 T. The golden T-state must catch it.
 *
 * Run: node --test games/pooyan/translated/test/loc_0899.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0899 } from "../loc_0899.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0899, pcSeq: [],
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
    call(addr, site) { this.calls.push(addr); this.site = site; return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_0899: rst 0x28 dispatch on 0x8e51 -> loc_0028, handler return 0x0bb5 seated", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8e51, 0x01); // selector = state 1
  loc_0899(m);

  assert.equal(m.tstates, 45, "T = 10 (ld hl) + 11 (push) + 13 (ld a) + 11 (rst)");
  assert.deepEqual(m.pcSeq, [0x089c, 0x089d, 0x08a0, 0x0028], "boundaries; last is the rst target");
  assert.deepEqual(m.calls, [0x0028], "delegates to the generic dispatcher loc_0028");
  assert.equal(m.regs.a, 0x01, "A = the selector read from 0x8e51");
  // stack: rst's return (table base 0x08a1) on top, then the handler return 0x0bb5, then caller
  assert.equal(m.pop16(), 0x08a1, "top of stack = rst 0x28 return = table base 0x08a1");
  assert.equal(m.pop16(), 0x0bb5, "beneath it = the handler return address 0x0bb5");
  assert.equal(m.pop16(), CALLER_RET, "beneath that = the seated caller return");
});

test("loc_0899 MUTATION: `ld a,(0x8e51)` mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x08a0 ? 7 : cycles);
  seatCaller(m);
  m.mem.write8(0x8e51, 0x01);
  loc_0899(m);

  assert.equal(m.tstates, 39, "mutation loses 6 T (13 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 45, "T = 45"),
    /45/,
    "the golden T-state assertion must fail on the mutant",
  );
});
