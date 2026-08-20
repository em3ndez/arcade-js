// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5ae4 (ROM 0x5ae4, Pooyan) -- the master per-frame updater that
 * invokes eleven subsystem handlers in fixed ROM order, then rets. Every target is a boundary.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`), so a
 * missing push16 desyncs the stack: the next callee pops the wrong value and the final ret misses
 * CALLER_RET. pcSeq visits the eleven call TARGETS (the CALL steps into the target), not the returns.
 *
 * Run: node --test games/pooyan/translated/test/loc_5ae4.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5ae4 } from "../loc_5ae4.js";

const CALLER_RET = 0xabcd;

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5ae4, pcSeq: [],
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

const TARGETS = [
  0x5e78, 0x5f6a, 0x602f, 0x6368, 0x5df7, 0x5b06, 0x5d4d, 0x5b86, 0x6404, 0x5d0b, 0x5b2c,
];

test("loc_5ae4: eleven subsystem calls in order, then ret", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_5ae4(m);

  assert.equal(m.tstates, 11 * 17 + 10, "T = 11 calls (17) + ret (10)");
  assert.deepEqual(m.pcSeq, [...TARGETS, CALLER_RET], "steps visit each call target then the caller ret");
  assert.deepEqual(m.calls, TARGETS, "all eleven handlers invoked in ROM order");
  assert.equal(m.pc, CALLER_RET, "ret at 0x5b05 to the seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (all eleven push16 matched a callee ret)");
});

test("loc_5ae4 MUTATION: a `call` mis-charged 10T (not 17T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x6368 ? 10 : cycles);
  seatCaller(m);

  loc_5ae4(m);

  assert.equal(m.tstates, 197 - 7, "mutation loses 7 T (17 -> 10)");
  assert.throws(
    () => assert.equal(m.tstates, 197, "loc_5ae4 T-state total"),
    /197/,
    "the 197-T golden must fail on the mutant",
  );
});
