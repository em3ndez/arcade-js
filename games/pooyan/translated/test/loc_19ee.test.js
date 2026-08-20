// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_19ee (ROM 0x19ee, Pooyan) -- the gameplay-state per-frame
 * coordinator: six ordered sub-handler calls, then ret. One control path: every call is taken,
 * every callee returns, the routine ret's to its caller.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`), so a
 * call site missing its push16 desyncs the stack: the final `ret` then pops garbage instead of the
 * seated CALLER_RET, and both the pcSeq tail and the SP-baseline assertion fail -- the stack tooth.
 *
 * Run: node --test games/pooyan/translated/test/loc_19ee.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_19ee } from "../loc_19ee.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x19ee, pcSeq: [],
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
    // stays balanced. A missing push16 then desyncs SP and the final ret pops garbage.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

const TARGETS = [0x308b, 0x25a6, 0x3377, 0x40bd, 0x28c6, 0x02ef];

test("loc_19ee: six sub-handler calls in ROM order, then ret", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_19ee(m);

  assert.equal(m.tstates, 6 * 17 + 10, "T = 6 calls (17) + ret (10)");
  assert.deepEqual(m.pcSeq, [...TARGETS, CALLER_RET], "each call steps to its target; ret lands on caller");
  assert.deepEqual(m.calls, TARGETS, "callees invoked in exact ROM order");
  assert.equal(m.pc, CALLER_RET, "ret returns to the seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (every push16 matched a callee ret)");
});

test("loc_19ee MUTATION: the 0x308b call mis-charged 16T (not 17T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x308b ? 16 : cycles);
  seatCaller(m);

  loc_19ee(m);

  assert.equal(m.tstates, 6 * 17 + 10 - 1, "mutation loses 1 T");
  assert.throws(
    () => assert.equal(m.tstates, 6 * 17 + 10, "coordinator T-state total"),
    /112/,
    "the golden T must fail on the mutant",
  );
});
