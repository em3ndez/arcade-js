// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5146 (ROM 0x5146, Pooyan) -- the boot-frontier trampoline that
 * calls 0x5150, 0x52f6, 0x5334 in turn and returns. One straight-line path.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`), so a
 * call site that forgot its `push16` would desync the stack and miss CALLER_RET at the final ret --
 * giving the stack-balance assertion real teeth. The callees leave no register state this routine reads.
 *
 * Run: node --test games/pooyan/translated/test/loc_5146.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5146 } from "../loc_5146.js";

const CALLER_RET = 0xabcd;
const PRE_SEAT = 0x8780;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5146, pcSeq: [],
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
    // stays balanced (a missing push16 at a call site then desyncs SP and fails the final ret).
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = PRE_SEAT;
  m.push16(CALLER_RET);
}

test("loc_5146: three sequential calls, then ret to caller", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_5146(m);

  assert.equal(m.tstates, 17 + 17 + 17 + 10, "three call(17) + ret(10)");
  assert.deepEqual(m.pcSeq, [0x5150, 0x52f6, 0x5334, CALLER_RET], "steps to the call targets, then the caller ret");
  assert.deepEqual(m.calls, [0x5150, 0x52f6, 0x5334], "calls in ROM order");
  assert.equal(m.pc, CALLER_RET, "ret lands on the seated caller");
  // Every push16 was matched by a callee ret pop, and the final ret popped CALLER_RET -- the stack
  // fully unwinds to the pre-seat baseline. A call site missing its push16 would leave SP off by 2.
  assert.equal(m.regs.sp, PRE_SEAT, "stack fully unwound to the pre-seat baseline");
});

test("loc_5146 MUTATION: a call mis-charged 10T (not 17T) is caught by the golden total", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x52f6 ? 10 : cycles);
  seatCaller(m);

  loc_5146(m);

  assert.equal(m.tstates, 61 - 7, "mutation loses 7 T (17 -> 10)");
  assert.throws(
    () => assert.equal(m.tstates, 61, "golden total"),
    /61/,
    "the 61-T golden must fail on the mutant",
  );
});
