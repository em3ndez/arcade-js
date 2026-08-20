// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_4378 (ROM 0x4378, Pooyan) -- a null handler: a lone `ret`.
 * The routine is a called stub with no effect; it simply pops the seated caller return.
 *
 * PURE LEAF (no calls): the push16-deletion control is N/A, so the positive control mutates the
 * ret's T-state cost (10 -> 9) and confirms the 10-T golden throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_4378.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_4378 } from "../loc_4378.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x4378, pcSeq: [],
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

test("loc_4378: immediate ret to the seated caller", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_4378(m);

  assert.equal(m.tstates, 10, "ret = 10 T");
  assert.deepEqual(m.pcSeq, [CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "ret lands on the seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
  assert.deepEqual(m.calls, [], "no work done");
});

test("loc_4378 MUTATION: ret mis-charged 9T (not 10T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === CALLER_RET ? 9 : cycles);
  seatCaller(m);

  loc_4378(m);

  assert.equal(m.tstates, 9, "mutation loses 1 T (10 -> 9)");
  assert.throws(() => assert.equal(m.tstates, 10), /10/, "the 10-T golden must fail on the mutant");
});
