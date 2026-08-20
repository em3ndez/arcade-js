// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_18af (ROM 0x18af, Pooyan) -- the gameplay-state idx4 per-frame
 * coordinator. A straight-line sequence of 14 sub-handler calls then ret. There is exactly one
 * control path: every call is taken, every callee returns, the routine ret's to its caller.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`), so a
 * call site that forgot its push16 desyncs the stack: the final `ret` then pops garbage instead of the
 * seated CALLER_RET, and both the pcSeq tail and the SP-baseline assertion fail. That is the stack tooth.
 *
 * Run: node --test games/pooyan/translated/test/loc_18af.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_18af } from "../loc_18af.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x18af, pcSeq: [],
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

const TARGETS = [
  0x1e55, 0x6cab, 0x20d4, 0x511b, 0x3377, 0x40bd, 0x02ef,
  0x18da, 0x191c, 0x5ae4, 0x196e, 0x1f2f, 0x6b3b, 0x19ca,
];

test("loc_18af: 14 sub-handler calls in ROM order, then ret", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_18af(m);

  // 14 calls * 17 T + ret 10
  assert.equal(m.tstates, 14 * 17 + 10, "T = 14 calls (17) + ret (10)");
  assert.deepEqual(m.pcSeq, [...TARGETS, CALLER_RET], "each call steps to its target; ret lands on caller");
  assert.deepEqual(m.calls, TARGETS, "callees invoked in exact ROM order");
  assert.equal(m.pc, CALLER_RET, "ret returns to the seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (every push16 matched a callee ret)");
});

test("loc_18af MUTATION: the 0x1e55 call mis-charged 16T (not 17T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1e55 ? 16 : cycles);
  seatCaller(m);

  loc_18af(m);

  assert.equal(m.tstates, 14 * 17 + 10 - 1, "mutation loses 1 T");
  assert.throws(
    () => assert.equal(m.tstates, 14 * 17 + 10, "coordinator T-state total"),
    /248/,
    "the golden T must fail on the mutant",
  );
});
