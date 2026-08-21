// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_68f8 (ROM 0x68f8, Pooyan) -- per-frame group update: calls
 * loc_6905, loc_69ad, loc_6a0f, loc_6a7f in order then rets. Single straight-line path; the mock's
 * `call` POPS the pushed return (the stack tooth), so SP returns to the pre-seat baseline. Asserts
 * pcSeq + call order + T-state total + SP balance, plus a T-state mutation.
 *
 * Run: node --test games/pooyan/translated/test/loc_68f8.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_68f8 } from "../loc_68f8.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x68f8, pcSeq: [],
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

test("loc_68f8: four calls in order then ret", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_68f8(m);

  assert.equal(m.tstates, 4 * 17 + 10, "four calls (17T) + ret (10T)");
  assert.deepEqual(m.pcSeq, [0x6905, 0x69ad, 0x6a0f, 0x6a7f, CALLER_RET]);
  assert.deepEqual(m.calls, [0x6905, 0x69ad, 0x6a0f, 0x6a7f]);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_68f8 MUTATION: a call mis-charged 16T (not 17T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x6a0f ? 16 : cycles);
  seatCaller(m);

  loc_68f8(m);

  assert.equal(m.tstates, 77, "mutation loses 1 T");
  assert.throws(() => assert.equal(m.tstates, 78), /78/);
});
